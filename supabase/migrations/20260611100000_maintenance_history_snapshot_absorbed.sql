-- Snapshot interval value at completion time + record checkpoint absorption audit trail.

ALTER TABLE maintenance_history
  ADD COLUMN IF NOT EXISTS interval_value_snapshot integer,
  ADD COLUMN IF NOT EXISTS absorbed_services jsonb;

COMMENT ON COLUMN maintenance_history.interval_value_snapshot IS
  'maintenance_intervals.interval_value at completion time; preserves meaning if interval definitions change.';

COMMENT ON COLUMN maintenance_history.absorbed_services IS
  'Array of {intervalId, intervalValue, due, cycle} dues settled by this preventive checkpoint.';

UPDATE maintenance_history mh
SET interval_value_snapshot = mi.interval_value
FROM maintenance_intervals mi
WHERE mh.maintenance_plan_id = mi.id
  AND mh.interval_value_snapshot IS NULL
  AND mi.interval_value IS NOT NULL;
