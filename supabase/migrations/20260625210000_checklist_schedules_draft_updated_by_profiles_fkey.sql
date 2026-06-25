-- PostgREST embed profiles!draft_updated_by requires FK to public.profiles.
-- Original column referenced auth.users(id), which breaks client selects.

ALTER TABLE checklist_schedules
  DROP CONSTRAINT IF EXISTS checklist_schedules_draft_updated_by_fkey;

ALTER TABLE checklist_schedules
  ADD CONSTRAINT checklist_schedules_draft_updated_by_fkey
  FOREIGN KEY (draft_updated_by) REFERENCES profiles(id) ON DELETE SET NULL;
