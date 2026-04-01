# Checklist schedules: overdue hygiene

## What runs automatically

- **`pg_cron` job** `reschedule-overdue-checklists` — daily at **06:15 UTC** (`15 6 * * *`). It executes `SELECT public.reschedule_overdue_checklists();`.
- Migrations: [`20260401120606`](../supabase/migrations/20260401120606_fix_reschedule_overdue_checklists_weekly.sql) (weekly math fix), [`20260401120640`](../supabase/migrations/20260401120640_stale_checklist_schedules_cleanup.sql) (dedupe + reschedule + cron), [`20260401140000`](../supabase/migrations/20260401140000_fix_daily_schedules_after_wrong_dedupe.sql) (recovery after bad dedupe survivor — see below).

## One-off SQL (ops / SQL Editor)

Re-run overdue roll-forward manually:

```sql
SELECT public.reschedule_overdue_checklists();
```

To process many stuck rows in one session, repeat until it returns `0` (or use a small DO loop with an iteration cap, as in the migration).

## Stacked `pendiente` rows (legacy)

**Scope:** Deduplication applies per **`(asset_id, template_id)`** — the same asset can still have many **different** checklist templates (e.g. diario + semanal + mensual) open at once. We only collapse multiple **rows for the same template** on different days.

If multiple `pendiente` rows exist for the same `(asset_id, template_id)` on different days, `reschedule_overdue_checklists` may not move the older row when a newer row already occupies the target day.

### Wrong survivor (avoid)

The first cleanup used `ORDER BY scheduled_day DESC`, which keeps the **farthest** date — including a **future** row — and can delete **today’s** `pendiente`. Recovery: migration `20260401140000` (diario: drop redundant future when a `pendiente` exists for today; move future-only to today only if `(template, asset, current_date)` has **no** row of any status — respects `uniq_template_asset_day` vs `completado`).

### Correct emergency dedupe (review before running)

Keep **today** first, else **earliest future**, else **latest past** (same template + asset):

```sql
WITH ranked AS (
  SELECT id,
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
to_delete AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM checklist_schedules cs
WHERE cs.id IN (SELECT id FROM to_delete)
  AND NOT EXISTS (
    SELECT 1 FROM compliance_incidents ci
    WHERE ci.checklist_schedule_id = cs.id
  );
```

## Verification queries

```sql
SELECT count(*) FILTER (WHERE status = 'pendiente') AS pending_total,
       count(*) FILTER (WHERE status = 'pendiente' AND scheduled_day < current_date) AS overdue_pending
FROM checklist_schedules;

SELECT count(*) FROM (
  SELECT 1 FROM checklist_schedules
  WHERE status = 'pendiente' AND asset_id IS NOT NULL AND template_id IS NOT NULL
  GROUP BY asset_id, template_id
  HAVING count(*) > 1
) d;
```
