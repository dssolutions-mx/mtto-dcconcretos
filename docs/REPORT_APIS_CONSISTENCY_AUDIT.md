# Report APIs Consistency Audit

**Date:** 2025-02-09  
**APIs audited:** executive, gerencial, asset-maintenance-summary

---

## Executive Summary

| Finding | Severity | APIs Affected |
|---------|----------|---------------|
| Executive doesn't select `po_purpose` → inventory_restock not excluded | High | executive |
| Gerencial excludes standalone POs entirely | High | gerencial |
| Executive handles standalone POs; gerencial does not | Inconsistency | both |
| Asset-maintenance-summary depends on gerencial (inherits gaps) | Medium | asset-maintenance-summary |
| Additional expenses: executive includes unlinked, gerencial does not | Low | both |

---

## 1. Purchase Order Attribution

### 1.1 Asset/Plant Attribution Logic

| API | Uses asset_assignment_history | Attribution date | PO plant fallback |
|-----|------------------------------|------------------|-------------------|
| executive | ✅ Yes | `dateTo` end-of-day | po.plant_id → asset attribution |
| gerencial | ✅ Yes | `dateTo` end-of-day | N/A (see 1.2) |
| asset-maintenance-summary | ✅ Yes | `dateTo` end-of-day | Via gerencial |

**Consistent:** All use the same attribution helper and report-end timestamp.

### 1.2 PO Filtering by Plant

| API | Method |
|-----|--------|
| executive | Filters POs by plant before aggregation: `po.plant_id` first, else `assetToPlantMap(wo.asset_id)`. Excludes POs that don't match filter. |
| gerencial | Does NOT filter POs by plant. Fetches all POs, only adds to `assetMap.get(wo.asset_id)`. Implicit filtering: asset must be in filtered assets. |
| asset-maintenance-summary | Delegates to gerencial. |

**Issue:** Executive explicitly filters POs; gerencial relies on asset membership. For WO-linked POs both end up correct. For standalone POs see 1.3.

### 1.3 Standalone POs (no work_order_id)

| API | Handles standalone POs? | How |
|-----|-------------------------|-----|
| executive | ✅ Yes | Block at 352–378: adds to plant totals by `po.plant_id` when `!workOrder?.asset_id` |
| gerencial | ❌ No | Only processes `workOrderPOs` (po.work_order_id required). Standalone POs never added. |
| asset-maintenance-summary | ❌ No | Uses gerencial data. |

**Severity: High.** Gerencial undercounts maintenance cost by excluding all standalone POs.

---

## 2. po_purpose / inventory_restock

### 2.1 PO Select Fields

| API | Selects po_purpose? |
|-----|---------------------|
| executive | ❌ No — select at line 147 does not include `po_purpose` |
| gerencial | ✅ Yes — line 212 |

### 2.2 Impact

Executive filters at 349–352:

```ts
const workOrderPOs = filteredPurchaseOrders.filter(po => 
  po.work_order_id && po.po_purpose !== 'inventory_restock'
)
```

Because `po_purpose` is not selected, `po.po_purpose` is always `undefined`.

- `undefined !== 'inventory_restock'` → true for all POs
- All WO-linked POs are treated as workOrderPOs
- inventory_restock POs are not excluded from expenses

**Severity: High.** Executive overcounts by including inventory_restock POs in maintenance cost.

### 2.3 Cash vs inventory expense classification

Executive line 360: `isCashExpense = po.po_purpose !== 'work_order_inventory'`

With `po_purpose` missing, this is always true, so every WO-linked PO is classified as cash expense.

---

## 3. Additional Expenses

| API | Linked to assets | Unlinked (asset_id null) |
|-----|------------------|--------------------------|
| executive | ✅ Counted in plant/BU totals | ✅ Fetched, returned as `unlinkedAdditionalExpenses` |
| gerencial | ✅ Counted | ❌ Not fetched (.in('asset_id', assetIds) only) |

**Inconsistency:** Executive includes unlinked AEs for audit; gerencial ignores them.

---

## 4. Date Handling

