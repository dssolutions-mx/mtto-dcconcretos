-- =====================================================
-- Fix Inventory Purchase Orders with Invalid Status
-- Migration: 20260129_fix_inventory_po_status
-- Description: Fix purchase orders with po_purpose='work_order_inventory'
--              that are in 'purchased' status (invalid for inventory POs).
--              These should be 'fulfilled' if inventory was issued, or 'approved' if not.
-- =====================================================

-- =====================================================
-- Function to fix inventory PO statuses
-- =====================================================
CREATE OR REPLACE FUNCTION fix_inventory_po_statuses()
RETURNS TABLE (
  po_id UUID,
  order_id TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT
) AS $$
DECLARE
  v_po RECORD;
  v_has_movements BOOLEAN;
  v_fixed_count INT := 0;
BEGIN
  -- Find all inventory POs in invalid status
  FOR v_po IN
    SELECT 
      po.id,
      po.order_id as po_order_id,
      po.status,
      po.po_purpose
    FROM purchase_orders po
    WHERE po.po_purpose = 'work_order_inventory'
      AND po.status IN ('purchased', 'receipt_uploaded')  -- Invalid statuses for inventory POs
  LOOP
    -- Check if there are inventory movements (issue) for this PO
    SELECT EXISTS(
      SELECT 1 
      FROM inventory_movements 
      WHERE purchase_order_id = v_po.id 
        AND movement_type = 'issue'
    ) INTO v_has_movements;
    
    -- Determine correct status
    IF v_has_movements THEN
      -- If inventory was issued, status should be 'fulfilled'
      UPDATE purchase_orders
      SET 
        status = 'fulfilled',
        fulfilled_at = COALESCE(
          (SELECT MAX(movement_date) FROM inventory_movements 
           WHERE purchase_order_id = v_po.id AND movement_type = 'issue'),
          NOW()
        ),
        updated_at = NOW()
      WHERE id = v_po.id;
      
      RETURN QUERY
      SELECT 
        v_po.id,
        v_po.po_order_id,
        v_po.status,
        'fulfilled'::TEXT,
        'Inventory was issued, changed from purchased to fulfilled'::TEXT;
      
      v_fixed_count := v_fixed_count + 1;
    ELSE
      -- If no movements yet, status should be 'approved' (waiting for fulfillment)
      UPDATE purchase_orders
      SET 
        status = 'approved',
        updated_at = NOW()
      WHERE id = v_po.id;
      
      RETURN QUERY
      SELECT 
        v_po.id,
        v_po.po_order_id,
        v_po.status,
        'approved'::TEXT,
        'No inventory movements yet, changed from purchased to approved'::TEXT;
      
      v_fixed_count := v_fixed_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fixed % inventory PO statuses', v_fixed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Execute the fix function
-- =====================================================
SELECT * FROM fix_inventory_po_statuses();

-- =====================================================
-- Optional: Drop the function after use (comment out if you want to keep it)
-- =====================================================
-- DROP FUNCTION IF EXISTS fix_inventory_po_statuses();
