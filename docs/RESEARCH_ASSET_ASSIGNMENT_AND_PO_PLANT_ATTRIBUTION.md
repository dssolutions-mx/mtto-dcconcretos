# Research: Asset Assignment & Purchase Order Plant Attribution

**Date:** 2025-02-09  
**Summary:** Analysis of `asset_assignment_history`, how purchase orders get `plant_id`, and how plant attribution affects report results per plant.

---

## 1. Asset Assignment History (`asset_assignment_history`)

### Table Structure

| Column            | Type   | Description                                      |
|-------------------|--------|--------------------------------------------------|
| `id`              | uuid   | Primary key                                      |
| `asset_id`        | uuid   | Asset that moved                                 |
| `previous_plant_id`| uuid  | Plant before the change (NULL if first assignment)|
| `new_plant_id`    | uuid   | Plant after the change (NULL if unassigned)       |
| `changed_by`      | uuid   | User who made the change                         |
| `change_reason`   | text   | Optional notes (e.g. "Plant assignment updated via drag & drop") |
| `created_at`      | timestamptz | When the change occurred                     |

### Where It's Populated

**Only one place:** `app/api/assets/[id]/plant-assignment/route.ts` (PATCH)

- Triggered when a user changes an asset's plant (typically via drag & drop in the UI)
- Inserts one row per change with `previous_plant_id`, `new_plant_id`, `created_at`

### Usage in Reports

- `app/api/reports/executive/route.ts`
- `app/api/reports/gerencial/route.ts`
- `app/api/reports/asset-maintenance-summary/route.ts`

All three use `lib/reporting/asset-plant-attribution.ts`:

- `buildAssignmentHistoryMap()`: Builds a map of asset → assignment records (sorted by date)
- `resolveAssetPlantAtTimestamp()`: Returns the plant an asset was in at a given timestamp

**Current behavior:** Reports resolve plant **as of report end date** (not at each event date).

---

## 2. Purchase Order `plant_id` – Where Does It Come From?

### Finding: **In most cases, it does NOT come from the asset's plant at creation time.**

### Creation Paths

#### A. Legacy Work Order Flow (`generate_purchase_order` RPC)

**File:** `components/work-orders/purchase-order-form.tsx`  
**DB function:** `generate_purchase_order(p_work_order_id, p_supplier, p_items, p_requested_by, p_expected_delivery_date, p_quotation_url)`

**INSERT in DB function:**
```sql
INSERT INTO purchase_orders (
  order_id, work_order_id, supplier, items, total_amount,
  status, requested_by, expected_delivery_date, quotation_url
) VALUES (...)
```

**Result:** `plant_id` is **never set**. The function does not receive or write `plant_id`.

#### B. Adjustment POs (`generate_adjustment_purchase_order` RPC)

Same pattern. The INSERT does not include `plant_id`. **Not set.**

#### C. Typed Create API (DirectPurchase, DirectService, SpecialOrder)

**Service:** `lib/services/purchase-order-service.ts` → `createTypedPurchaseOrder`  
Writes `plant_id: request.plant_id` when provided.

**Frontend behavior:**

| Form                | When `plant_id` is passed                                      |
|---------------------|----------------------------------------------------------------|
| DirectServiceForm   | **Only for standalone POs** (`!workOrderId && selectedPlantId`) |
| DirectPurchaseForm  | Only when `selectedPlantId` is set (user-selected plant)       |
| SpecialOrderForm    | When `selectedPlantId` is set                                  |

For **WO-linked** purchase orders:

- DirectServiceForm: **Explicitly does NOT pass** `plant_id`
- DirectPurchaseForm: Only passes if user manually selected a plant (uncommon when coming from WO)
- SpecialOrderForm: May pass `selectedPlantId` if user picked one

The forms **do** fetch `plant_id` from the work order or asset for *inventory availability checks* (e.g. `workOrder?.plant_id || workOrder?.asset?.plant_id`), but they **do not** send that value into the create request for WO-linked POs in most cases.

### Conclusion on PO `plant_id`

| Source                          | Sets `plant_id`? |
|---------------------------------|------------------|
| `generate_purchase_order`       | ❌ No            |
| `generate_adjustment_purchase_order` | ❌ No       |
| DirectServiceForm (WO-linked)    | ❌ No            |
| DirectPurchaseForm (WO-linked)   | ⚠️ Only if user selects plant |
| SpecialOrderForm (WO-linked)     | ⚠️ Only if user selects plant |
| Standalone typed POs            | ✅ From `selectedPlantId`      |

**Most WO-linked purchase orders have `plant_id = NULL`.**

---

## 3. Work Order `plant_id`

### Creation Paths