| API | Request params | Attribution date |
|-----|----------------|------------------|
| executive | startDate, endDate (z.string().datetime()) | `${dateToStr}T23:59:59.999Z` |
| gerencial | dateFrom, dateTo (no schema) | `${dateTo}T23:59:59.999Z` |

**Risk:** If gerencial receives `dateTo = "2025-12-31T00:00:00.000Z"`, template becomes `"2025-12-31T00:00:00.000ZT23:59:59.999Z"` (invalid). Executive normalizes via `dateToStr`; gerencial does not.

---

## 5. PO Date Priority

Both use the same order:

1. purchase_date  
2. work_order.completed_at  
3. work_order.planned_date  
4. work_order.created_at  
5. po.created_at  

**Consistent.**

---

## 6. Diesel

| API | Source | Filters | Plant attribution |
|-----|--------|---------|-------------------|
| gerencial | diesel_transactions (asset_id) | product_type=diesel, exclude transfers | Via asset → attributed plant |
| asset-maintenance-summary | Fetches diesel, merges with gerencial | product_type=diesel, exclude transfers ✅ | Same |

diesel_transactions.plant_id is not used; attribution is via asset. Both APIs filter diesel only (exclude urea) and exclude transfers. **Consistent.**

---

## 7. Asset-Maintenance-Summary Dependency

- Calls `/api/reports/gerencial` for maintenance_cost, preventive_cost, corrective_cost, diesel_cost, remisiones, concrete.
- Inherits gerencial’s behavior:
  - Standalone POs excluded
  - inventory_restock excluded (gerencial does this correctly)
  - Unlinked AEs excluded

---

## 8. Recommendations (Status)

### Implemented (2025-02-09)

1. **Executive — add `po_purpose` to PO select** ✅
   - Added `po_purpose` to purchase_orders select.
   - Excluded `inventory_restock` in unlinked block (standalone POs).

2. **Gerencial — include standalone POs** ✅
   - Added `standalonePOs` filter (no WO, po_purpose !== 'inventory_restock', has plant_id).
   - Added to plant totals after plantMap build; creates plant entry from plants list when needed.

3. **Date normalization** ✅
   - Gerencial and asset-maintenance-summary now extract YYYY-MM-DD from dateFrom/dateTo when full ISO.
   - Prevents malformed attribution timestamp.

### Audit 2 (2025-02-09) – Final fixes

4. **Gerencial — plantsQuery filter by plantId** ✅
   - When `plantId` filter is applied, `plantsQuery` now includes `.eq('id', plantId)` so `plants` only contains the filtered plant.
   - Prevents standalone POs from other plants being included when filtering by plant.

5. **Asset-maintenance-summary — diesel only, exclude transfers** ✅
   - Added `diesel_warehouses!inner(product_type)` join and `.eq('diesel_warehouses.product_type', 'diesel')` to match Gerencial.
   - Changed `.eq('is_transfer', false)` to `.neq('is_transfer', true)` for consistency.
   - Previously included urea transactions in diesel consumption; now consistent with Gerencial.

6. **Executive — standalone POs for plants with no assets** ✅
   - When processing unlinked POs, if `plantTotals` does not have the plant but it exists in `filteredPlants`, create the plant total and add the PO.
   - Matches Gerencial behavior: standalone POs for plants with zero assets are now counted.

### Not implemented

7. **Gerencial — unlinked additional expenses** — Executive fetches them; gerencial does not. Low priority.
8. **Shared PO plant resolution helper** — Low priority.

---

## 9. Live Data Impact (2025-02-09)

| Metric | Count | Amount |
|--------|-------|--------|
| Standalone POs | 25 | $80,928 |
| inventory_restock POs | 25 | $80,928 |
| work_order_cash POs | 164 | $438,670 |
| work_order_inventory POs | 1 | $1,860 |

**Finding:** All 25 standalone POs are inventory_restock. So:
- **Gerencial** excludes them → correct (inventory restock is not maintenance expense)
- **Executive** adds them to plant totals via unlinked block → overcounts by ~$81k (treats restock as maintenance)

The executive po_purpose bug causes ~$81k overcount. Adding po_purpose to executive select and excluding inventory_restock in the unlinked block would fix it.
