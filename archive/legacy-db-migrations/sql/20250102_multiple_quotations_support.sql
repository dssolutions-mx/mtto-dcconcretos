-- Migration: Support Multiple Quotation Files
-- Date: 2025-01-02
-- Description: Updates purchase_orders table to support multiple quotation URLs

-- Add new column for multiple quotation URLs
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS quotation_urls JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single quotation_url to quotation_urls array
UPDATE purchase_orders 
SET quotation_urls = 
  CASE 
    WHEN quotation_url IS NOT NULL AND quotation_url != '' 
    THEN jsonb_build_array(quotation_url)
    ELSE '[]'::jsonb
  END
WHERE quotation_urls = '[]'::jsonb;

-- Add index for better performance on JSONB column
CREATE INDEX IF NOT EXISTS idx_purchase_orders_quotation_urls 
ON purchase_orders USING GIN (quotation_urls);

-- Create helper function to check if quotations exist
CREATE OR REPLACE FUNCTION has_quotations(p_purchase_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_quotation_urls JSONB;
BEGIN
  SELECT quotation_urls INTO v_quotation_urls
  FROM purchase_orders
  WHERE id = p_purchase_order_id;
  
  -- Check if array has at least one non-empty URL
  RETURN (
    v_quotation_urls IS NOT NULL 
    AND jsonb_array_length(v_quotation_urls) > 0
  );
END;
$$;

-- Update the advance_purchase_order_workflow function to check for multiple quotations
-- This ensures the business logic works with the new structure
CREATE OR REPLACE FUNCTION advance_purchase_order_workflow(
  p_purchase_order_id UUID,
  p_new_status TEXT,
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_po_type TEXT;
  v_requires_quote BOOLEAN;
  v_has_quotations BOOLEAN;
  v_payment_method TEXT;
  v_max_payment_date TIMESTAMPTZ;
  v_allowed_statuses TEXT[];
BEGIN
  -- Get current PO details
  SELECT status, po_type, requires_quote, payment_method, max_payment_date
  INTO v_current_status, v_po_type, v_requires_quote, v_payment_method, v_max_payment_date
  FROM purchase_orders
  WHERE id = p_purchase_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;

  -- Check if quotations exist using the new helper function
  v_has_quotations := has_quotations(p_purchase_order_id);

  -- Get valid next statuses
  SELECT get_valid_next_statuses(v_current_status, v_po_type)
  INTO v_allowed_statuses;

  -- Validate that new status is allowed
  IF NOT (p_new_status = ANY(v_allowed_statuses)) THEN
    RAISE EXCEPTION 'Invalid status transition from % to % for po_type %', 
      v_current_status, p_new_status, v_po_type;
  END IF;

  -- Business rule: Cannot approve if quotation is required but not provided
  IF p_new_status = 'approved' AND v_requires_quote AND NOT v_has_quotations THEN
    RAISE EXCEPTION 'Cannot approve: quotation is required but not uploaded';
  END IF;

  -- Business rule: Cannot mark as purchased without max_payment_date for transfers
  IF p_new_status = 'purchased' AND v_payment_method = 'transfer' THEN
    IF v_max_payment_date IS NULL THEN
      RAISE EXCEPTION 'Cannot mark as purchased: max_payment_date is required for transfer payments';
    END IF;
  END IF;

  -- Update the purchase order
  UPDATE purchase_orders
  SET 
    status = p_new_status,
    updated_at = NOW(),
    updated_by = p_user_id,
    notes = CASE 
      WHEN p_notes IS NOT NULL THEN p_notes 
      ELSE notes 
    END,
    -- Set approval fields if being approved
    approved_by = CASE 
      WHEN p_new_status = 'approved' THEN p_user_id 
      ELSE approved_by 
    END,
    authorization_date = CASE 
      WHEN p_new_status = 'approved' THEN NOW() 
      ELSE authorization_date 
    END,
    -- Set purchased_at if being marked as purchased
    purchased_at = CASE 
      WHEN p_new_status = 'purchased' THEN NOW() 
      ELSE purchased_at 
    END
  WHERE id = p_purchase_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Status updated from %s to %s', v_current_status, p_new_status),
    'new_status', p_new_status
  );
END;
$$;

-- Comment explaining the migration
COMMENT ON COLUMN purchase_orders.quotation_urls IS 
  'Array of quotation file URLs stored as JSONB. Replaces single quotation_url for multiple file support.';

COMMENT ON COLUMN purchase_orders.quotation_url IS 
  'Legacy single quotation URL. Kept for backwards compatibility. New uploads should use quotation_urls array.';

