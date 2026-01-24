# PO Purpose Classification - Implementation Summary

## Completed Changes

### ✅ Phase 1: Database Schema
- Created migration: `migrations/sql/20260125_add_po_purpose.sql`
- Added `po_purpose` column to `purchase_orders` table
- Created indexes for performance
- Created `purchase_orders_expense_classification` view
- Backfill script for existing POs included

**Note**: Migration file ready but not yet applied to database. Apply with Supabase MCP or SQL editor.

### ✅ Phase 2: TypeScript Types
**File**: `types/purchase-orders.ts`
- Added `POPurpose` enum with 4 values
- Updated `EnhancedPurchaseOrder` interface
- Updated `CreatePurchaseOrderRequest` interface

**File**: `types/index.ts`
- Extended `PurchaseOrder` type to include `po_purpose`

### ✅ Phase 3: PO Service Updates
**File**: `lib/services/purchase-order-service.ts`
- Updated `createTypedPurchaseOrder` to accept and store `po_purpose`
- Auto-determines purpose: `work_order_cash` if has WO, `inventory_restock` if standalone

### ✅ Phase 4: PO Creation Forms
Updated all three form components to check inventory and set purpose:

**File**: `components/purchase-orders/creation/DirectPurchaseForm.tsx`
- Checks inventory availability before creation
- Prompts user if all parts available in inventory
- Sets `po_purpose` to `work_order_inventory` if user confirms
- Defaults to `work_order_cash` if parts not available or user declines

**File**: `components/purchase-orders/creation/DirectServiceForm.tsx`
- Sets `po_purpose` to `work_order_cash` (services not in inventory)
- Consistent with other forms

**File**: `components/purchase-orders/creation/SpecialOrderForm.tsx`
- Checks inventory availability
- Prompts user if parts available
- Sets appropriate `po_purpose`

### ✅ Phase 5: Approval UI Updates
**File**: `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx`
- Added cash impact indicator alert
- Shows different colors and messages for each purpose:
  - Blue: Inventory usage (no cash)
  - Purple: Restocking (deferred expense)
  - Orange: Cash purchase (immediate expense)
- Displays "Impacto en Efectivo: $0" for inventory POs

**File**: `components/work-orders/purchase-orders-list.tsx`
- Updated quick approval dialog
- Shows PO purpose badges
- Displays cash impact vs total amount
- Added `Warehouse` icon import
- Updated `PurchaseOrderWithWorkOrder` interface

### ✅ Phase 6: Expense Report Fixes
**File**: `app/api/reports/gerencial/route.ts`
- Updated PO query to include `po_purpose, fulfillment_source, received_to_inventory`
- Filters out restocking POs from expense calculations
- Separates cash vs inventory expenses
- Tracks both separately in asset metrics
- Added `cash_flow_summary` to response with:
  - `cash_expenses`: Only cash POs
  - `inventory_expenses`: Only inventory POs
  - `total_expenses`: Sum of both
  - `restocking_excluded`: Amount excluded from expenses
  - `restocking_pos_count`: Number of restocking POs excluded

**File**: `app/api/reports/executive/route.ts`
- Updated PO query to include new fields
- Filters restocking POs
- Tracks cash vs inventory expenses separately

---

## How It Works Now

### Scenario 1: Create PO for WO with Parts in Inventory
```
1. Technician creates PO for 10 filters
2. System checks inventory: ✅ 15 available
3. Prompt: "Use inventory (no cash) or buy new?"
4. If "Yes": po_purpose = 'work_order_inventory'
5. Manager sees: 
   - Total: $450
   - Cash Impact: $0
   - Type: "Solicitud de Uso de Inventario"
6. Approval based on work justification, NOT cash
7. Expense report: 
   - Cash: $0
   - Inventory consumed: $450
   - Total expense: $450
```

### Scenario 2: Create PO for WO without Parts
```
1. Technician creates PO for 10 filters
2. System checks inventory: ❌ 0 available
3. Auto-set: po_purpose = 'work_order_cash'
4. Manager sees:
   - Total: $500
   - Cash Impact: $500
   - Type: "Compra Directa con Efectivo"
5. Approval based on budget AND cash availability
6. Expense report:
   - Cash: $500
   - Inventory consumed: $0
   - Total expense: $500
```

### Scenario 3: Create Standalone PO (Restocking)
```
1. Admin creates PO for 20 filters (no WO link)
2. Auto-set: po_purpose = 'inventory_restock'
3. Manager sees:
   - Total: $1,000
   - Cash Impact: $1,000
   - Type: "Compra para Reabastecimiento"
   - Note: "Gasto se reconoce cuando se usen"
4. Approval for inventory investment
5. Expense report:
   - Excluded from monthly expenses (goes to balance sheet)
   - Expense recognized when parts are later issued to WOs
```

---

## Key Benefits

1. **Correct Approval Context**
   - Managers see $0 cash for inventory POs
   - Approval criteria differ: work justification vs budget availability

2. **No Double-Counting**
   - Restocking POs excluded from expense reports
   - Only counted when inventory is consumed

3. **Proper Cash Flow Tracking**
   - Cash expenses separated from inventory consumption
   - Balance sheet vs P&L distinction clear

4. **Maintained Authorization Control**
   - All inventory usage still requires PO approval
   - No unauthorized part grabbing
   - Complete audit trail maintained

---

## Next Steps

### To Complete Deployment:

1. **Apply Migration**
   ```bash
   # Apply via Supabase SQL Editor or
   # Use Supabase MCP to apply migration file
   ```

2. **Verify Database**
   ```sql
   SELECT po_purpose, COUNT(*) 
   FROM purchase_orders 
   GROUP BY po_purpose;
   ```

3. **Test Workflows**
   - Create PO with inventory → Check shows as inventory type
   - Create PO without inventory → Check shows as cash type
   - Approve each type → Verify different context shown
   - Run expense report → Verify correct amounts

4. **Monitor Initial Results**
   - Check first week of PO creations
   - Verify managers understand new context
   - Adjust reorder points if needed
   - Review excluded restocking amounts

---

## Files Modified

### Database
- `migrations/sql/20260125_add_po_purpose.sql` (NEW)

### Types
- `types/purchase-orders.ts`
- `types/index.ts`

### Services
- `lib/services/purchase-order-service.ts`

### Forms
- `components/purchase-orders/creation/DirectPurchaseForm.tsx`
- `components/purchase-orders/creation/DirectServiceForm.tsx`
- `components/purchase-orders/creation/SpecialOrderForm.tsx`

### UI Components
- `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx`
- `components/work-orders/purchase-orders-list.tsx`

### API Routes
- `app/api/reports/gerencial/route.ts`
- `app/api/reports/executive/route.ts`

---

## Important Notes

1. **Migration Must Be Applied**: The database migration must be run for the system to fully work
2. **Backward Compatible**: Default value ensures existing code continues to work
3. **No Breaking Changes**: All existing POs will be backfilled appropriately
4. **Gradual Rollout**: Can deploy schema first, then UI updates
5. **Testing Required**: Test approval workflow with both cash and inventory POs

---

**Status**: Code implementation complete, ready for database migration and testing.
