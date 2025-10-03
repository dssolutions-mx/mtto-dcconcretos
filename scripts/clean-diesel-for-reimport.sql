-- Clean Diesel Transactions for Re-import with Corrected Dates
-- This script removes all existing diesel transactions to allow re-import with correct date parsing

-- ============================================
-- BACKUP CHECK - View what will be deleted
-- ============================================
SELECT 
  p.code as plant_code,
  COUNT(*) as transactions_to_delete,
  MIN(transaction_date) as earliest_date,
  MAX(transaction_date) as latest_date,
  SUM(CASE WHEN dt.transaction_type = 'entry' THEN dt.quantity_liters ELSE -dt.quantity_liters END) as current_inventory
FROM diesel_transactions dt
JOIN plants p ON dt.plant_id = p.id
GROUP BY p.code
ORDER BY p.code;

-- ============================================
-- DELETE ALL DIESEL TRANSACTIONS
-- ============================================
-- This removes all transactions so we can re-import with correct dates
DELETE FROM diesel_transactions;

-- ============================================
-- VERIFICATION
-- ============================================
-- Should return 0 rows
SELECT COUNT(*) as remaining_transactions FROM diesel_transactions;

-- Confirm warehouses still exist
SELECT * FROM diesel_warehouses ORDER BY warehouse_code;

-- Expected warehouses:
-- ALM-001-6 (Plant 1)
-- ALM-002-7 (Plant 2)
-- ALM-003-8 (Plant 3)
-- ALM-004-9 (Plant 4)



