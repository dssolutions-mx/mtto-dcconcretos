-- =====================================================
-- Purchase Order Quotations Comparison System
-- Migration: 20260123_purchase_order_quotations
-- Description: Create purchase_order_quotations table for structured quotation comparison and supplier selection
-- =====================================================

-- =====================================================
-- 1. Create purchase_order_quotations table
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_order_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),  -- Optional: from registry
  supplier_name VARCHAR(255) NOT NULL,        -- Always required (manual or from registry)
  
  -- Quotation details
  quoted_amount DECIMAL(12,2) NOT NULL,
  delivery_days INTEGER,
  payment_terms VARCHAR(100),
  validity_date DATE,                         -- Quotation expiration
  notes TEXT,
  
  -- File storage
  file_url TEXT,
  file_name VARCHAR(255),
  
  -- Selection workflow
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),
  selected_at TIMESTAMPTZ,
  selected_by UUID REFERENCES auth.users(id),
  selection_reason TEXT,                      -- Why this supplier was chosen
  rejection_reason TEXT,                      -- Why others were not chosen
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. Add indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_po_quotations_po_id ON purchase_order_quotations(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_quotations_supplier_id ON purchase_order_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_quotations_status ON purchase_order_quotations(status);
CREATE INDEX IF NOT EXISTS idx_po_quotations_selected ON purchase_order_quotations(purchase_order_id, status) WHERE status = 'selected';

-- =====================================================
-- 3. Add columns to purchase_orders table
-- =====================================================
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS selected_quotation_id UUID REFERENCES purchase_order_quotations(id),
ADD COLUMN IF NOT EXISTS quotation_selection_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quotation_selection_status VARCHAR(50) DEFAULT 'not_required' 
  CHECK (quotation_selection_status IN ('not_required', 'pending_quotations', 'pending_selection', 'selected'));

-- =====================================================
-- 4. Create updated_at trigger function if it doesn't exist
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 5. Add updated_at trigger for purchase_order_quotations
-- =====================================================
CREATE TRIGGER update_po_quotations_updated_at 
  BEFORE UPDATE ON purchase_order_quotations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Update requires_quotation function to skip work_order_inventory
-- =====================================================
CREATE OR REPLACE FUNCTION requires_quotation(
  p_po_type VARCHAR(20),
  p_amount DECIMAL(10,2),
  p_po_purpose VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip if using inventory (no purchase needed)
  IF p_po_purpose = 'work_order_inventory' THEN
    RETURN FALSE;
  END IF;
  
  -- Original logic
  CASE p_po_type
    WHEN 'direct_purchase' THEN RETURN FALSE;
    WHEN 'direct_service' THEN RETURN p_amount >= 5000;
    WHEN 'special_order' THEN RETURN TRUE;
    ELSE RETURN TRUE;
  END CASE;
END;
$$;

-- =====================================================
-- 7. Create function to check if quotation selection is required
-- =====================================================
CREATE OR REPLACE FUNCTION check_quotation_selection_required(
  p_po_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_po RECORD;
  v_quotation_count INTEGER;
BEGIN
  -- Get PO details
  SELECT po_type, total_amount, po_purpose, requires_quote
  INTO v_po
  FROM purchase_orders
  WHERE id = p_po_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Skip if using inventory (no purchase needed)
  IF v_po.po_purpose = 'work_order_inventory' THEN
    RETURN false;
  END IF;
  
  -- Check if quotation is required based on type and amount
  IF NOT v_po.requires_quote THEN
    RETURN false;
  END IF;
  
  -- Count quotations for this PO
  SELECT COUNT(*) INTO v_quotation_count
  FROM purchase_order_quotations
  WHERE purchase_order_id = p_po_id;
  
  -- Require selection if quotations exist
  RETURN v_quotation_count > 0;
END;
$$;

-- =====================================================
-- 8. Create function to update quotation selection status
-- =====================================================
CREATE OR REPLACE FUNCTION update_quotation_selection_status(
  p_po_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_quotation_count INTEGER;
  v_selected_count INTEGER;
  v_selection_required BOOLEAN;
  v_new_status VARCHAR(50);
BEGIN
  -- Check if selection is required
  v_selection_required := check_quotation_selection_required(p_po_id);
  
  IF NOT v_selection_required THEN
    UPDATE purchase_orders
    SET quotation_selection_status = 'not_required',
        quotation_selection_required = false
    WHERE id = p_po_id;
    RETURN;
  END IF;
  
  -- Count quotations
  SELECT COUNT(*) INTO v_quotation_count
  FROM purchase_order_quotations
  WHERE purchase_order_id = p_po_id;
  
  -- Count selected quotations
  SELECT COUNT(*) INTO v_selected_count
  FROM purchase_order_quotations
  WHERE purchase_order_id = p_po_id
    AND status = 'selected';
  
  -- Determine status
  IF v_selected_count > 0 THEN
    v_new_status := 'selected';
  ELSIF v_quotation_count >= 2 THEN
    v_new_status := 'pending_selection';
  ELSIF v_quotation_count > 0 THEN
    v_new_status := 'pending_quotations';
  ELSE
    v_new_status := 'pending_quotations';
  END IF;
  
  -- Update PO
  UPDATE purchase_orders
  SET quotation_selection_status = v_new_status,
      quotation_selection_required = true
  WHERE id = p_po_id;
END;
$$;

-- =====================================================
-- 9. Create trigger to auto-update selection status when quotations change
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_update_quotation_selection_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update status when quotation is inserted, updated, or deleted
  PERFORM update_quotation_selection_status(
    COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_po_quotations_status_update
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_quotations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_quotation_selection_status();

-- =====================================================
-- 10. Create function to select a quotation
-- =====================================================
CREATE OR REPLACE FUNCTION select_quotation(
  p_quotation_id UUID,
  p_user_id UUID,
  p_selection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quotation RECORD;
  v_po RECORD;
BEGIN
  -- Get quotation details
  SELECT * INTO v_quotation
  FROM purchase_order_quotations
  WHERE id = p_quotation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quotation not found');
  END IF;
  
  -- Get PO details
  SELECT * INTO v_po
  FROM purchase_orders
  WHERE id = v_quotation.purchase_order_id;
  
  -- Reject all other quotations for this PO
  UPDATE purchase_order_quotations
  SET status = 'rejected',
      rejection_reason = 'Otra cotización fue seleccionada',
      updated_at = NOW()
  WHERE purchase_order_id = v_quotation.purchase_order_id
    AND id != p_quotation_id
    AND status = 'pending';
  
  -- Select this quotation
  UPDATE purchase_order_quotations
  SET status = 'selected',
      selected_at = NOW(),
      selected_by = p_user_id,
      selection_reason = p_selection_reason,
      updated_at = NOW()
  WHERE id = p_quotation_id;
  
  -- Update PO with selected quotation
  UPDATE purchase_orders
  SET selected_quotation_id = p_quotation_id,
      supplier = v_quotation.supplier_name,
      supplier_id = v_quotation.supplier_id,
      updated_at = NOW()
  WHERE id = v_quotation.purchase_order_id;
  
  -- Update selection status
  PERFORM update_quotation_selection_status(v_quotation.purchase_order_id);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Quotation selected successfully',
    'quotation_id', p_quotation_id
  );
END;
$$;

-- =====================================================
-- 11. Enable RLS (Row Level Security)
-- =====================================================
ALTER TABLE purchase_order_quotations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12. Create RLS policies
-- =====================================================
-- Users can view quotations for POs they have access to
CREATE POLICY "Allow view quotations for accessible POs" ON purchase_order_quotations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_quotations.purchase_order_id
      AND auth.role() = 'authenticated'
    )
  );

-- Users can insert quotations for POs they created or have access to
CREATE POLICY "Allow insert quotations" ON purchase_order_quotations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_quotations.purchase_order_id
      AND (po.requested_by = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- Users can update quotations they created or for POs they manage
CREATE POLICY "Allow update quotations" ON purchase_order_quotations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_quotations.purchase_order_id
      AND (po.requested_by = auth.uid() OR auth.role() = 'authenticated')
    )
  );

-- =====================================================
-- 13. Update set_requires_quote trigger to use new function signature
-- =====================================================
CREATE OR REPLACE FUNCTION set_requires_quote()
RETURNS TRIGGER AS $$
BEGIN
  NEW.requires_quote := requires_quotation(NEW.po_type, NEW.total_amount, NEW.po_purpose);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 14. Add comments for documentation
-- =====================================================
COMMENT ON TABLE purchase_order_quotations IS 'Structured quotations for purchase orders with supplier attribution and comparison support';
COMMENT ON COLUMN purchase_order_quotations.supplier_name IS 'Supplier name (always required, can be from registry or manual entry)';
COMMENT ON COLUMN purchase_order_quotations.quoted_amount IS 'Total amount quoted by supplier';
COMMENT ON COLUMN purchase_order_quotations.status IS 'Quotation status: pending (awaiting selection), selected (chosen), rejected (not chosen)';
COMMENT ON COLUMN purchase_order_quotations.selection_reason IS 'Reason why this quotation was selected (required when selecting)';
COMMENT ON COLUMN purchase_orders.selected_quotation_id IS 'Reference to the selected quotation';
COMMENT ON COLUMN purchase_orders.quotation_selection_required IS 'Whether quotation selection is required before approval';
COMMENT ON COLUMN purchase_orders.quotation_selection_status IS 'Current status of quotation selection workflow';
