-- Backfill maintenance_history: maintenance_plan_id must reference maintenance_intervals.id.
-- Rows created from work-order completion historically stored maintenance_plans.id; remap via plan.interval_id.
UPDATE maintenance_history mh
SET maintenance_plan_id = mp.interval_id
FROM maintenance_plans mp
WHERE mh.maintenance_plan_id = mp.id
  AND mp.interval_id IS NOT NULL;
