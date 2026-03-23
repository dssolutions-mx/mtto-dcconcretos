-- =====================================================
-- Inventory System - Triggers and Functions
-- Migration: 20250125_004_create_inventory_triggers
-- Description: Create triggers for data integrity, cost updates, and automatic unreserve
-- =====================================================

-- =====================================================
-- 1. Prevent PO Deletion With Inventory Operations
-- =====================================================
CREATE OR REPLACE FUNCTION prevent_po_delete_with_inventory()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.received_to_inventory = true THEN
    RAISE EXCEPTION 'Cannot delete purchase order: items have been received to inventory. Create a stock adjustment instead.';
  END IF;
  
  IF OLD.inventory_fulfilled = true THEN
    RAISE EXCEPTION 'Cannot delete purchase order: items were fulfilled from inventory. The stock has already been deducted.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_delete_inventory_check
BEFORE DELETE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION prevent_po_delete_with_inventory();

COMMENT ON FUNCTION prevent_po_delete_with_inventory IS 'Prevents deletion of POs that have inventory operations';

-- =====================================================
-- 2. Handle Work Order Deletion - Auto-unreserve
-- =====================================================
CREATE OR REPLACE FUNCTION handle_work_order_delete_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  -- Only process if there are inventory reservations
  IF OLD.inventory_reserved = true THEN
    -- Create unreserve movements for each reservation
    FOR v_reservation IN 
      SELECT im.*, s.id as stock_id
      FROM inventory_movements im
      JOIN inventory_stock s ON im.stock_id = s.id
      WHERE im.work_order_id = OLD.id 
        AND im.movement_type = 'reservation'
    LOOP
      -- Create unreserve movement for audit trail
      INSERT INTO inventory_movements (
        part_id, stock_id, warehouse_id, movement_type, quantity,
        work_order_id, reference_type, performed_by, movement_date, notes
      ) VALUES (
        v_reservation.part_id,
        v_reservation.stock_id,
        v_reservation.warehouse_id,
        'unreserve',
        -v_reservation.quantity, -- Negative to reverse reservation
        OLD.id,
        'work_order_delete',
        COALESCE(auth.uid(), OLD.updated_by, OLD.requested_by),
        NOW(),
        'Auto-unreserve: Work order deleted (WO: ' || OLD.order_id || ')'
      );
      
      -- Update stock reserved quantity
      UPDATE inventory_stock
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - v_reservation.quantity),
        oldest_reservation_date = (
          SELECT MIN(movement_date) 
          FROM inventory_movements 
          WHERE stock_id = v_reservation.stock_id 
            AND movement_type = 'reservation'
            AND work_order_id != OLD.id
        ),
        updated_at = NOW()
      WHERE id = v_reservation.stock_id;
    END LOOP;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER work_order_delete_inventory_trigger
BEFORE DELETE ON work_orders
FOR EACH ROW EXECUTE FUNCTION handle_work_order_delete_inventory();

COMMENT ON FUNCTION handle_work_order_delete_inventory IS 'Automatically unreserves inventory when work order is deleted';

-- =====================================================
-- 3. Handle Work Order Cancellation - Auto-unreserve
-- =====================================================
CREATE OR REPLACE FUNCTION handle_work_order_status_change_inventory()
RETURNS TRIGGER AS $$
DECLARE
  v_reservation RECORD;
  v_cancelled_statuses TEXT[] := ARRAY['Cancelada', 'Cancelled', 'Rechazada'];
BEGIN
  -- Only process if status changed to cancelled and has reservations
  IF NEW.status = ANY(v_cancelled_statuses) 
     AND OLD.status != ALL(v_cancelled_statuses)
     AND OLD.inventory_reserved = true THEN
    
    -- Create unreserve movements for each reservation
    FOR v_reservation IN 
      SELECT im.*, s.id as stock_id
      FROM inventory_movements im
      JOIN inventory_stock s ON im.stock_id = s.id
      WHERE im.work_order_id = OLD.id 
        AND im.movement_type = 'reservation'
    LOOP
      -- Create unreserve movement
      INSERT INTO inventory_movements (
        part_id, stock_id, warehouse_id, movement_type, quantity,
        work_order_id, reference_type, performed_by, movement_date, notes
      ) VALUES (
        v_reservation.part_id,
        v_reservation.stock_id,
        v_reservation.warehouse_id,
        'unreserve',
        -v_reservation.quantity,
        OLD.id,
        'work_order_cancel',
        COALESCE(auth.uid(), NEW.updated_by),
        NOW(),
        'Auto-unreserve: Work order cancelled (WO: ' || OLD.order_id || ')'
      );
      
      -- Update stock
      UPDATE inventory_stock
      SET 
        reserved_quantity = GREATEST(0, reserved_quantity - v_reservation.quantity),
        oldest_reservation_date = (
          SELECT MIN(movement_date) 
          FROM inventory_movements 
          WHERE stock_id = v_reservation.stock_id 
            AND movement_type = 'reservation'
            AND work_order_id != OLD.id
        ),
        updated_at = NOW()
      WHERE id = v_reservation.stock_id;
    END LOOP;
    
    -- Update work order reservation flag
    NEW.inventory_reserved := false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER work_order_status_inventory_trigger
BEFORE UPDATE OF status ON work_orders
FOR EACH ROW 
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_work_order_status_change_inventory();

COMMENT ON FUNCTION handle_work_order_status_change_inventory IS 'Automatically unreserves inventory when work order is cancelled';

