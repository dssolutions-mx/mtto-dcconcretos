-- Remap maintenance_history.maintenance_plan_id when it points to an interval
-- from another model (or legacy row) but the asset's current model has a tier
-- with the same interval_value. Keeps due-engine checkpoints linked for
-- reports/alerts that filter by current-model interval ids.

UPDATE maintenance_history mh
SET maintenance_plan_id = target_mi.id
FROM assets a,
     maintenance_intervals wrong_mi,
     maintenance_intervals target_mi
WHERE mh.asset_id = a.id
  AND mh.maintenance_plan_id IS NOT NULL
  AND wrong_mi.id = mh.maintenance_plan_id
  AND target_mi.model_id = a.model_id
  AND target_mi.interval_value = wrong_mi.interval_value
  AND COALESCE(target_mi.type, '') = COALESCE(wrong_mi.type, '')
  AND wrong_mi.model_id IS DISTINCT FROM a.model_id
  AND NOT EXISTS (
    SELECT 1
    FROM maintenance_intervals cur
    WHERE cur.id = mh.maintenance_plan_id
      AND cur.model_id = a.model_id
  );

-- BOMBA-CAMION INTERNATIONAL 02: rows with deleted or foreign plan ids (audit 2026-06-18)
UPDATE maintenance_history
SET maintenance_plan_id = 'e2b09b91-e14f-48d9-8a98-ad49cf2f8dff' -- 6300h (current model)
WHERE id = 'f1b3a499-9d01-45c7-be71-5b2d5d38dd84';

UPDATE maintenance_history
SET maintenance_plan_id = '40d03008-93a8-4c77-a279-cac3d8273c25' -- 350h (current model)
WHERE id = 'c1489c02-5f04-42c8-bbb3-39d8a892fac8';

-- Spurious 1000h PUTZMEISTER-tier row on INTERNATIONAL asset (no matching tier on model)
DELETE FROM maintenance_history
WHERE id = '56a78068-38ac-4d4b-bfd6-ae9c5e8f4235'
  AND asset_id = '3fb1a7b1-7b01-45f6-8bd8-d4ade5c6dde7';

-- Orphan duplicate maintenance_plans row for 6300h on same asset (keep plan with last_completed)
DELETE FROM maintenance_plans
WHERE id = '3ce64c5c-14e9-449a-94cc-d398e6b95616'
  AND asset_id = '3fb1a7b1-7b01-45f6-8bd8-d4ade5c6dde7'
  AND NOT EXISTS (
    SELECT 1 FROM maintenance_history mh WHERE mh.maintenance_plan_id = maintenance_plans.id
  );
