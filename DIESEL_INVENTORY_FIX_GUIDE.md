# Diesel Inventory Balance Fix Guide

## Problem Summary

The diesel inventory system was experiencing **critical calculation errors** causing discrepancies between theoretical and physical inventory. The root causes were:

1. **Race Conditions**: Multiple transactions reading the same inventory value simultaneously
2. **Multiple Sources of Truth**: 3 different calculations that could diverge
3. **Out-of-Order Insertions**: Backdated transactions breaking the balance chain
4. **Incremental Trigger Logic**: Warehouse inventory updated independently of transaction balances

## Example: Plant 1 (ALM-001-6) Before Fix

| Calculation Method | Value | Issue |
|-------------------|-------|-------|
| Stored in `diesel_warehouses` | **556.00L** | ❌ Wrong |
| Latest `transaction.current_balance` | **871.00L** | ❌ Wrong |
| **Correct SUM(entries - consumptions)** | **2,121.00L** | ✅ True value |

**Discrepancy**: 1,565L missing (74% error!)

## Solution Implemented

### 1. Database Functions Created

#### `audit_warehouse_balance(warehouse_id)`
Compares all 3 calculation methods and returns status:
- `OK`: Balance verified, no issues
- `MINOR`: Small discrepancy (<10L)
- `MAJOR`: Significant issue (10-100L or <20 chain breaks)
- `CRITICAL`: Severe issue (>100L or >20 chain breaks)

#### `recalculate_warehouse_balances_v3(warehouse_id, initial_balance)`
Fixes all transaction balances by:
1. Acquiring advisory lock (prevents concurrent execution)
2. Processing transactions in chronological order
3. Recalculating `previous_balance` and `current_balance`
4. Updating warehouse inventory to final balance
5. Validating chain integrity

#### `sync_warehouse_balance_v2(warehouse_id)`
Syncs warehouse inventory to match latest transaction balance (replaces faulty incremental trigger).

### 2. UI Enhancements

Added "Balance Health" card to warehouse detail page showing:
- ✅ Green badge: "Balance Verified"
- ⚠️ Yellow badge: "Minor Adjustment Needed"
- 🟠 Orange badge: "Requires Attention"  
- 🔴 Red badge: "Critical"

With buttons to:
- **Verify**: Re-run audit
- **Recalculate**: Fix all balances (creates backup first)

### 3. Scripts Created

#### Diagnostic Script
```bash
npm run tsx scripts/diagnose-diesel-inventory.ts
```
Generates detailed report of all warehouses with discrepancies.

#### Recalculation Script
```bash
# Dry-run (safe, no changes)
npm run tsx scripts/recalculate-diesel-balances.ts

# Execute fixes
npm run tsx scripts/recalculate-diesel-balances.ts --execute

# Fix specific warehouse
npm run tsx scripts/recalculate-diesel-balances.ts --execute --warehouse=ALM-001-6
```

## How to Fix Existing Data

### Option A: Fix from UI (Recommended for Single Warehouses)

1. Navigate to `/diesel/almacen/[warehouse-id]`
2. Look at "Balance Health" card in top row
3. If status is not "OK", click **"Recalculate"** button
4. Confirm the operation
5. Wait for completion (usually 2-10 seconds)
6. Verify status changes to "OK"

### Option B: Fix with Script (For All Warehouses)

```bash
# 1. Run diagnostic to see all issues
npm run tsx scripts/diagnose-diesel-inventory.ts

# 2. Review the report in reports/diesel-inventory/

# 3. Run recalculation (DRY RUN first)
npm run tsx scripts/recalculate-diesel-balances.ts

# 4. If output looks good, execute
npm run tsx scripts/recalculate-diesel-balances.ts --execute

# 5. Check logs for success/failure
```

### Option C: Fix from Database (Emergency)

```sql
-- For a specific warehouse
SELECT public.recalculate_warehouse_balances_v3(
  '2b5ad949-2517-4302-9fad-363726858056'::uuid,  -- warehouse_id
  0  -- initial_balance (usually 0)
);

-- Verify it worked
SELECT public.audit_warehouse_balance(
  '2b5ad949-2517-4302-9fad-363726858056'::uuid
);
```

## Preventing Future Issues

### ✅ Already Implemented:

1. **Advisory Locks**: The recalculation function uses `pg_try_advisory_xact_lock` to prevent concurrent modifications
2. **Audit Trail**: All recalculations are logged in `diesel_balance_audit_log`
3. **Backup Snapshots**: System creates backup before recalculation
4. **UI Validation**: Visual indicators show balance health in real-time

### 🚧 Still TODO (see plan):

1. **Remove Client-Side Calculations**: Forms should not calculate balances, database should
2. **Advisory Locks in Forms**: Add locks to transaction creation endpoints
3. **Validation Layer**: Trigger to catch balance errors automatically
4. **Daily Auto-Reconciliation**: Automated job to detect and fix discrepancies

## API Endpoints

