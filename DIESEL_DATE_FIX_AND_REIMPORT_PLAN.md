# Diesel Date Fix and Re-import Plan

## 🚨 Critical Issue
**Date Parser Error**: CSV uses `DD/MM/YY` format, but parser reads as `MM/DD/YY`
- Example: `08/02/25` should be **February 8, 2025**, not August 2, 2025

## 📋 Manual Entries We Added (To Preserve)

### Plant 1 (P001)
1. **Opening Inventory**: 2,511 L on January 2, 2025
2. **Adjustment 1**: -1,201 L on June 12, 2025
3. **Adjustment 2**: -240 L on July 15, 2025

### Plant 2 (P002)
1. **Opening Inventory**: 1,585 L on January 3, 2025

### Plant 4 (P004)
1. **Opening Inventory**: 1,314.8 L on January 6, 2025
2. **Missing Entry**: 4,720.3 L on February 8, 2025

## 🔧 Implementation Steps

### Step 1: Fix Date Parser ✅
Update `lib/diesel-parser-utils.ts`:
```typescript
// Change from MM/DD/YY to DD/MM/YY
const day = parseInt(parts[0], 10)     // First part is DAY
const month = parseInt(parts[1], 10)   // Second part is MONTH
```

### Step 2: Create Manual Entry Re-insertion Script
Save SQL for re-adding entries that might be missing after re-import.

### Step 3: Clean Database
Delete all imported diesel transactions (keep manual entries temporarily for reference).

### Step 4: Re-import All Plants
User will re-upload CSV files for all plants with corrected date parsing.

### Step 5: Verify and Add Missing Entries
After re-import:
- Check if opening inventories are present with correct dates
- Check if adjustments were captured
- Re-add any truly missing entries

## 📊 Expected Outcomes After Re-import

### Plant 1
- **Current Inventory**: 838 L
- **Opening Inventory Date**: Will be from CSV (likely Feb 8, 2025 based on line 2)
- **Need to verify**: If opening should be Jan 2 or Feb 8 (CSV shows Feb 8)

### Plant 2
- **Current Inventory**: 5,431.2 L
- **Opening Inventory Date**: Need to check CSV

### Plant 4
- **Current Inventory**: 3,780.4 L
- **Opening Inventory Date**: Need to check CSV

## ⚠️ Important Notes

1. **Opening Inventory Dates**: The CSV might show different dates than what we manually set. After re-import with correct parsing, we'll need to verify if additional adjustments are needed.

2. **The two Plant 1 adjustments** (-1,201 L and -240 L) might not be in the CSV and will need to be re-added.

3. **Plant 4 missing entry** (4,720.3 L) will definitely need to be re-added.

4. **All warehouses are created**: ALM-001-6, ALM-002-7, ALM-003-8, ALM-004-9

## 🎯 SQL Backup of Manual Entries

```sql
-- Re-insert opening inventories if needed
INSERT INTO diesel_transactions (id, transaction_id, plant_id, warehouse_id, product_id, asset_id, asset_category, transaction_type, quantity_liters, transaction_date, notes, created_by, created_at, source_system)
VALUES 
  -- Plant 1 Opening
  (gen_random_uuid(), 'DSL-P001-OPENING-001', 
   (SELECT id FROM plants WHERE code = 'P001'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'general', 'entry', 2511, 
   '2025-01-02 06:00:00', 'Opening Inventory', 
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment'),
  
  -- Plant 2 Opening
  (gen_random_uuid(), 'DSL-P002-OPENING-001',
   (SELECT id FROM plants WHERE code = 'P002'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-002-7'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'general', 'entry', 1585,
   '2025-01-03 06:00:00', 'Opening Inventory',
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment'),
  
  -- Plant 4 Opening
  (gen_random_uuid(), 'DSL-P004-OPENING-001',
   (SELECT id FROM plants WHERE code = 'P004'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-004-9'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'general', 'entry', 1314.8,
   '2025-01-06 06:00:00', 'Opening Inventory',
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment');

-- Re-insert Plant 1 adjustments
INSERT INTO diesel_transactions (id, transaction_id, plant_id, warehouse_id, product_id, asset_id, asset_category, exception_asset_name, transaction_type, quantity_liters, transaction_date, notes, adjustment_reason, adjustment_category, created_by, created_at, source_system)
VALUES 
  -- Plant 1 Adjustment 1
  (gen_random_uuid(), 'DSL-P001-20250612-ADJ1',
   (SELECT id FROM plants WHERE code = 'P001'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'exception', 'Inventory Adjustment',
   'consumption', 1201, '2025-06-12 06:00:00',
   'Inventory adjustment - correction', 'inventory_adjustment', 'manual',
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment'),
  
  -- Plant 1 Adjustment 2
  (gen_random_uuid(), 'DSL-P001-20250715-ADJ2',
   (SELECT id FROM plants WHERE code = 'P001'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'exception', 'Inventory Adjustment',
   'consumption', 240, '2025-07-15 06:00:00',
   'Inventory adjustment - correction', 'inventory_adjustment', 'manual',
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment');

-- Re-insert Plant 4 missing entry
INSERT INTO diesel_transactions (id, transaction_id, plant_id, warehouse_id, product_id, asset_id, asset_category, transaction_type, quantity_liters, transaction_date, notes, created_by, created_at, source_system)
VALUES 
  (gen_random_uuid(), 'DSL-P004-20250208-ENTRY',
   (SELECT id FROM plants WHERE code = 'P004'),
   (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-004-9'),
   'a780e0bc-d693-423e-889d-73a8e7e6d9fc', NULL, 'general', 'entry', 4720.3,
   '2025-02-08 06:00:00', 'Fuel Receipt - Missing from import',
   'c34258ca-cc26-409d-b541-046d53b89b21', NOW(), 'manual_adjustment');
```


