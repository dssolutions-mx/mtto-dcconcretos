-- Recovery: first dedupe (20260401120640) kept max(scheduled_day), which could prefer a
-- FUTURE pendiente over TODAY's pendiente for the same asset+template.
--
-- 1) Remove redundant future diario pendiente when another pendiente already exists for today.
-- 2) Move sole future-only diario pendiente to today only if that calendar day is FREE for
--    (asset, template) — i.e. no row of any status on current_date (uniq_template_asset_day).

-- 1) Drop future duplicate when a pendiente for today already exists
DELETE FROM checklist_schedules cs
USING checklists c
WHERE c.id = cs.template_id
  AND c.frequency = 'diario'
  AND cs.status = 'pendiente'
  AND cs.scheduled_day > CURRENT_DATE
  AND EXISTS (
    SELECT 1
    FROM checklist_schedules cs2
    WHERE cs2.asset_id = cs.asset_id
      AND cs2.template_id = cs.template_id
      AND cs2.status = 'pendiente'
      AND cs2.scheduled_day = CURRENT_DATE
      AND cs2.id IS DISTINCT FROM cs.id
  );

-- 2) Sole future-only diario: bring to today only if today has no schedule row yet (any status)
UPDATE checklist_schedules cs
SET
  scheduled_day = CURRENT_DATE,
  scheduled_date = CURRENT_DATE::timestamp,
  updated_at = now()
FROM checklists c
WHERE c.id = cs.template_id
  AND c.frequency = 'diario'
  AND cs.status = 'pendiente'
  AND cs.scheduled_day > CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1
    FROM checklist_schedules cs2
    WHERE cs2.asset_id = cs.asset_id
      AND cs2.template_id = cs.template_id
      AND cs2.scheduled_day = CURRENT_DATE
  );