### Audit Balance
```bash
# GET
curl http://localhost:3000/api/diesel/audit-balance?warehouse_id=xxx

# POST
curl -X POST http://localhost:3000/api/diesel/audit-balance \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id": "xxx"}'
```

Response:
```json
{
  "success": true,
  "audit": {
    "warehouse_id": "...",
    "warehouse_code": "ALM-001-6",
    "stored_inventory": 556.00,
    "latest_transaction_balance": 871.00,
    "calculated_sum": 2121.00,
    "discrepancy_stored_vs_calculated": -1565.00,
    "chain_breaks": 6,
    "status": "CRITICAL"
  },
  "recommendations": [
    "⚠️ Immediate recalculation recommended",
    "🔴 Large discrepancy detected (>100L)",
    "🔗 Multiple balance chain breaks detected"
  ]
}
```

### Recalculate Balance
```bash
curl -X POST http://localhost:3000/api/diesel/recalculate-balance \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id": "xxx"}'
```

Response:
```json
{
  "success": true,
  "warehouse_code": "ALM-001-6",
  "old_balance": 556.00,
  "new_balance": 2121.00,
  "change": 1565.00,
  "transactions_processed": 773,
  "corrections_made": 156
}
```

## Monitoring

### Check All Warehouses
```sql
-- Get quick status of all warehouses
SELECT 
  w.warehouse_code,
  w.name,
  (audit_warehouse_balance(w.id)->>'status') as status,
  (audit_warehouse_balance(w.id)->>'discrepancy_stored_vs_calculated')::numeric as discrepancy
FROM diesel_warehouses w
ORDER BY 
  CASE (audit_warehouse_balance(w.id)->>'status')
    WHEN 'CRITICAL' THEN 1
    WHEN 'MAJOR' THEN 2
    WHEN 'MINOR' THEN 3
    ELSE 4
  END,
  ABS((audit_warehouse_balance(w.id)->>'discrepancy_stored_vs_calculated')::numeric) DESC;
```

### View Audit Log
```sql
-- See recent balance corrections
SELECT 
  w.warehouse_code,
  l.action,
  l.old_balance,
  l.new_balance,
  l.corrections_made,
  l.created_at,
  l.notes
FROM diesel_balance_audit_log l
JOIN diesel_warehouses w ON w.id = l.warehouse_id
ORDER BY l.created_at DESC
LIMIT 20;
```

## Troubleshooting

### "Audit shows CRITICAL but balance looks correct"
This means the `current_balance` fields in transactions are correct, but `diesel_warehouses.current_inventory` is out of sync. Run recalculation to sync them.

### "Recalculation doesn't fix the issue"
Check for:
1. Transactions with NULL `transaction_type`
2. Very recent transactions not yet processed
3. Active transactions in progress

### "Chain breaks remain after recalculation"
This shouldn't happen. Check:
```sql
-- Find remaining chain breaks
WITH ordered AS (
  SELECT 
    transaction_id,
    transaction_date,
    previous_balance,
    current_balance,
    LAG(current_balance) OVER (ORDER BY transaction_date, created_at, id) as expected_prev
  FROM diesel_transactions
  WHERE warehouse_id = 'xxx'
  ORDER BY transaction_date, created_at, id
)
SELECT *
FROM ordered
WHERE ABS(COALESCE(previous_balance, 0) - COALESCE(expected_prev, 0)) > 0.01
  AND expected_prev IS NOT NULL;
```

## Files Modified/Created

### New Files:
- `migrations/sql/20251218_diesel_inventory_fix.sql`
- `scripts/diagnose-diesel-inventory.ts`
- `scripts/recalculate-diesel-balances.ts`
- `app/api/diesel/audit-balance/route.ts`
- `app/api/diesel/recalculate-balance/route.ts`
- `DIESEL_INVENTORY_FIX_GUIDE.md`

### Modified Files:
- `app/diesel/almacen/[id]/page.tsx` - Added balance health indicator

### Database Objects Created:
- `public.sync_warehouse_balance_v2(uuid)` - Function
- `public.audit_warehouse_balance(uuid)` - Function
- `public.recalculate_warehouse_balances_v3(uuid, numeric)` - Function
- `public.diesel_balance_audit_log` - Table

## Success Criteria

✅ **Balance Verified**: All 3 calculation methods return the same value (within 0.5L tolerance)

✅ **Chain Integrity**: Each transaction's `previous_balance` equals prior transaction's `current_balance`

✅ **No Negative Balances**: No transaction shows negative inventory

✅ **Audit Status**: All warehouses show "OK" status

✅ **User Confidence**: Visual indicators provide transparency and trust

## Support

For issues or questions:
1. Check audit log: `SELECT * FROM diesel_balance_audit_log ORDER BY created_at DESC;`
2. Run diagnostic script to generate detailed report
3. Review chain breaks and backdated transactions
4. Contact system administrator if issues persist

---

**Last Updated**: 2025-12-18
**Migration Version**: 20251218_diesel_inventory_fix