-- =====================================================
-- 4. Update Average Cost on Receipt
-- =====================================================
CREATE OR REPLACE FUNCTION update_inventory_average_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_old_qty NUMERIC;
  v_old_avg NUMERIC;
  v_new_avg NUMERIC;
BEGIN
  -- Only calculate for receipts with cost
  IF NEW.movement_type = 'receipt' AND NEW.unit_cost IS NOT NULL AND NEW.quantity > 0 THEN
    SELECT current_quantity, average_unit_cost
    INTO v_old_qty, v_old_avg
    FROM inventory_stock 
    WHERE id = NEW.stock_id;
    
    -- Weighted average formula
    IF v_old_qty + NEW.quantity > 0 THEN
      v_new_avg := (
        (COALESCE(v_old_qty, 0) * COALESCE(v_old_avg, 0)) + 
        (NEW.quantity * NEW.unit_cost)
      ) / (COALESCE(v_old_qty, 0) + NEW.quantity);
      
      UPDATE inventory_stock
      SET average_unit_cost = ROUND(v_new_avg, 2)
      WHERE id = NEW.stock_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER movement_update_average_cost
AFTER INSERT ON inventory_movements
FOR EACH ROW 
WHEN (NEW.movement_type = 'receipt')
EXECUTE FUNCTION update_inventory_average_cost();

COMMENT ON FUNCTION update_inventory_average_cost IS 'Updates weighted average cost when parts are received';

-- =====================================================
-- 5. Update Oldest Reservation Date
-- =====================================================
CREATE OR REPLACE FUNCTION update_oldest_reservation_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type IN ('reservation', 'unreserve') THEN
    UPDATE inventory_stock
    SET oldest_reservation_date = (
      SELECT MIN(im.movement_date)
      FROM inventory_movements im
      WHERE im.stock_id = NEW.stock_id
        AND im.movement_type = 'reservation'
        AND NOT EXISTS (
          -- Exclude reservations that have been fully unreserved
          SELECT 1 FROM inventory_movements im2
          WHERE im2.stock_id = im.stock_id
            AND im2.work_order_id = im.work_order_id
            AND im2.movement_type = 'unreserve'
        )
    )
    WHERE id = NEW.stock_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER movement_update_reservation_date
AFTER INSERT ON inventory_movements
FOR EACH ROW 
WHEN (NEW.movement_type IN ('reservation', 'unreserve'))
EXECUTE FUNCTION update_oldest_reservation_date();

COMMENT ON FUNCTION update_oldest_reservation_date IS 'Tracks oldest reservation date for stale reservation alerts';

-- =====================================================
-- 6. Validate Stock on Movement (Prevent Severe Negative)
-- =====================================================
CREATE OR REPLACE FUNCTION validate_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  -- For issues, check available quantity
  IF NEW.movement_type IN ('issue', 'transfer_out', 'return_to_supplier') THEN
    SELECT current_quantity - reserved_quantity
    INTO v_available
    FROM inventory_stock
    WHERE id = NEW.stock_id
    FOR UPDATE; -- Lock row
    
    IF v_available + NEW.quantity < -10 THEN -- Small tolerance
      RAISE EXCEPTION 'Insufficient available stock. Available: %, Requested: %', 
        v_available, ABS(NEW.quantity);
    END IF;
  END IF;
  
  -- For reservations, check available
  IF NEW.movement_type = 'reservation' THEN
    SELECT current_quantity - reserved_quantity
    INTO v_available
    FROM inventory_stock
    WHERE id = NEW.stock_id
    FOR UPDATE;
    
    IF v_available < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient available stock for reservation. Available: %, Requested: %', 
        v_available, NEW.quantity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER movement_validate_stock
BEFORE INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION validate_stock_movement();

COMMENT ON FUNCTION validate_stock_movement IS 'Validates stock availability before creating movements, prevents severe negative stock';

-- =====================================================
-- 7. Update Stock Quantities on Movement
-- =====================================================
CREATE OR REPLACE FUNCTION update_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock quantities based on movement type
  IF NEW.movement_type = 'receipt' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity,
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'issue' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity, -- NEW.quantity is negative
      reserved_quantity = GREATEST(0, reserved_quantity + NEW.quantity), -- Also negative
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'reservation' THEN
    UPDATE inventory_stock
    SET 
      reserved_quantity = reserved_quantity + NEW.quantity,
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'unreserve' THEN
    UPDATE inventory_stock
    SET 
      reserved_quantity = GREATEST(0, reserved_quantity + NEW.quantity), -- NEW.quantity is negative
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'return' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity,
      reserved_quantity = GREATEST(0, reserved_quantity - NEW.quantity),
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'transfer_out' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity, -- NEW.quantity is negative
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'transfer_in' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity,
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity, -- Can be positive or negative
      last_movement_date = NEW.movement_date,
      last_counted_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
    
  ELSIF NEW.movement_type = 'return_to_supplier' THEN
    UPDATE inventory_stock
    SET 
      current_quantity = current_quantity + NEW.quantity, -- NEW.quantity is negative
      last_movement_date = NEW.movement_date,
      updated_at = NOW()
    WHERE id = NEW.stock_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER movement_update_stock
AFTER INSERT ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION update_stock_on_movement();

COMMENT ON FUNCTION update_stock_on_movement IS 'Updates stock quantities based on movement type';
