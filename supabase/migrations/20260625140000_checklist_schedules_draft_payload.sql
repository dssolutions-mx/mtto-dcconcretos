ALTER TABLE checklist_schedules ADD COLUMN IF NOT EXISTS draft_payload jsonb;
ALTER TABLE checklist_schedules ADD COLUMN IF NOT EXISTS draft_updated_at timestamptz;
ALTER TABLE checklist_schedules ADD COLUMN IF NOT EXISTS draft_updated_by uuid REFERENCES auth.users(id);
