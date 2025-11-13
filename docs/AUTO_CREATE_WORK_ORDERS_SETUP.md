# Auto-Create Work Orders Setup Guide

This system automatically creates work orders for checklist issues that remain unprocessed for more than 1 hour.

## Overview

The auto-creation system uses a **Supabase database function** with **pg_cron** to automatically process pending issues every hour. This approach is more reliable than API-based cron jobs because:

- ✅ Runs directly in the database (no cold starts)
- ✅ More efficient (no HTTP overhead)
- ✅ Platform independent (works with any hosting)
- ✅ Better for database operations
- ✅ Automatic logging and monitoring

## Architecture

```
Checklist Completion
        ↓
[Issues Created in DB]
        ↓
[Wait 1 hour] ← User has option to create manually
        ↓
[pg_cron triggers hourly]
        ↓
[auto_create_pending_work_orders() function]
        ↓
[Work Orders Created Automatically]
```

## Setup Instructions

### 1. Run the Migration

Execute the SQL migration in Supabase SQL Editor:

```bash
# The migration file is located at:
migrations/sql/20250114_auto_create_pending_work_orders.sql
```

**Important:** Run this with elevated permissions (service_role) because it:
- Creates the `auto_create_pending_work_orders()` function
- Sets up the pg_cron job
- Creates the `auto_create_logs` table for monitoring

### 2. Verify the Cron Job

After running the migration, verify the cron job was created:

```sql
SELECT * FROM cron.job WHERE jobname = 'auto-create-pending-work-orders';
```

You should see:
- **jobname:** `auto-create-pending-work-orders`
- **schedule:** `0 * * * *` (every hour)
- **command:** `SELECT auto_create_pending_work_orders_with_logging()`

### 3. Enable pg_cron Extension (if not already enabled)

In Supabase Dashboard:
1. Go to **Database** → **Extensions**
2. Search for `pg_cron`
3. Enable it

Or run in SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 4. Grant Necessary Permissions

The migration handles this, but verify:

```sql
GRANT EXECUTE ON FUNCTION auto_create_pending_work_orders() TO service_role;
GRANT EXECUTE ON FUNCTION auto_create_pending_work_orders_with_logging() TO service_role;
```

## How It Works

### 1. Automatic Detection

The function runs every hour and:
- Finds all `checklist_issues` that are `resolved = false`
- Checks if the checklist's `completion_date` is > 1 hour ago
- Excludes cleanliness and security section items
- Skips checklists that already have work orders

### 2. Smart Work Order Creation

For each pending issue:
- **Priority Assignment:** `fail` status → Alta, `flag` status → Media
- **Fingerprint Generation:** Uses `generate_issue_fingerprint()` function (same as existing API) to create unique identifiers
- **Consolidation:** Automatically consolidates with similar existing work orders by querying `checklist_issues.issue_fingerprint` and joining to `work_orders` via `work_order_id` (matches existing deduplication system)
- **New Work Orders:** Creates new work orders when no similar issue exists
- **Accurate Counting:** `created_count` only increments when new work orders are actually created (not when consolidating)
- **Marking as Resolved:** Updates `checklist_issues.resolved = true` and links `work_order_id`
- **Incident History:** Logs all actions in `incident_history`

### 3. Logging

Every run is logged to `auto_create_logs` table:
```sql
SELECT * FROM auto_create_logs ORDER BY run_at DESC LIMIT 10;
```

Fields:
- `run_at`: Timestamp of execution
- `result`: JSON with created_count, checklist_ids, etc.
- `success`: Boolean indicating if it succeeded
- `error`: Error message if failed

## Manual Triggering

### Via API Endpoint

Call the endpoint manually for testing or backup:

```bash
# GET request
curl https://your-domain.com/api/checklists/auto-create-pending-work-orders

# Or use in browser/admin dashboard
```

### Via SQL

Run directly in Supabase SQL Editor:

```sql
SELECT auto_create_pending_work_orders();
```

This returns a JSON object:
```json
{
  "success": true,
  "created_count": 3,
  "error_count": 0,
  "checklist_ids": ["abc-123", "def-456", "ghi-789"],
  "processed_at": "2025-01-14T10:00:00Z"
}
```

## Monitoring

### Check Recent Runs

```sql
SELECT
  run_at,
  result->>'created_count' as created,
  result->>'error_count' as errors,
  success
FROM auto_create_logs
ORDER BY run_at DESC
LIMIT 10;
```

### Check Pending Issues

See what will be auto-created in the next run:

```sql
SELECT
  cc.id as checklist_id,
  cc.completion_date,
  a.name as asset_name,
  COUNT(ci.id) as issue_count,
  NOW() - cc.completion_date as age
FROM checklist_issues ci
JOIN completed_checklists cc ON ci.checklist_id = cc.id
JOIN assets a ON cc.asset_id = a.id
WHERE ci.resolved = false
  AND cc.completion_date < NOW() - INTERVAL '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.checklist_id = ci.checklist_id
  )
GROUP BY cc.id, cc.completion_date, a.name
ORDER BY cc.completion_date ASC;
```

