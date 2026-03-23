-- =====================================================
-- Update Direct Purchase Quotation Requirement
-- Migration: update_direct_purchase_requires_quotation
-- Description: Update requires_quotation function so DIRECT_PURCHASE also requires quotation >= $5,000 MXN
-- =====================================================

-- Update requires_quotation function
CREATE OR REPLACE FUNCTION requires_quotation(
    po_type purchase_order_type,
    amount NUMERIC,
    po_purpose purchase_order_purpose DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Skip quotation if using inventory (no purchase needed)
    IF po_purpose = 'work_order_inventory' THEN
        RETURN FALSE;
    END IF;

    CASE po_type
        WHEN 'direct_purchase' THEN
            -- Requires quotation if >= $5,000 MXN (UPDATED from always FALSE)
            RETURN amount >= 5000;
        WHEN 'direct_service' THEN
            -- Requires quotation if >= $5,000 MXN
            RETURN amount >= 5000;
        WHEN 'special_order' THEN
            -- Always requires quotation
            RETURN TRUE;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION requires_quotation IS 'Returns TRUE if a purchase order requires quotation: DIRECT_PURCHASE >= $5k, DIRECT_SERVICE >= $5k, SPECIAL_ORDER always';
