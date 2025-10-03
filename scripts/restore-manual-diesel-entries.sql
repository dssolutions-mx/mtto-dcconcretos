-- Restore Manual Diesel Entries
-- Run this AFTER re-importing CSV files to add back entries that were missing from the import

-- ============================================
-- OPENING INVENTORIES
-- ============================================
-- Note: Only run these if they're not already present from the CSV import
-- Check first by querying the transaction_date of the first entry for each plant

INSERT INTO diesel_transactions (
  id, transaction_id, plant_id, warehouse_id, product_id, 
  asset_id, asset_category, transaction_type, quantity_liters, 
  transaction_date, notes, created_by, created_at, source_system
)
VALUES 
  -- Plant 1 Opening: 2,511 L on January 2, 2025
  (
    gen_random_uuid(), 
    'DSL-P001-OPENING-001', 
    (SELECT id FROM plants WHERE code = 'P001'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'general', 
    'entry', 
    2511, 
    '2025-01-02 06:00:00', 
    'Opening Inventory - Manual Entry', 
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  ),
  
  -- Plant 2 Opening: 1,585 L on January 3, 2025
  (
    gen_random_uuid(), 
    'DSL-P002-OPENING-001',
    (SELECT id FROM plants WHERE code = 'P002'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-002-7'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'general', 
    'entry', 
    1585,
    '2025-01-03 06:00:00', 
    'Opening Inventory - Manual Entry',
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  ),
  
  -- Plant 4 Opening: 1,314.8 L on January 6, 2025
  (
    gen_random_uuid(), 
    'DSL-P004-OPENING-001',
    (SELECT id FROM plants WHERE code = 'P004'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-004-9'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'general', 
    'entry', 
    1314.8,
    '2025-01-06 06:00:00', 
    'Opening Inventory - Manual Entry',
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  );

-- ============================================
-- PLANT 1 ADJUSTMENTS
-- ============================================

INSERT INTO diesel_transactions (
  id, transaction_id, plant_id, warehouse_id, product_id, 
  asset_id, asset_category, exception_asset_name, transaction_type, 
  quantity_liters, transaction_date, notes, adjustment_reason, 
  adjustment_category, created_by, created_at, source_system
)
VALUES 
  -- Plant 1 Adjustment 1: -1,201 L on June 12, 2025
  (
    gen_random_uuid(), 
    'DSL-P001-20250612-ADJ1',
    (SELECT id FROM plants WHERE code = 'P001'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'exception', 
    'Inventory Adjustment',
    'consumption', 
    1201, 
    '2025-06-12 06:00:00',
    'Inventory adjustment - Manual correction', 
    'inventory_adjustment', 
    'manual',
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  ),
  
  -- Plant 1 Adjustment 2: -240 L on July 15, 2025
  (
    gen_random_uuid(), 
    'DSL-P001-20250715-ADJ2',
    (SELECT id FROM plants WHERE code = 'P001'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-001-6'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'exception', 
    'Inventory Adjustment',
    'consumption', 
    240, 
    '2025-07-15 06:00:00',
    'Inventory adjustment - Manual correction', 
    'inventory_adjustment', 
    'manual',
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  );

-- ============================================
-- PLANT 4 MISSING ENTRY
-- ============================================

INSERT INTO diesel_transactions (
  id, transaction_id, plant_id, warehouse_id, product_id, 
  asset_id, asset_category, transaction_type, quantity_liters, 
  transaction_date, notes, created_by, created_at, source_system
)
VALUES 
  -- Plant 4 Missing Entry: 4,720.3 L on February 8, 2025
  (
    gen_random_uuid(), 
    'DSL-P004-20250208-ENTRY',
    (SELECT id FROM plants WHERE code = 'P004'),
    (SELECT id FROM diesel_warehouses WHERE warehouse_code = 'ALM-004-9'),
    'a780e0bc-d693-423e-889d-73a8e7e6d9fc', 
    NULL, 
    'general', 
    'entry', 
    4720.3,
    '2025-02-08 06:00:00', 
    'Fuel Receipt - Missing from import',
    'c34258ca-cc26-409d-b541-046d53b89b21', 
    NOW(), 
    'manual_adjustment'
  );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check current inventory after adding entries
SELECT 
  p.code as plant_code,
  p.name as plant_name,
  COUNT(*) as total_transactions,
  SUM(CASE WHEN dt.transaction_type = 'entry' THEN dt.quantity_liters ELSE 0 END) as total_entries,
  SUM(CASE WHEN dt.transaction_type = 'consumption' THEN dt.quantity_liters ELSE 0 END) as total_consumption,
  SUM(CASE WHEN dt.transaction_type = 'entry' THEN dt.quantity_liters ELSE -dt.quantity_liters END) as current_inventory
FROM diesel_transactions dt
JOIN plants p ON dt.plant_id = p.id
WHERE p.code IN ('P001', 'P002', 'P004')
GROUP BY p.code, p.name
ORDER BY p.code;

-- Expected Results:
-- Plant 1: 838.00 L
-- Plant 2: 5,431.20 L
-- Plant 4: 3,780.40 L



