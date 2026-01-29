-- =====================================================
-- Debug Purchase Order Workflow Issue
-- Migration: 20260129_debug_po_workflow
-- Description: Diagnostic query for PO cc5ed012-2994-4cba-ab2f-db8c51814a3b
-- =====================================================

-- Check PO details
SELECT 
  id,
  order_id,
  status,
  po_type,
  po_purpose,
  work_order_id,
  total_amount,
  requires_quote,
  created_at,
  updated_at
FROM purchase_orders
WHERE id = 'cc5ed012-2994-4cba-ab2f-db8c51814a3b';

-- Test get_valid_next_statuses function with this PO's data
DO $$
DECLARE
  v_po_status TEXT;
  v_po_type TEXT;
  v_po_purpose TEXT;
  v_valid_statuses TEXT[];
BEGIN
  -- Get PO details
  SELECT status, po_type, po_purpose
  INTO v_po_status, v_po_type, v_po_purpose
  FROM purchase_orders
  WHERE id = 'cc5ed012-2994-4cba-ab2f-db8c51814a3b';
  
  IF v_po_status IS NULL THEN
    RAISE NOTICE 'PO not found';
    RETURN;
  END IF;
  
  RAISE NOTICE 'PO Status: %', v_po_status;
  RAISE NOTICE 'PO Type: %', v_po_type;
  RAISE NOTICE 'PO Purpose: %', v_po_purpose;
  
  -- Test function call
  SELECT get_valid_next_statuses(v_po_status, v_po_type, v_po_purpose)
  INTO v_valid_statuses;
  
  RAISE NOTICE 'Valid next statuses: %', array_to_string(v_valid_statuses, ', ');
  
  -- Check if function exists and has correct signature
  RAISE NOTICE 'Function signature check:';
  SELECT proname, pg_get_function_arguments(oid)
  INTO v_po_status, v_po_type
  FROM pg_proc
  WHERE proname = 'get_valid_next_statuses';
  
  RAISE NOTICE 'Function found: %', v_po_status;
  RAISE NOTICE 'Function arguments: %', v_po_type;
END $$;

-- Check if there are any related inventory movements
SELECT 
  im.id,
  im.movement_type,
  im.quantity,
  im.unit_cost,
  im.total_cost,
  im.movement_date,
  ip.part_number,
  ip.name as part_name
FROM inventory_movements im
LEFT JOIN inventory_parts ip ON ip.id = im.part_id
WHERE im.purchase_order_id = 'cc5ed012-2994-4cba-ab2f-db8c51814a3b'
ORDER BY im.movement_date DESC;

-- Check PO items structure
SELECT 
  id,
  order_id,
  items,
  jsonb_typeof(items) as items_type,
  jsonb_array_length(items) as items_count
FROM purchase_orders
WHERE id = 'cc5ed012-2994-4cba-ab2f-db8c51814a3b';
