-- Task 4: bonus_closure section type for monthly operator bonus evaluation.

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
    'operator_punctuality'::text,
    'bonus_closure'::text
  ]));

COMMENT ON COLUMN public.checklist_sections.bonus_closure_config IS
  'Config for bonus_closure sections (bonus_type, deadline_day, suggest_eligibility_threshold).';

COMMENT ON COLUMN public.checklist_sections.section_type IS
  'Section type: checklist, evidence, cleanliness_bonus, security_talk, tire_readings, operator_punctuality, bonus_closure.';
