-- Task 3: operator_punctuality section type + plant_operations_data on completions.

ALTER TABLE public.checklist_sections
  ADD COLUMN IF NOT EXISTS punctuality_config jsonb,
  ADD COLUMN IF NOT EXISTS bonus_closure_config jsonb;

COMMENT ON COLUMN public.checklist_sections.punctuality_config IS
  'Config for operator_punctuality sections (e.g. require_production_flag).';

COMMENT ON COLUMN public.checklist_sections.bonus_closure_config IS
  'Placeholder for bonus_closure sections (Task 4).';

ALTER TABLE public.completed_checklists
  ADD COLUMN IF NOT EXISTS plant_operations_data jsonb;

COMMENT ON COLUMN public.completed_checklists.plant_operations_data IS
  'Lane B plant operations data: punctuality grids, bonus closures, keyed by section_id.';

ALTER TABLE public.checklist_sections
  DROP CONSTRAINT IF EXISTS checklist_sections_section_type_check;

ALTER TABLE public.checklist_sections
  ADD CONSTRAINT checklist_sections_section_type_check
  CHECK (section_type = ANY (ARRAY[
    'checklist'::text,
    'evidence'::text,
    'cleanliness_bonus'::text,
    'security_talk'::text,
    'tire_readings'::text,
    'operator_punctuality'::text
  ]));

COMMENT ON COLUMN public.checklist_sections.section_type IS
  'Section type: checklist, evidence, cleanliness_bonus, security_talk, tire_readings, operator_punctuality.';
