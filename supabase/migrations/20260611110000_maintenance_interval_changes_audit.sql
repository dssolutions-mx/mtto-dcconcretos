-- Audit trail for maintenance interval definition changes (cycle length, values).

CREATE TABLE IF NOT EXISTS maintenance_interval_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interval_id uuid REFERENCES maintenance_intervals(id) ON DELETE SET NULL,
  model_id uuid NOT NULL REFERENCES equipment_models(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);

CREATE INDEX IF NOT EXISTS idx_maintenance_interval_changes_model
  ON maintenance_interval_changes(model_id, changed_at DESC);

COMMENT ON TABLE maintenance_interval_changes IS
  'Audit log when maintenance_intervals definitions change (who, when, old/new).';
