# Plant Attribution Verification Report

**Date:** 2025-02-09  
**Method:** Supabase MCP queries against production database (mantenimiento project)

---

## Summary: Data is Sound

All verification checks passed. No unallocated costs, no orphan data affecting reports.

---

## 1. Edge Case Checks

| Check | Result |
|-------|--------|
| Standalone POs with null plant_id | **0** POs, $0 |
| Work orders with null asset_id that have POs | **0** |
| Assets with null plant_id that have POs | **0** |
| Assets with null plant_id + no history that have POs | **0** |
| POs excluded (null resolved plant) in 2025 date range | **0** |
| All POs have valid date for filtering | **190/190** (100%) |

---

## 2. Unallocated Audit (Complete)

| Category | Count | Amount |
|----------|-------|--------|
| standalone_no_plant | 0 | $0 |
| wo_no_asset | 0 | $0 |
| asset_no_plant_no_history | 0 | $0 |

**Total unallocated:** 0 POs, $0

---

## 3. Asset Data Quality

| Check | Result |
|-------|--------|
| Assets with plant_id NULL | 2 (BP-01-COMPUESTO, BP-02 COMPUESTO) |
| Impact of those 2 assets | 0 WOs, 0 POs, 0 additional expenses — **no cost impact** |
| Assets with orphan plant_id (plant deleted) | 0 |

---

## 4. Cost Source Verification

### Purchase Orders
- **190 POs** with amount > 0
- **190 attributed** (100%) via po.plant_id or asset_assignment_history
- **0 unallocated**
- **Total attributed:** $521,458

### Additional Expenses
- 12 linked to assets; all assets have plant (direct or via history)
- 0 with asset that has no plant and no history
- 0 unlinked (no asset_id)

### Diesel Transactions
- 3,142 transactions (consumption/entry/adjustment, non-transfer)
- **100% have plant_id** set

---

## 5. Executive Report Replication (2025 Full Year)

SQL replication of executive report attribution logic:

| Metric | Value |
|--------|-------|
| POs in range with resolved plant | 140 |
| Total amount | $387,397 |
| Excluded (null plant) | 0 |

---

## 6. Attribution Logic Consistency

All three report APIs use the same pattern:

- **asset_assignment_history** at report end date
- **resolveAssetPlantAtTimestamp** (report end)
- PO plant: `po.plant_id` first, else asset attribution

---

## Conclusion

- No unallocated purchase orders.
- No work orders or assets in problematic states that affect cost attribution.
- Diesel and additional expenses have complete plant coverage.
- The 2 assets with null plant_id have no cost data.

**Verdict: Report attribution is sound. All cost data can be correctly attributed to plants.**