### View Auto-Created Work Orders

```sql
SELECT
  wo.order_id,
  wo.id,
  wo.description,
  wo.priority,
  wo.status,
  wo.created_at,
  a.name as asset_name
FROM work_orders wo
JOIN assets a ON wo.asset_id = a.id
WHERE wo.description LIKE '[AUTO-CREADO]%'
ORDER BY wo.created_at DESC
LIMIT 20;
```

### Verify Deduplication is Working

Check if issues are being consolidated correctly:

```sql
SELECT
  ci.issue_fingerprint,
  COUNT(DISTINCT ci.id) as issue_count,
  COUNT(DISTINCT wo.id) as work_order_count,
  wo.order_id,
  wo.description,
  wo.status
FROM checklist_issues ci
JOIN work_orders wo ON ci.work_order_id = wo.id
WHERE ci.issue_fingerprint IS NOT NULL
  AND ci.resolved = true
  AND wo.description LIKE '%Auto-consolidado%'
GROUP BY ci.issue_fingerprint, wo.id, wo.order_id, wo.description, wo.status
HAVING COUNT(DISTINCT ci.id) > 1
ORDER BY issue_count DESC;
```

## Implementation Notes

### Key Fixes Applied

1. **Deduplication Approach**: Uses existing `checklist_issues.issue_fingerprint` column and joins to `work_orders` via `work_order_id`, matching the existing API implementation (`generate-corrective-work-order-enhanced`)

2. **Type Casting**: Fixed UUID to text conversion when calling `generate_issue_fingerprint()` function (casts `asset_id::text`)

3. **Counting Bug Fix**: `created_count` now only increments when new work orders are actually created (inside ELSE branch), not when consolidating with existing ones

4. **Fingerprint Updates**: Automatically updates `checklist_issues.issue_fingerprint` if missing before checking for similar issues

5. **Work Order Linking**: Properly links issues to work orders via `work_order_id` column in both consolidation and creation scenarios

## Troubleshooting

### Cron Job Not Running

1. Check if pg_cron is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Check cron job status:
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-create-pending-work-orders';
```

3. Check for errors in logs:
```sql
SELECT * FROM auto_create_logs WHERE success = false ORDER BY run_at DESC;
```

### Function Errors

View detailed logs:
```sql
SELECT
  run_at,
  result,
  error
FROM auto_create_logs
WHERE success = false
ORDER BY run_at DESC;
```

### Issues Not Being Auto-Created

Possible reasons:
1. Issue is less than 1 hour old
2. Work order already exists for that checklist
3. Issue is from cleanliness or security section
4. Issue was consolidated with an existing work order (check `work_order_id` in `checklist_issues`)
5. Database function has an error (check `auto_create_logs`)

Test manually:
```sql
SELECT auto_create_pending_work_orders();
```

### Verify Counting Accuracy

Check that `created_count` accurately reflects new work orders:

```sql
-- Compare function result with actual auto-created work orders
SELECT 
  (SELECT COUNT(*) 
   FROM work_orders 
   WHERE description LIKE '[AUTO-CREADO]%' 
     AND created_at > NOW() - INTERVAL '1 day') as actual_created,
  (SELECT result->>'created_count' 
   FROM auto_create_logs 
   WHERE run_at > NOW() - INTERVAL '1 day' 
   ORDER BY run_at DESC 
   LIMIT 1)::int as reported_created;
```

## Configuration

### Change Schedule

To change the cron schedule (e.g., every 30 minutes):

```sql
SELECT cron.unschedule('auto-create-pending-work-orders');
SELECT cron.schedule(
  'auto-create-pending-work-orders',
  '*/30 * * * *',  -- Every 30 minutes
  $$SELECT auto_create_pending_work_orders_with_logging()$$
);
```

### Change Time Threshold

To change from 1 hour to 2 hours, edit the function:

```sql
CREATE OR REPLACE FUNCTION auto_create_pending_work_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- ... (other declarations)
  v_one_hour_ago timestamp;
BEGIN
  -- Change this line:
  v_one_hour_ago := NOW() - INTERVAL '2 hours';  -- Was: '1 hour'

  -- ... (rest of function)
END;
$$;
```

## Benefits

### For Users
- ✅ No lost issues - everything gets processed
- ✅ Automatic prioritization based on severity
- ✅ Smart consolidation reduces duplicate work orders
- ✅ Works even if users close the dialog without creating

### For System
- ✅ Database-level reliability
- ✅ Automatic logging and monitoring
- ✅ No external dependencies
- ✅ Efficient processing
- ✅ Platform independent

## Related Files

- **Migration:** `migrations/sql/20250114_auto_create_pending_work_orders.sql`
- **API Endpoint:** `app/api/checklists/auto-create-pending-work-orders/route.ts`
- **Unresolved Issues API:** `app/api/checklists/unresolved-issues/route.ts`
- **Client Component:** `components/checklists/unresolved-issues-tracker.tsx`

## Support

If you encounter issues:
1. Check `auto_create_logs` table
2. Run the function manually to test
3. Verify pg_cron is running
4. Check database permissions

For questions, contact the development team.
