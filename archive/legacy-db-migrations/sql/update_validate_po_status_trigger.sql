-- =====================================================
-- Update validate_po_status trigger
-- Migration: update_validate_po_status_trigger
-- Description: Update validation to check purchase_order_quotations table instead of legacy quotation_url fields
-- =====================================================

CREATE OR REPLACE FUNCTION validate_po_status()
RETURNS TRIGGER AS $$
DECLARE
  allowed_statuses TEXT[];
  has_quotation BOOLEAN := false;
  quotation_count INTEGER := 0;
BEGIN
  allowed_statuses := get_allowed_statuses(NEW.po_type);
  
  IF NOT (NEW.status = ANY(allowed_statuses)) THEN
    RAISE EXCEPTION 'Status % not allowed for purchase order type %', NEW.status, NEW.po_type;
  END IF;
  
  -- Check for quotations if required and moving to approval/approved
  IF NEW.requires_quote AND NEW.status IN ('pending_approval', 'approved') THEN
    -- First check new structured quotations table
    SELECT COUNT(*) INTO quotation_count
    FROM purchase_order_quotations
    WHERE purchase_order_id = NEW.id;
    
    IF quotation_count > 0 THEN
      has_quotation := true;
    END IF;
    
    -- Fallback: Check legacy quotation_url field (for backward compatibility)
    IF NOT has_quotation AND NEW.quotation_url IS NOT NULL AND NEW.quotation_url != '' THEN
      has_quotation := true;
    END IF;
    
    -- Fallback: Check legacy quotation_urls array field (for backward compatibility)
    IF NOT has_quotation AND NEW.quotation_urls IS NOT NULL AND jsonb_array_length(NEW.quotation_urls) > 0 THEN
      -- Ensure at least one URL is not empty
      SELECT bool_or(trim(url) != '') INTO has_quotation 
      FROM jsonb_array_elements_text(NEW.quotation_urls) AS url;
    END IF;
    
    -- If no quotation found in any location, raise error
    IF NOT has_quotation THEN
      RAISE EXCEPTION 'Quotation required for this purchase order before approval';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION validate_po_status IS 'Validates purchase order status transitions and quotation requirements. Checks purchase_order_quotations table first, then legacy fields for backward compatibility.';