| Creation path                         | Sets `plant_id`? |
|--------------------------------------|------------------|
| `generate_corrective_work_order_enhanced` | ❌ No        |
| `generate_preventive_work_order`      | ❌ No            |
| `generate_work_order_from_incident`   | ❌ No            |
| `work-order-form.tsx` (manual insert) | ❌ No            |

The schema includes `work_orders.plant_id`, but no creation path populates it. **Many work orders also have `plant_id = NULL`.**

---

## 4. Current Report Attribution Logic

### Executive Report (`app/api/reports/executive/route.ts`)

1. Build asset → plant map using `asset_assignment_history` **as of report end date**.
2. For each PO:
   - Use `po.plant_id` if present
   - If null and `po.work_order_id` exists: get WO → asset → attributed plant from step 1

So when `po.plant_id` is null (common for WO-linked POs), attribution comes from **where the asset was at report end date**.

### Gerencial / Asset-Maintenance-Summary

Similar pattern: asset plant resolved at report end date; PO/expense plant inferred from asset attribution.

---

## 5. Impact on Plant-Level Results

### Scenario: Asset moves from Plant A to Plant B

- Jan–Jun: asset in Plant A, maintenance/POs created
- Jul: asset moved to Plant B (logged in `asset_assignment_history`)
- Report: Jan 1–Dec 31

**Current logic (as-of report end):**

- All costs (including Jan–Jun) are attributed to **Plant B** because at report end the asset is in Plant B.

**Desired behavior (event-time attribution):**

- Jan–Jun costs → Plant A  
- Jul–Dec costs → Plant B  

### Scenario: Asset never moves

- Attribution aligns with asset location as long as reports use the same end date.

### Scenario: PO has `plant_id` populated (standalone or manually selected plant)

- Reports use `po.plant_id` first, so attribution matches user intent for those POs.

---

## 6. Recommendations

### 1. Populate `plant_id` at creation (best long-term fix)

**Purchase orders:**

- Extend `generate_purchase_order` and `generate_adjustment_purchase_order` to derive and set `plant_id`:
  - From `work_orders.plant_id` when available, else
  - From `assets.plant_id` via `work_orders.asset_id`
- For typed create API: when `work_order_id` is present and `plant_id` is not provided, derive from WO/asset and pass it.

**Work orders:**

- In `generate_corrective_work_order_enhanced`, `generate_preventive_work_order`, `generate_work_order_from_incident`: set `plant_id` from the asset’s current plant.
- In `work-order-form.tsx`: include `plant_id` from the selected asset’s plant in the insert.

### 2. Event-time attribution in reports (for historical accuracy)

- For each PO, use `resolveAssetPlantAtTimestamp(assetId, po.purchase_date || po.created_at, ...)` instead of a single resolution at report end date.
- Apply the same logic to maintenance costs and other expenses when attribution depends on asset location.

### 3. Backfill existing records (optional)

- One-time migration to set `work_orders.plant_id` and `purchase_orders.plant_id` from the asset’s current plant (or from assignment history at creation time if available) for rows where these fields are null.

---

## 7. Live Data Investigation (2025-02-09)

Script: `scripts/investigate-plant-attribution.ts`

| Metric | Value |
|--------|-------|
| POs with plant_id set | 12.7% (35/276) |
| WO-linked POs with plant_id NULL | 241 |
| WOs with plant_id set | 5.4% (35/647) |
| Assets with assignment history | 29 (39.7% of 73) |

**Totals by plant (last 12 months):** Using po.plant_id only = $90,776 (4 plants). Using asset_assignment_history = $521,458 (5 plants). Reports rely on asset attribution for ~87% of POs.

**Purpose of plant_id on WO/PO (even when attribution uses history):** RLS, standalone POs (no asset), event-time snapshot, performance (direct WHERE), business rule choice, direct filtering.

---

## 8. Summary

| Topic                     | Finding                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `asset_assignment_history`| Populated only when plant is changed via plant-assignment API           |
| PO `plant_id` at creation | **Not** set from asset plant in legacy DB functions or most typed forms |
| WO `plant_id` at creation | **Not** set by any creation path                                        |
| Report attribution       | Uses asset plant as of report end when `po.plant_id` is null            |
| Asset moves              | Can misattribute past costs to the plant at report end                  |
| Live data                | ~87% of POs have null plant_id; asset attribution is primary            |
| plant_id purpose         | RLS, standalone POs, event-time snapshot, performance, direct filtering |

The assumption that purchase orders are created with `plant_id` filled by the asset’s plant at creation time is **not** implemented. Most WO-linked POs have null `plant_id`, and reports fall back to asset attribution at report end date.
