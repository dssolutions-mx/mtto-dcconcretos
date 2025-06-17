-- =====================================================
-- PURCHASE ORDERS ENHANCEMENT MIGRATION
-- Adds support for 3-type purchase order system
-- =====================================================

-- 1. Add new columns to existing purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_type VARCHAR(20) DEFAULT 'special_order';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(15);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS requires_quote BOOLEAN DEFAULT false;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS store_location VARCHAR(255);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS service_provider VARCHAR(255);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS actual_amount DECIMAL(10,2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS quote_required_reason TEXT;

-- 2. Create enums for better type safety
CREATE TYPE purchase_order_type AS ENUM ('direct_purchase', 'direct_service', 'special_order');
CREATE TYPE payment_method_type AS ENUM ('cash', 'transfer', 'card');

-- 3. Update existing columns to use enums (after data migration)
-- This will be done in a separate step to avoid data loss

-- 4. Add constraints for business logic
ALTER TABLE purchase_orders ADD CONSTRAINT chk_po_type 
  CHECK (po_type IN ('direct_purchase', 'direct_service', 'special_order'));

ALTER TABLE purchase_orders ADD CONSTRAINT chk_payment_method 
  CHECK (payment_method IN ('cash', 'transfer', 'card') OR payment_method IS NULL);

-- 5. Add enhanced status workflow
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS enhanced_status VARCHAR(30);

-- 6. Create function to determine if quotation is required
CREATE OR REPLACE FUNCTION requires_quotation(
  p_po_type VARCHAR(20),
  p_amount DECIMAL(10,2)
) RETURNS BOOLEAN AS $$
BEGIN
  CASE p_po_type
    WHEN 'direct_purchase' THEN RETURN FALSE;
    WHEN 'direct_service' THEN RETURN p_amount > 10000;
    WHEN 'special_order' THEN RETURN TRUE;
    ELSE RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get allowed status transitions
CREATE OR REPLACE FUNCTION get_allowed_statuses(p_po_type VARCHAR(20))
RETURNS TEXT[] AS $$
BEGIN
  CASE p_po_type
    WHEN 'direct_purchase', 'direct_service' THEN 
      RETURN ARRAY['draft', 'pending_approval', 'approved', 'purchased', 'receipt_uploaded', 'validated', 'rejected'];
    WHEN 'special_order' THEN 
      RETURN ARRAY['draft', 'quoted', 'pending_approval', 'approved', 'ordered', 'received', 'invoiced', 'rejected'];
    ELSE 
      RETURN ARRAY['draft', 'pending_approval', 'approved', 'rejected'];
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to auto-set requires_quote field
CREATE OR REPLACE FUNCTION set_requires_quote()
RETURNS TRIGGER AS $$
BEGIN
  NEW.requires_quote := requires_quotation(NEW.po_type, NEW.total_amount);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_requires_quote
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_requires_quote();

-- 9. Create validation trigger for status transitions
CREATE OR REPLACE FUNCTION validate_po_status()
RETURNS TRIGGER AS $$
DECLARE
  allowed_statuses TEXT[];
BEGIN
  allowed_statuses := get_allowed_statuses(NEW.po_type);
  
  IF NOT (NEW.status = ANY(allowed_statuses)) THEN
    RAISE EXCEPTION 'Status % not allowed for purchase order type %', NEW.status, NEW.po_type;
  END IF;
  
  -- Validate quotation requirement
  IF NEW.requires_quote AND NEW.status IN ('pending_approval', 'approved') 
     AND (NEW.quotation_url IS NULL OR NEW.quotation_url = '') THEN
    RAISE EXCEPTION 'Quotation required for this purchase order before approval';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_po_status
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_po_status();

-- 10. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_type ON purchase_orders(po_type);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_payment_method ON purchase_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requires_quote ON purchase_orders(requires_quote);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_type ON purchase_orders(status, po_type);

-- 11. Update existing records to have default type
UPDATE purchase_orders 
SET po_type = 'special_order' 
WHERE po_type IS NULL;

-- 12. Create metrics view for reporting
CREATE OR REPLACE VIEW purchase_order_metrics AS
SELECT 
  po_type,
  payment_method,
  COUNT(*) as count,
  SUM(total_amount) as total_amount,
  AVG(total_amount) as avg_amount,
  COUNT(CASE WHEN requires_quote THEN 1 END) as with_quotes,
  COUNT(CASE WHEN NOT requires_quote THEN 1 END) as without_quotes,
  MIN(created_at) as first_order,
  MAX(created_at) as last_order
FROM purchase_orders
WHERE po_type IS NOT NULL
GROUP BY po_type, payment_method;

-- 13. Create function for purchase order workflow automation
CREATE OR REPLACE FUNCTION advance_purchase_order_workflow(
  p_purchase_order_id UUID,
  p_new_status VARCHAR(30),
  p_user_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_po RECORD;
  v_allowed_statuses TEXT[];
  v_result JSONB;
BEGIN
  -- Get current purchase order
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_purchase_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Purchase order not found');
  END IF;
  
  -- Check if status transition is allowed
  v_allowed_statuses := get_allowed_statuses(v_po.po_type);
  
  IF NOT (p_new_status = ANY(v_allowed_statuses)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status transition');
  END IF;
  
  -- Update purchase order
  UPDATE purchase_orders 
  SET 
    status = p_new_status,
    updated_at = NOW(),
    updated_by = p_user_id,
    notes = COALESCE(notes || E'\n' || p_notes, p_notes)
  WHERE id = p_purchase_order_id;
  
  -- Handle specific status changes
  CASE p_new_status
    WHEN 'approved' THEN
      UPDATE purchase_orders 
      SET approval_date = NOW(), approved_by = p_user_id
      WHERE id = p_purchase_order_id;
      
    WHEN 'purchased' THEN
      UPDATE purchase_orders 
      SET purchased_at = NOW()
      WHERE id = p_purchase_order_id;
      
    WHEN 'received', 'validated' THEN
      UPDATE purchase_orders 
      SET actual_delivery_date = NOW()
      WHERE id = p_purchase_order_id;
  END CASE;
  
  RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$ LANGUAGE plpgsql;

-- 14. Create notification trigger for purchase order updates
CREATE OR REPLACE FUNCTION notify_purchase_order_update()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_target_user UUID;
BEGIN
  -- Determine notification content based on status
  CASE NEW.status
    WHEN 'pending_approval' THEN
      v_notification_title := 'Orden de Compra Pendiente de Aprobación';
      v_notification_message := format('OC %s requiere aprobación por $%s', NEW.order_id, NEW.total_amount);
      -- Get appropriate approver based on amount and user's authorization matrix
      
    WHEN 'approved' THEN
      v_notification_title := 'Orden de Compra Aprobada';
      v_notification_message := format('OC %s ha sido aprobada. Proceder con %s', 
        NEW.order_id, 
        CASE NEW.po_type 
          WHEN 'direct_purchase' THEN 'compra'
          WHEN 'direct_service' THEN 'contratación'
          ELSE 'pedido'
        END);
      v_target_user := NEW.requested_by;
      
    WHEN 'rejected' THEN
      v_notification_title := 'Orden de Compra Rechazada';
      v_notification_message := format('OC %s ha sido rechazada', NEW.order_id);
      v_target_user := NEW.requested_by;
  END CASE;
  
  -- Insert notification if we have a target user
  IF v_target_user IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, title, message, type, related_entity, entity_id, priority
    ) VALUES (
      v_target_user, v_notification_title, v_notification_message, 
      'purchase_order', 'purchase_orders', NEW.id, 'medium'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_purchase_order_update
  AFTER INSERT OR UPDATE OF status ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_purchase_order_update();

-- 15. Add comments for documentation
COMMENT ON COLUMN purchase_orders.po_type IS 'Type of purchase order: direct_purchase, direct_service, special_order';
COMMENT ON COLUMN purchase_orders.payment_method IS 'Payment method: cash, transfer, card';
COMMENT ON COLUMN purchase_orders.requires_quote IS 'Whether this PO requires a quotation (auto-calculated)';
COMMENT ON COLUMN purchase_orders.store_location IS 'Store location for direct purchases';
COMMENT ON COLUMN purchase_orders.service_provider IS 'Service provider for direct services';
COMMENT ON COLUMN purchase_orders.actual_amount IS 'Actual amount spent (may differ from estimated)';
COMMENT ON COLUMN purchase_orders.purchased_at IS 'Timestamp when purchase/service was completed';

-- Migration complete 