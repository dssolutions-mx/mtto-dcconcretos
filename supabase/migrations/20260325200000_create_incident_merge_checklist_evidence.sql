-- Merge checklist_evidence into incident_history.documents when creating incidents from checklist issues.
-- Matches app logic in lib/checklist/collect-checklist-issue-evidence.ts (item section + template evidence sections, or all evidence if neither applies).

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
BEGIN
  SELECT
    ci.*,
    cc.asset_id,
    cc.technician,
    cc.completion_date
  INTO v_issue_record
  FROM checklist_issues ci
  JOIN completed_checklists cc ON ci.checklist_id = cc.id
  WHERE ci.id = p_checklist_issue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checklist issue not found: %', p_checklist_issue_id;
  END IF;

  SELECT name, asset_id, location
  INTO v_asset_record
  FROM assets
  WHERE id = v_issue_record.asset_id;

  IF v_issue_record.photo_url IS NOT NULL AND btrim(v_issue_record.photo_url) <> '' THEN
    v_documents := v_documents || jsonb_build_array(btrim(v_issue_record.photo_url));
  END IF;

  SELECT cc.checklist_id
  INTO v_template_id
  FROM completed_checklists cc
  WHERE cc.id = v_issue_record.checklist_id;

  v_item_section := NULL;
  BEGIN
    SELECT ci2.section_id
    INTO v_item_section
    FROM checklist_items ci2
    WHERE ci2.id = v_issue_record.item_id::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_item_section := NULL;
  END;

  SELECT EXISTS (
    SELECT 1
    FROM checklist_sections cs
    WHERE cs.checklist_id = v_template_id
      AND cs.section_type = 'evidence'
  )
  INTO v_has_evidence_sections;

  v_use_all_evidence := (v_item_section IS NULL AND NOT COALESCE(v_has_evidence_sections, false));

  IF v_use_all_evidence THEN
    FOR v_url IN
      SELECT DISTINCT btrim(ce.photo_url) AS u
      FROM checklist_evidence ce
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
      FROM checklist_evidence ce
      WHERE ce.completed_checklist_id = v_issue_record.checklist_id
        AND ce.photo_url IS NOT NULL
        AND btrim(ce.photo_url) <> ''
        AND (
          (v_item_section IS NOT NULL AND ce.section_id = v_item_section)
          OR ce.section_id IN (
            SELECT cs.id
            FROM checklist_sections cs
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

  INSERT INTO incident_history (
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
    documents
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
    CASE WHEN jsonb_array_length(v_documents) > 0 THEN v_documents ELSE NULL END
  )
  RETURNING id INTO v_incident_id;

  UPDATE checklist_issues
  SET incident_id = v_incident_id
  WHERE id = p_checklist_issue_id;

  RETURN v_incident_id;
END;
$$;
