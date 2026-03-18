-- Fix PGRST203: Remove overloaded advance_purchase_order_workflow functions
-- so PostgREST can resolve a single candidate

-- Drop all possible overloads (VARCHAR vs TEXT, with/without p_notes)
DROP FUNCTION IF EXISTS advance_purchase_order_workflow(uuid, varchar, uuid, text);
DROP FUNCTION IF EXISTS advance_purchase_order_workflow(uuid, text, uuid, text);

-- Recreate single canonical function (body from 20260129_update_status_workflow_for_inventory)
CREATE OR REPLACE FUNCTION advance_purchase_order_workflow(
  p_purchase_order_id UUID,
  p_new_status TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_po_type TEXT;
  v_po_purpose TEXT;
  v_valid_next_statuses TEXT[];
  v_result JSONB;
BEGIN
  -- Get current PO details
  SELECT status, po_type, po_purpose
  INTO v_current_status, v_po_type, v_po_purpose
  FROM purchase_orders
  WHERE id = p_purchase_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Purchase order not found'
    );
  END IF;
  
  -- Get valid next statuses considering po_purpose
  v_valid_next_statuses := get_valid_next_statuses(v_current_status, v_po_type, v_po_purpose);
  
  -- Validate transition
  IF NOT (p_new_status = ANY(v_valid_next_statuses)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Invalid status transition from %s to %s. Valid next statuses: %s', 
        v_current_status, p_new_status, array_to_string(v_valid_next_statuses, ', '))
    );
  END IF;
  
  -- Update status
  UPDATE purchase_orders
  SET 
    status = p_new_status,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_purchase_order_id;
  
  -- Set approval fields if moving to approved
  IF p_new_status = 'approved' THEN
    UPDATE purchase_orders
    SET 
      approved_by = p_user_id,
      approval_date = NOW()
    WHERE id = p_purchase_order_id;
  END IF;
  
  -- Set purchased_at if moving to purchased
  IF p_new_status = 'purchased' THEN
    UPDATE purchase_orders
    SET purchased_at = NOW()
    WHERE id = p_purchase_order_id;
  END IF;
  
  -- Set fulfilled_at if moving to fulfilled (for inventory POs)
  IF p_new_status = 'fulfilled' THEN
    UPDATE purchase_orders
    SET fulfilled_at = NOW()
    WHERE id = p_purchase_order_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Status updated from %s to %s', v_current_status, p_new_status),
    'new_status', p_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION advance_purchase_order_workflow(UUID, TEXT, UUID, TEXT) IS
'Advances purchase order workflow status. Single canonical version. Considers po_purpose for inventory-only POs.';
