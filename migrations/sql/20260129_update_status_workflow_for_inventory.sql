-- =====================================================
-- Update Status Workflow for Inventory Purchase Orders
-- Migration: 20260129_update_status_workflow_for_inventory
-- Description: Update get_valid_next_statuses to consider po_purpose
--              Inventory-only POs should skip purchase-related statuses
-- =====================================================

-- =====================================================
-- 1. Update get_valid_next_statuses function to consider po_purpose
-- =====================================================
CREATE OR REPLACE FUNCTION get_valid_next_statuses(
  p_current_status TEXT, 
  p_po_type TEXT,
  p_po_purpose TEXT DEFAULT NULL
) RETURNS TEXT[] AS $$
BEGIN
  -- Special workflow for inventory-only purchase orders
  -- These don't involve purchasing, so skip purchase-related statuses
  IF p_po_purpose = 'work_order_inventory' THEN
    CASE p_current_status
      WHEN 'draft' THEN RETURN ARRAY['pending_approval', 'rejected'];
      WHEN 'pending_approval' THEN RETURN ARRAY['approved', 'rejected'];
      WHEN 'approved' THEN RETURN ARRAY['fulfilled', 'rejected'];  -- Fulfilled instead of purchased
      WHEN 'fulfilled' THEN RETURN ARRAY['validated'];  -- After inventory is issued
      WHEN 'validated' THEN RETURN ARRAY[]::TEXT[]; -- Final state
      WHEN 'rejected' THEN RETURN ARRAY[]::TEXT[]; -- Final state
      ELSE RETURN ARRAY[]::TEXT[];
    END CASE;
  END IF;
  
  -- Original workflow for cash purchases and other purposes
  CASE p_po_type
    WHEN 'direct_purchase', 'direct_service' THEN
      CASE p_current_status
        WHEN 'draft' THEN RETURN ARRAY['pending_approval', 'rejected'];
        WHEN 'pending_approval' THEN RETURN ARRAY['approved', 'rejected'];
        WHEN 'approved' THEN RETURN ARRAY['purchased', 'rejected'];
        WHEN 'purchased' THEN RETURN ARRAY['receipt_uploaded'];
        WHEN 'receipt_uploaded' THEN RETURN ARRAY['validated'];
        WHEN 'validated' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        WHEN 'rejected' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        ELSE RETURN ARRAY[]::TEXT[];
      END CASE;
      
    WHEN 'special_order' THEN
      CASE p_current_status
        WHEN 'draft' THEN RETURN ARRAY['quoted', 'rejected'];
        WHEN 'quoted' THEN RETURN ARRAY['pending_approval', 'rejected'];
        WHEN 'pending_approval' THEN RETURN ARRAY['approved', 'rejected'];
        WHEN 'approved' THEN RETURN ARRAY['ordered', 'rejected'];
        WHEN 'ordered' THEN RETURN ARRAY['received'];
        WHEN 'received' THEN RETURN ARRAY['receipt_uploaded'];
        WHEN 'receipt_uploaded' THEN RETURN ARRAY['validated'];
        WHEN 'validated' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        WHEN 'rejected' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        ELSE RETURN ARRAY[]::TEXT[];
      END CASE;
      
    ELSE
      -- Default/legacy workflow
      CASE p_current_status
        WHEN 'draft' THEN RETURN ARRAY['pending_approval', 'rejected'];
        WHEN 'pending_approval' THEN RETURN ARRAY['approved', 'rejected'];
        WHEN 'approved' THEN RETURN ARRAY['validated'];
        WHEN 'validated' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        WHEN 'rejected' THEN RETURN ARRAY[]::TEXT[]; -- Final state
        ELSE RETURN ARRAY[]::TEXT[];
      END CASE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION get_valid_next_statuses(TEXT, TEXT, TEXT) IS 
'Returns valid next statuses based on current status, PO type, and PO purpose. 
Inventory-only POs (work_order_inventory) use simplified workflow: approved -> fulfilled -> validated';

-- =====================================================
-- 2. Update advance_purchase_order_workflow to use new signature
-- =====================================================
-- First, let's check if this function exists and needs updating
-- The function should fetch po_purpose and pass it to get_valid_next_statuses

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
'Advances purchase order workflow status. Now considers po_purpose for inventory-only POs.';

-- =====================================================
-- 3. Add fulfilled_at column if it doesn't exist
-- =====================================================
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

COMMENT ON COLUMN purchase_orders.fulfilled_at IS 
'Timestamp when inventory-only PO was fulfilled (inventory issued to work order)';

-- =====================================================
-- 4. Update get_allowed_statuses to include 'fulfilled'
-- =====================================================
CREATE OR REPLACE FUNCTION get_allowed_statuses(p_po_type VARCHAR(20), p_po_purpose TEXT DEFAULT NULL)
RETURNS TEXT[] AS $$
BEGIN
  -- Special case: inventory-only POs
  IF p_po_purpose = 'work_order_inventory' THEN
    RETURN ARRAY['draft', 'pending_approval', 'approved', 'fulfilled', 'validated', 'rejected'];
  END IF;
  
  -- Original logic
  CASE p_po_type
    WHEN 'direct_purchase', 'direct_service' THEN 
      RETURN ARRAY['draft', 'pending_approval', 'approved', 'purchased', 'receipt_uploaded', 'validated', 'rejected'];
    WHEN 'special_order' THEN 
      RETURN ARRAY['draft', 'quoted', 'pending_approval', 'approved', 'ordered', 'received', 'receipt_uploaded', 'validated', 'rejected'];
    ELSE 
      RETURN ARRAY['draft', 'pending_approval', 'approved', 'validated', 'rejected'];
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_allowed_statuses(VARCHAR(20), TEXT) IS 
'Returns allowed statuses for a PO type and purpose. Inventory-only POs use simplified workflow.';
