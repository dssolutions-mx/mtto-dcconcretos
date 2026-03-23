-- =====================================================
-- Purchase Order Purpose Classification
-- Migration: 20260125_add_po_purpose
-- Description: Add po_purpose field to distinguish cash purchases vs inventory usage
-- =====================================================

-- =====================================================
-- 1. Add po_purpose Column
-- =====================================================
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS po_purpose TEXT 
  CHECK (po_purpose IN (
    'work_order_cash',           -- Buy parts for WO (cash expense)
    'work_order_inventory',      -- Use inventory for WO (no cash)
    'inventory_restock',         -- Restock inventory (deferred expense)
    'mixed'                      -- Partial from each
  ))
  DEFAULT 'work_order_cash';

COMMENT ON COLUMN purchase_orders.po_purpose IS 'Purpose of PO: work_order_cash (buy for WO), work_order_inventory (use inventory), inventory_restock (buy for stock), mixed (both)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_purpose ON purchase_orders(po_purpose);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_order_purpose ON purchase_orders(work_order_id, po_purpose);

-- =====================================================
-- 2. Backfill Existing POs
-- =====================================================
-- Set purpose for existing purchase orders based on current flags
UPDATE purchase_orders
SET po_purpose = CASE
  WHEN work_order_id IS NULL THEN 'inventory_restock'
  WHEN fulfillment_source = 'inventory' THEN 'work_order_inventory'
  WHEN fulfillment_source = 'mixed' THEN 'mixed'
  ELSE 'work_order_cash'
END
WHERE po_purpose = 'work_order_cash'; -- Only update defaults

-- =====================================================
-- 3. Create View for Expense Classification
-- =====================================================
CREATE OR REPLACE VIEW purchase_orders_expense_classification AS
SELECT 
  po.*,
  CASE 
    WHEN po.po_purpose = 'work_order_inventory' THEN 0
    WHEN po.po_purpose = 'inventory_restock' THEN 0
    ELSE COALESCE(po.actual_amount, po.total_amount, 0)
  END as cash_impact_this_month,
  CASE 
    WHEN po.po_purpose = 'work_order_inventory' THEN COALESCE(po.actual_amount, po.total_amount, 0)
    ELSE 0
  END as inventory_value_consumed,
  CASE 
    WHEN po.po_purpose = 'inventory_restock' THEN COALESCE(po.actual_amount, po.total_amount, 0)
    ELSE 0
  END as inventory_investment
FROM purchase_orders po;

COMMENT ON VIEW purchase_orders_expense_classification IS 'Classifies PO expenses as cash, inventory consumption, or inventory investment';
