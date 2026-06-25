-- Snapshot and restore executor_roles in template versions.

ALTER TABLE public.checklist_template_versions
  ADD COLUMN IF NOT EXISTS executor_roles text[];

COMMENT ON COLUMN public.checklist_template_versions.executor_roles IS
  'Snapshot of checklists.executor_roles at version creation time.';

CREATE OR REPLACE FUNCTION public.create_template_version(
  p_template_id uuid,
  p_change_summary text DEFAULT 'Cambios en plantilla'::text,
  p_migration_notes text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version_id UUID;
  v_next_version INTEGER;
  v_template RECORD;
  v_sections JSONB;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_next_version
  FROM checklist_template_versions
  WHERE template_id = p_template_id;

  SELECT * INTO v_template FROM checklists WHERE id = p_template_id;

  IF v_template.id IS NULL THEN
    RAISE EXCEPTION 'Template with id % not found', p_template_id;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'order_index', s.order_index,
      'section_type', s.section_type,
      'security_config', s.security_config,
      'cleanliness_config', s.cleanliness_config,
      'punctuality_config', s.punctuality_config,
      'bonus_closure_config', s.bonus_closure_config,
      'tire_readings_config', s.tire_readings_config,
      'evidence_config', s.evidence_config,
      'items', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'description', i.description,
            'required', i.required,
            'order_index', i.order_index,
            'item_type', i.item_type,
            'expected_value', i.expected_value,
            'tolerance', i.tolerance
          ) ORDER BY i.order_index
        )
        FROM checklist_items i
        WHERE i.section_id = s.id
      )
    ) ORDER BY s.order_index
  ) INTO v_sections
  FROM checklist_sections s
  WHERE s.checklist_id = p_template_id;

  IF v_sections IS NULL THEN
    v_sections := '[]'::jsonb;
  END IF;

  UPDATE checklist_template_versions
  SET is_active = FALSE
  WHERE template_id = p_template_id;

  INSERT INTO checklist_template_versions (
    template_id,
    version_number,
    name,
    description,
    model_id,
    frequency,
    hours_interval,
    executor_roles,
    sections,
    is_active,
    change_summary,
    migration_notes,
    created_by
  ) VALUES (
    p_template_id,
    v_next_version,
    v_template.name,
    v_template.description,
    v_template.model_id,
    v_template.frequency,
    v_template.hours_interval,
    v_template.executor_roles,
    v_sections,
    TRUE,
    p_change_summary,
    p_migration_notes,
    auth.uid()
  ) RETURNING id INTO v_version_id;

  RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_template_version(p_version_id uuid) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_version RECORD;
  v_section JSONB;
  v_item JSONB;
  v_section_id UUID;
BEGIN
  SELECT * INTO v_version FROM checklist_template_versions WHERE id = p_version_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Version with id % not found', p_version_id;
  END IF;

  UPDATE checklists SET
    name = v_version.name,
    description = v_version.description,
    model_id = v_version.model_id,
    frequency = v_version.frequency,
    hours_interval = v_version.hours_interval,
    executor_roles = v_version.executor_roles,
    updated_at = NOW(),
    updated_by = auth.uid()
  WHERE id = v_version.template_id;

  DELETE FROM checklist_items WHERE section_id IN (
    SELECT id FROM checklist_sections WHERE checklist_id = v_version.template_id
  );
  DELETE FROM checklist_sections WHERE checklist_id = v_version.template_id;

  FOR v_section IN SELECT jsonb_array_elements(v_version.sections)
  LOOP
    INSERT INTO checklist_sections (
      checklist_id,
      title,
      order_index,
      section_type,
      security_config,
      cleanliness_config,
      punctuality_config,
      bonus_closure_config,
      tire_readings_config,
      evidence_config,
      created_by
    ) VALUES (
      v_version.template_id,
      v_section->>'title',
      (v_section->>'order_index')::INTEGER,
      COALESCE(v_section->>'section_type', 'checklist'),
      v_section->'security_config',
      v_section->'cleanliness_config',
      v_section->'punctuality_config',
      v_section->'bonus_closure_config',
      v_section->'tire_readings_config',
      v_section->'evidence_config',
      auth.uid()
    ) RETURNING id INTO v_section_id;

    FOR v_item IN SELECT jsonb_array_elements(COALESCE(v_section->'items', '[]'::jsonb))
    LOOP
      INSERT INTO checklist_items (
        section_id,
        description,
        required,
        order_index,
        item_type,
        expected_value,
        tolerance,
        created_by
      ) VALUES (
        v_section_id,
        v_item->>'description',
        COALESCE((v_item->>'required')::BOOLEAN, TRUE),
        (v_item->>'order_index')::INTEGER,
        COALESCE(v_item->>'item_type', 'check'),
        v_item->>'expected_value',
        v_item->>'tolerance',
        auth.uid()
      );
    END LOOP;
  END LOOP;

  UPDATE checklist_template_versions
  SET is_active = FALSE
  WHERE template_id = v_version.template_id;

  UPDATE checklist_template_versions
  SET is_active = TRUE
  WHERE id = p_version_id;

  RETURN TRUE;
END;
$$;
