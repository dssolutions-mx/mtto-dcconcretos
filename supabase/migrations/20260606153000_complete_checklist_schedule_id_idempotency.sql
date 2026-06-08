-- Make checklist completion idempotent per schedule occurrence.
--
-- Context: offline completions sync through /api/checklists/schedules/[id]/complete
-- -> complete_checklist_with_readings(). Retries (now more frequent after the offline
-- sync hardening) and double submits could create duplicate completed_checklists rows,
-- and the previous route-level heuristic (template + asset + technician within 10 min)
-- both missed real duplicates and DISCARDED legitimate completions when an operator
-- synced several days' worth of the same daily checklist for one asset at once.
--
-- Fix: track the schedule instance on the completion row and dedupe on it deterministically.

-- 1. schedule_id link. Nullable; historical rows stay NULL (no reliable backfill link).
ALTER TABLE public.completed_checklists
  ADD COLUMN IF NOT EXISTS schedule_id uuid;

-- 2. One completion per schedule occurrence — partial so historical NULL rows and the
--    other (legacy) completion functions that don't set schedule_id are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_completed_checklists_schedule_id
  ON public.completed_checklists (schedule_id)
  WHERE schedule_id IS NOT NULL;

-- 3. Idempotent completion RPC: returns the existing completion instead of inserting a
--    duplicate, and stamps schedule_id on new rows.
CREATE OR REPLACE FUNCTION public.complete_checklist_with_readings(
  p_schedule_id uuid,
  p_completed_items jsonb,
  p_technician text,
  p_notes text DEFAULT NULL::text,
  p_signature_data text DEFAULT NULL::text,
  p_hours_reading integer DEFAULT NULL::integer,
  p_kilometers_reading integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_checklist_id UUID;
  v_asset_id UUID;
  v_schedule_status TEXT;
  v_template_version_id UUID;
  v_status TEXT := 'Completado';
  v_item JSONB;
  v_completed_id UUID;
  v_has_issues BOOLEAN := FALSE;
  v_reading_update_result JSONB;
  v_existing_id UUID;
BEGIN
  SELECT template_id, asset_id, status
  INTO v_checklist_id, v_asset_id, v_schedule_status
  FROM checklist_schedules
  WHERE id = p_schedule_id;

  IF v_checklist_id IS NULL THEN
    RAISE EXCEPTION 'Schedule with id % not found', p_schedule_id;
  END IF;

  -- IDEMPOTENCIA (determinista, por instancia de programación):
  -- (1) la programación ya tiene un completado con schedule_id.
  SELECT id INTO v_existing_id
  FROM completed_checklists
  WHERE schedule_id = p_schedule_id
  LIMIT 1;

  -- (2) la programación ya está 'completado' (otro flujo, o completado antes de que
  --     existiera schedule_id): no reinsertar, evita duplicar efectos colaterales.
  IF v_existing_id IS NULL AND v_schedule_status = 'completado' THEN
    SELECT id INTO v_existing_id
    FROM completed_checklists
    WHERE checklist_id = v_checklist_id AND asset_id = v_asset_id
    ORDER BY completion_date DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'completed_id', v_existing_id,
      'is_duplicate_prevented', TRUE,
      'has_issues', NULL,
      'reading_update', '{}'::jsonb,
      'hours_reading', p_hours_reading,
      'kilometers_reading', p_kilometers_reading
    );
  END IF;

  SELECT id INTO v_template_version_id
  FROM checklist_template_versions
  WHERE template_id = v_checklist_id AND is_active = TRUE;

  FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
  LOOP
    IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
      v_has_issues := TRUE;
      v_status := 'Con Problemas';
    END IF;
  END LOOP;

  INSERT INTO completed_checklists (
    schedule_id,
    checklist_id,
    template_version_id,
    asset_id,
    completed_items,
    technician,
    completion_date,
    notes,
    status,
    signature_data,
    equipment_hours_reading,
    equipment_kilometers_reading,
    reading_timestamp
  ) VALUES (
    p_schedule_id,
    v_checklist_id,
    v_template_version_id,
    v_asset_id,
    p_completed_items,
    p_technician,
    NOW(),
    p_notes,
    v_status,
    p_signature_data,
    p_hours_reading,
    p_kilometers_reading,
    CASE WHEN p_hours_reading IS NOT NULL OR p_kilometers_reading IS NOT NULL
         THEN NOW()
         ELSE NULL
    END
  ) RETURNING id INTO v_completed_id;

  IF p_hours_reading IS NOT NULL OR p_kilometers_reading IS NOT NULL THEN
    SELECT update_asset_readings_from_checklist(
      v_completed_id,
      p_hours_reading,
      p_kilometers_reading
    ) INTO v_reading_update_result;
  END IF;

  UPDATE checklist_schedules
  SET status = 'completado', updated_at = NOW()
  WHERE id = p_schedule_id;

  IF v_has_issues THEN
    FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
    LOOP
      IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
        INSERT INTO checklist_issues (
          checklist_id, item_id, status, description, notes, photo_url, resolved
        ) VALUES (
          v_completed_id,
          v_item->>'item_id',
          v_item->>'status',
          COALESCE(v_item->>'description', 'Problema detectado durante el checklist'),
          v_item->>'notes',
          v_item->>'photo_url',
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE assets
  SET last_maintenance_date = NOW()
  WHERE id = v_asset_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'completed_id', v_completed_id,
    'template_version_id', v_template_version_id,
    'has_issues', v_has_issues,
    'reading_update', COALESCE(v_reading_update_result, '{}'::jsonb),
    'hours_reading', p_hours_reading,
    'kilometers_reading', p_kilometers_reading
  );
END;
$function$;
