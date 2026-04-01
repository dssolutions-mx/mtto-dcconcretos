-- Stale checklist schedules cleanup (legacy stacked pendiente rows).
-- Depends on: 20260401120606_fix_reschedule_overdue_checklists_weekly.sql (fixed weekly math).
-- 1) Dedupe: one pendiente per (asset_id, template_id). Survivor = today, else earliest
--    future, else latest past (never max(scheduled_day) alone — that kept a future row and
--    could delete today's pendiente).
-- 2) Roll remaining overdue forward via reschedule_overdue_checklists (iterated).
-- 3) Daily pg_cron to keep overdue rows from sticking when duplicates are gone.
--
-- FK: only public.compliance_incidents.checklist_schedule_id references checklist_schedules;
-- rows referenced there are skipped in the delete.

-- ---------------------------------------------------------------------------
-- 1. Delete extra pendiente rows (survivor: today > earliest future > latest past)
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY asset_id, template_id
      ORDER BY
        CASE
          WHEN scheduled_day = CURRENT_DATE THEN 0
          WHEN scheduled_day > CURRENT_DATE THEN 1
          ELSE 2
        END ASC,
        CASE WHEN scheduled_day > CURRENT_DATE THEN scheduled_day END ASC NULLS LAST,
        CASE WHEN scheduled_day < CURRENT_DATE THEN scheduled_day END DESC NULLS LAST,
        id ASC
    ) AS rn
  FROM checklist_schedules
  WHERE status = 'pendiente'
    AND asset_id IS NOT NULL
    AND template_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM checklist_schedules cs
WHERE cs.id IN (SELECT id FROM to_delete)
  AND NOT EXISTS (
    SELECT 1
    FROM compliance_incidents ci
    WHERE ci.checklist_schedule_id = cs.id
  );

-- ---------------------------------------------------------------------------
-- 2. Roll overdue pendiente to next valid day (repeat until no moves or cap)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_moves integer;
  v_iter integer := 0;
  v_max constant integer := 50;
BEGIN
  LOOP
    SELECT public.reschedule_overdue_checklists() INTO v_moves;
    v_iter := v_iter + 1;
    EXIT WHEN coalesce(v_moves, 0) = 0 OR v_iter >= v_max;
  END LOOP;

  IF v_iter >= v_max AND coalesce(v_moves, 0) > 0 THEN
    RAISE WARNING
      'reschedule_overdue_checklists: stopped after % iterations (last batch moved % rows)',
      v_max,
      v_moves;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Daily hygiene: same function (pure SQL, no HTTP/Vault)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid integer;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'reschedule-overdue-checklists' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- 06:15 UTC daily — after typical Mexico morning checklist cron windows; adjust in dashboard if needed.
SELECT cron.schedule(
  'reschedule-overdue-checklists',
  '15 6 * * *',
  $$SELECT public.reschedule_overdue_checklists();$$
);
