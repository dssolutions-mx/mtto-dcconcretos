-- Canonical issue identity and smarter deduplication across checklist types.
-- Rule: consolidate only into open (Pendiente) work orders; completed WOs are never reopened.

-- ---------------------------------------------------------------------------
-- Normalization helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_issue_core_item(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
  v_pos int;
BEGIN
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN '';
  END IF;

  v_text := btrim(p_description);
  v_pos := position(' - ' in v_text);
  IF v_pos > 0 THEN
    v_text := btrim(substring(v_text from 1 for v_pos - 1));
  END IF;

  -- Collapse internal whitespace
  v_text := regexp_replace(v_text, '\s+', ' ', 'g');
  RETURN upper(btrim(v_text));
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_canonical_issue_key(
  p_asset_id uuid,
  p_description text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_asset_id::text || '_' || public.normalize_issue_core_item(p_description);
END;
$$;

-- Backward-compatible fingerprint (now uses canonical core item)
CREATE OR REPLACE FUNCTION public.generate_issue_fingerprint(
  p_asset_id text,
  p_item_description text,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_asset_id::text || '_' || public.normalize_issue_core_item(p_item_description);
END;
$$;

-- ---------------------------------------------------------------------------
-- Schema columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.checklist_issues
  ADD COLUMN IF NOT EXISTS canonical_issue_key text;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS canonical_issue_key text;

ALTER TABLE public.incident_history
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES public.incident_history(id);

CREATE INDEX IF NOT EXISTS idx_checklist_issues_canonical_key_open
  ON public.checklist_issues (canonical_issue_key)
  WHERE resolved IS NOT TRUE;

CREATE INDEX IF NOT EXISTS idx_incident_history_canonical_key_open
  ON public.incident_history (canonical_issue_key, asset_id)
  WHERE status IN ('Abierto', 'Pendiente', 'En progreso');

-- ---------------------------------------------------------------------------
-- Backfill canonical keys
-- ---------------------------------------------------------------------------

UPDATE public.checklist_issues ci
SET canonical_issue_key = public.generate_canonical_issue_key(cc.asset_id, ci.description)
FROM public.completed_checklists cc
WHERE cc.id = ci.checklist_id
  AND (ci.canonical_issue_key IS NULL OR ci.canonical_issue_key = '');

UPDATE public.incident_history ih
SET canonical_issue_key = public.generate_canonical_issue_key(ih.asset_id, ih.description)
WHERE ih.asset_id IS NOT NULL
  AND (ih.canonical_issue_key IS NULL OR ih.canonical_issue_key = '');

-- Sync legacy fingerprint column
UPDATE public.checklist_issues
SET issue_fingerprint = canonical_issue_key
WHERE canonical_issue_key IS NOT NULL
  AND (issue_fingerprint IS NULL OR issue_fingerprint <> canonical_issue_key);

-- ---------------------------------------------------------------------------
-- Active thread lookup (open Pendiente WO only — never reopen Completada)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_active_issue_thread(
  p_asset_id uuid,
  p_canonical_key text
)
RETURNS TABLE (
  issue_id uuid,
  work_order_id uuid,
  incident_id uuid,
  created_at timestamptz,
  recurrence_count integer,
  item_description text,
  notes text,
  priority text,
  wo_status text,
  should_reopen boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM (
    SELECT
      ci.id,
      wo.id,
      ci.incident_id,
      ci.created_at,
      COALESCE(ci.recurrence_count, 1),
      ci.description,
      ci.notes,
      COALESCE(wo.priority, 'Media'),
      wo.status,
      false
    FROM public.checklist_issues ci
    JOIN public.completed_checklists cc ON cc.id = ci.checklist_id
    JOIN public.work_orders wo ON wo.id = ci.work_order_id
    WHERE cc.asset_id = p_asset_id
      AND ci.canonical_issue_key = p_canonical_key
      AND COALESCE(ci.resolved, false) = false
      AND wo.status = 'Pendiente'
    UNION ALL
    SELECT
      NULL::uuid,
      wo.id,
      ih.id,
      ih.created_at,
      1,
      ih.description,
      NULL::text,
      COALESCE(wo.priority, 'Media'),
      wo.status,
      false
    FROM public.incident_history ih
    JOIN public.work_orders wo ON wo.id = ih.work_order_id
    WHERE ih.asset_id = p_asset_id
      AND ih.canonical_issue_key = p_canonical_key
      AND ih.status IN ('Abierto', 'Pendiente', 'En progreso')
      AND wo.status = 'Pendiente'
  ) threads
  ORDER BY threads.created_at DESC
  LIMIT 1;
$$;

-- Backward-compatible wrapper (ignores window; only open Pendiente WOs)
CREATE OR REPLACE FUNCTION public.find_similar_open_issues(
  p_fingerprint text,
  p_asset_id uuid,
  p_consolidation_window interval DEFAULT '30 days'::interval
)
RETURNS TABLE (
  issue_id uuid,
  work_order_id uuid,
  created_at timestamptz,
  recurrence_count integer,
  item_description text,
  notes text,
  priority text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.issue_id,
    t.work_order_id,
    t.created_at,
    t.recurrence_count,
    t.item_description,
    t.notes,
    t.priority
  FROM public.find_active_issue_thread(p_asset_id, p_fingerprint) t;
END;
$$;

-- ---------------------------------------------------------------------------
-- Resolve linked issues when WO completes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_issues_for_completed_work_order(p_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checklist_issues
  SET
    resolved = true,
    resolution_date = COALESCE(resolution_date, now()),
    updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND COALESCE(resolved, false) = false;

  UPDATE public.incident_history
  SET
    status = 'Resuelto',
    updated_at = now()
  WHERE work_order_id = p_work_order_id
    AND status IN ('Abierto', 'Pendiente', 'En progreso');
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_resolve_issues_on_wo_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Completada'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND OLD.status IS DISTINCT FROM 'Completada' THEN
    PERFORM public.resolve_issues_for_completed_work_order(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_issues_on_wo_complete ON public.work_orders;
CREATE TRIGGER resolve_issues_on_wo_complete
  AFTER UPDATE OF status ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_resolve_issues_on_wo_complete();

-- ---------------------------------------------------------------------------
-- Incident from checklist: skip duplicate open incidents
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_incident_from_checklist_issue(p_checklist_issue_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue_record RECORD;
  v_incident_id uuid;
  v_asset_record RECORD;
  v_documents jsonb := '[]'::jsonb;
  v_template_id uuid;
  v_item_section uuid;
  v_url text;
  v_has_evidence_sections boolean;
  v_use_all_evidence boolean;
  v_canonical_key text;
  v_existing_incident uuid;
BEGIN
  SELECT
    ci.*,
    cc.asset_id,
    cc.technician,
    cc.completion_date
  INTO v_issue_record
  FROM public.checklist_issues ci
  JOIN public.completed_checklists cc ON ci.checklist_id = cc.id
  WHERE ci.id = p_checklist_issue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist issue not found: %', p_checklist_issue_id;
  END IF;

  IF v_issue_record.incident_id IS NOT NULL THEN
    RETURN v_issue_record.incident_id;
  END IF;

  v_canonical_key := public.generate_canonical_issue_key(
    v_issue_record.asset_id,
    v_issue_record.description
  );

  UPDATE public.checklist_issues
  SET canonical_issue_key = v_canonical_key,
      issue_fingerprint = v_canonical_key
  WHERE id = p_checklist_issue_id
    AND (canonical_issue_key IS NULL OR canonical_issue_key = '');

  SELECT ih.id INTO v_existing_incident
  FROM public.incident_history ih
  WHERE ih.asset_id = v_issue_record.asset_id
    AND ih.canonical_issue_key = v_canonical_key
    AND ih.status IN ('Abierto', 'Pendiente', 'En progreso')
  ORDER BY ih.created_at DESC
  LIMIT 1;

  IF v_existing_incident IS NOT NULL THEN
    UPDATE public.checklist_issues
    SET incident_id = v_existing_incident,
        work_order_id = COALESCE(
          work_order_id,
          (SELECT work_order_id FROM public.incident_history WHERE id = v_existing_incident)
        )
    WHERE id = p_checklist_issue_id;
    RETURN v_existing_incident;
  END IF;

  SELECT name, asset_id, location
  INTO v_asset_record
  FROM public.assets
  WHERE id = v_issue_record.asset_id;

  IF v_issue_record.photo_url IS NOT NULL AND btrim(v_issue_record.photo_url) <> '' THEN
    v_documents := v_documents || jsonb_build_array(btrim(v_issue_record.photo_url));
  END IF;

  SELECT cc.checklist_id
  INTO v_template_id
  FROM public.completed_checklists cc
  WHERE cc.id = v_issue_record.checklist_id;

  v_item_section := NULL;
  BEGIN
    SELECT ci2.section_id
    INTO v_item_section
    FROM public.checklist_items ci2
    WHERE ci2.id = v_issue_record.item_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_item_section := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM public.checklist_sections cs
    WHERE cs.checklist_id = v_template_id
      AND cs.section_type = 'evidence'
  )
  INTO v_has_evidence_sections;

  v_use_all_evidence := (v_item_section IS NULL AND NOT COALESCE(v_has_evidence_sections, false));

  IF v_use_all_evidence THEN
    FOR v_url IN
      SELECT DISTINCT btrim(ce.photo_url) AS u
      FROM public.checklist_evidence ce
      WHERE ce.completed_checklist_id = v_issue_record.checklist_id
        AND ce.photo_url IS NOT NULL
        AND btrim(ce.photo_url) <> ''
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_documents) AS e(val)
        WHERE e.val = v_url
      ) THEN
        v_documents := v_documents || jsonb_build_array(v_url);
      END IF;
    END LOOP;
  ELSE
    FOR v_url IN
      SELECT DISTINCT btrim(ce.photo_url) AS u
      FROM public.checklist_evidence ce
      WHERE ce.completed_checklist_id = v_issue_record.checklist_id
        AND ce.photo_url IS NOT NULL
        AND btrim(ce.photo_url) <> ''
        AND (
          (v_item_section IS NOT NULL AND ce.section_id = v_item_section)
          OR ce.section_id IN (
            SELECT cs.id
            FROM public.checklist_sections cs
            WHERE cs.checklist_id = v_template_id
              AND cs.section_type = 'evidence'
          )
        )
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_documents) AS e(val)
        WHERE e.val = v_url
      ) THEN
        v_documents := v_documents || jsonb_build_array(v_url);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.incident_history (
    asset_id,
    date,
    type,
    description,
    impact,
    status,
    reported_by,
    reported_by_id,
    created_by,
    created_at,
    work_order_id,
    documents,
    canonical_issue_key
  ) VALUES (
    v_issue_record.asset_id,
    v_issue_record.created_at,
    'Mantenimiento',
    COALESCE(v_issue_record.description, 'Problema detectado en checklist')
      || CASE
        WHEN v_issue_record.notes IS NOT NULL AND btrim(v_issue_record.notes) <> ''
        THEN ' - ' || v_issue_record.notes
        ELSE ''
      END,
    CASE
      WHEN v_issue_record.status = 'fail' THEN 'Alto'
      ELSE 'Medio'
    END,
    'Abierto',
    v_issue_record.technician,
    v_issue_record.created_by,
    v_issue_record.created_by,
    v_issue_record.created_at,
    v_issue_record.work_order_id,
    CASE WHEN jsonb_array_length(v_documents) > 0 THEN v_documents ELSE NULL END,
    v_canonical_key
  )
  RETURNING id INTO v_incident_id;

  UPDATE public.checklist_issues
  SET incident_id = v_incident_id
  WHERE id = p_checklist_issue_id;

  RETURN v_incident_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Work order from incident with dedup into open Pendiente WO
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.generate_work_order_from_incident(
  p_incident_id uuid,
  p_priority text DEFAULT 'Media'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident RECORD;
  v_work_order_id uuid;
  v_order_id text;
  v_required_parts jsonb;
  v_estimated_cost decimal(10,2) := 0;
  v_parts_array jsonb;
  v_canonical_key text;
  v_thread RECORD;
BEGIN
  SELECT * INTO v_incident FROM public.incident_history WHERE id = p_incident_id;

  IF v_incident IS NULL THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;

  IF v_incident.work_order_id IS NOT NULL THEN
    RETURN v_incident.work_order_id;
  END IF;

  v_canonical_key := COALESCE(
    v_incident.canonical_issue_key,
    public.generate_canonical_issue_key(v_incident.asset_id, v_incident.description)
  );

  UPDATE public.incident_history
  SET canonical_issue_key = v_canonical_key
  WHERE id = p_incident_id
    AND (canonical_issue_key IS NULL OR canonical_issue_key = '');

  SELECT * INTO v_thread
  FROM public.find_active_issue_thread(v_incident.asset_id, v_canonical_key)
  LIMIT 1;

  IF v_thread.work_order_id IS NOT NULL THEN
    UPDATE public.incident_history
    SET work_order_id = v_thread.work_order_id,
        status = 'Consolidado',
        merged_into_id = COALESCE(v_thread.incident_id, merged_into_id),
        updated_at = now()
    WHERE id = p_incident_id;

    IF v_thread.issue_id IS NOT NULL THEN
      UPDATE public.checklist_issues
      SET recurrence_count = COALESCE(recurrence_count, 1) + 1
      WHERE id = v_thread.issue_id;
    END IF;

    RETURN v_thread.work_order_id;
  END IF;

  IF v_incident.parts IS NOT NULL THEN
    BEGIN
      IF jsonb_typeof(v_incident.parts) = 'string' THEN
        v_parts_array := v_incident.parts;
        WHILE jsonb_typeof(v_parts_array) = 'string' LOOP
          v_parts_array := (v_parts_array::text)::jsonb;
        END LOOP;
      ELSE
        v_parts_array := v_incident.parts;
      END IF;

      IF jsonb_typeof(v_parts_array) = 'array' THEN
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', part_item->>'name',
            'partNumber', COALESCE(part_item->>'partNumber', ''),
            'quantity', COALESCE((part_item->>'quantity')::int, 1),
            'unit_price', COALESCE((part_item->>'cost')::decimal, 0),
            'total_price', COALESCE((part_item->>'quantity')::int * (part_item->>'cost')::decimal, 0),
            'supplier', '',
            'description', 'Requerido por incidente: ' || v_incident.type
          )
        ) INTO v_required_parts
        FROM jsonb_array_elements(v_parts_array) AS part_item;

        SELECT COALESCE(SUM((part->>'total_price')::decimal), 0)
        INTO v_estimated_cost
        FROM jsonb_array_elements(v_required_parts) AS part;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_required_parts := NULL;
        v_estimated_cost := 0;
    END;
  END IF;

  IF v_incident.labor_cost IS NOT NULL THEN
    v_estimated_cost := v_estimated_cost + v_incident.labor_cost::decimal;
  END IF;

  INSERT INTO public.work_orders (
    asset_id,
    description,
    type,
    priority,
    status,
    requested_by,
    required_parts,
    estimated_cost,
    estimated_duration,
    incident_id,
    created_at,
    updated_at
  ) VALUES (
    v_incident.asset_id,
    'Orden correctiva por incidente: ' || v_incident.type || ' - ' || v_incident.description,
    'corrective',
    p_priority,
    'Pendiente',
    v_incident.created_by,
    v_required_parts,
    CASE WHEN v_estimated_cost > 0 THEN v_estimated_cost ELSE NULL END,
    CASE WHEN v_incident.labor_hours IS NOT NULL THEN v_incident.labor_hours ELSE NULL END,
    p_incident_id,
    now(),
    now()
  ) RETURNING id, order_id INTO v_work_order_id, v_order_id;

  UPDATE public.incident_history
  SET work_order_id = v_work_order_id,
      updated_at = now()
  WHERE id = p_incident_id;

  RETURN v_work_order_id;
END;
$$;
