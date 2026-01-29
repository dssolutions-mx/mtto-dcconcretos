-- =====================================================
-- Fix Inventory Movement Costs for Fulfilled Purchase Orders
-- Migration: 20260129_fix_inventory_movement_costs
-- Description: Correct unit_cost in inventory movements that were created
--              when fulfilling purchase orders from inventory. These movements
--              should use the cost from the purchase order or work order,
--              not the inventory average cost.
-- =====================================================

-- =====================================================
-- Function to fix movement costs
-- =====================================================
CREATE OR REPLACE FUNCTION fix_inventory_movement_costs()
RETURNS TABLE (
  movement_id UUID,
  part_id UUID,
  part_number TEXT,
  part_name TEXT,
  old_unit_cost NUMERIC,
  new_unit_cost NUMERIC,
  old_total_cost NUMERIC,
  new_total_cost NUMERIC,
  source TEXT
) AS $$
DECLARE
  v_movement RECORD;
  v_po RECORD;
  v_work_order RECORD;
  v_po_items JSONB;
  v_po_item JSONB;
  v_required_parts JSONB;
  v_required_part JSONB;
  v_correct_unit_cost NUMERIC;
  v_correct_total_cost NUMERIC;
  v_source TEXT;
  v_fixed_count INT := 0;
BEGIN
  -- Loop through all 'issue' movements linked to purchase orders
  -- that have po_purpose = 'work_order_inventory'
  FOR v_movement IN
    SELECT 
      im.id,
      im.part_id,
      im.purchase_order_id,
      im.unit_cost as current_unit_cost,
      im.total_cost as current_total_cost,
      ABS(im.quantity) as movement_quantity,
      po.work_order_id,
      po.items as po_items,
      po.po_purpose
    FROM inventory_movements im
    INNER JOIN purchase_orders po ON po.id = im.purchase_order_id
    WHERE im.movement_type = 'issue'
      AND im.reference_type = 'purchase_order'
      AND im.purchase_order_id IS NOT NULL
      AND po.po_purpose = 'work_order_inventory'
      AND im.unit_cost IS NOT NULL
  LOOP
    v_correct_unit_cost := NULL;
    v_source := NULL;
    
    -- Try to find cost in purchase order items first
    v_po_items := v_movement.po_items;
    IF v_po_items IS NOT NULL AND jsonb_typeof(v_po_items) = 'array' THEN
      -- Loop through PO items to find matching part
      FOR v_po_item IN SELECT * FROM jsonb_array_elements(v_po_items)
      LOOP
        -- Match by part_id
        IF (v_po_item->>'part_id')::UUID = v_movement.part_id THEN
          IF v_po_item->>'unit_price' IS NOT NULL THEN
            v_correct_unit_cost := (v_po_item->>'unit_price')::NUMERIC;
            v_source := 'purchase_order_item';
            EXIT;
          END IF;
        END IF;
        
        -- Match by partNumber (need to look up part_id from part_number)
        IF v_po_item->>'partNumber' IS NOT NULL THEN
          DECLARE
            v_part_id_from_number UUID;
          BEGIN
            SELECT id INTO v_part_id_from_number
            FROM inventory_parts
            WHERE part_number = v_po_item->>'partNumber'
              AND is_active = true
            LIMIT 1;
            
            IF v_part_id_from_number = v_movement.part_id THEN
              IF v_po_item->>'unit_price' IS NOT NULL THEN
                v_correct_unit_cost := (v_po_item->>'unit_price')::NUMERIC;
                v_source := 'purchase_order_item';
                EXIT;
              END IF;
            END IF;
          END;
        END IF;
      END LOOP;
    END IF;
    
    -- If not found in PO, try work order required_parts
    IF v_correct_unit_cost IS NULL AND v_movement.work_order_id IS NOT NULL THEN
      SELECT required_parts INTO v_required_parts
      FROM work_orders
      WHERE id = v_movement.work_order_id;
      
      IF v_required_parts IS NOT NULL THEN
        -- Parse if it's a string
        IF jsonb_typeof(v_required_parts) = 'string' THEN
          BEGIN
            v_required_parts := v_required_parts::jsonb;
          EXCEPTION WHEN OTHERS THEN
            -- If parsing fails, try as text
            v_required_parts := NULL;
          END;
        END IF;
        
        IF v_required_parts IS NOT NULL AND jsonb_typeof(v_required_parts) = 'array' THEN
          -- Loop through required parts
          FOR v_required_part IN SELECT * FROM jsonb_array_elements(v_required_parts)
          LOOP
            -- Match by part_id
            IF (v_required_part->>'part_id')::UUID = v_movement.part_id THEN
              IF v_required_part->>'unit_price' IS NOT NULL THEN
                v_correct_unit_cost := (v_required_part->>'unit_price')::NUMERIC;
                v_source := 'work_order_required_parts';
                EXIT;
              END IF;
            END IF;
            
            -- Match by partNumber
            IF v_required_part->>'partNumber' IS NOT NULL THEN
              DECLARE
                v_part_id_from_number UUID;
              BEGIN
                SELECT id INTO v_part_id_from_number
                FROM inventory_parts
                WHERE part_number = v_required_part->>'partNumber'
                  AND is_active = true
                LIMIT 1;
                
                IF v_part_id_from_number = v_movement.part_id THEN
                  IF v_required_part->>'unit_price' IS NOT NULL THEN
                    v_correct_unit_cost := (v_required_part->>'unit_price')::NUMERIC;
                    v_source := 'work_order_required_parts';
                    EXIT;
                  END IF;
                END IF;
              END;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;
    
    -- If we found a correct cost and it's different from current, update the movement
    IF v_correct_unit_cost IS NOT NULL 
       AND v_correct_unit_cost != v_movement.current_unit_cost 
       AND v_correct_unit_cost > 0 THEN
      
      v_correct_total_cost := ABS(v_movement.movement_quantity) * v_correct_unit_cost;
      
      -- Update the movement
      UPDATE inventory_movements
      SET 
        unit_cost = v_correct_unit_cost,
        total_cost = v_correct_total_cost
      WHERE id = v_movement.id;
      
      -- Return the correction details
      RETURN QUERY
      SELECT 
        v_movement.id,
        v_movement.part_id,
        ip.part_number,
        ip.name,
        v_movement.current_unit_cost,
        v_correct_unit_cost,
        v_movement.current_total_cost,
        v_correct_total_cost,
        v_source::TEXT
      FROM inventory_parts ip
      WHERE ip.id = v_movement.part_id;
      
      v_fixed_count := v_fixed_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fixed % movement costs', v_fixed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Execute the fix function
-- =====================================================
SELECT * FROM fix_inventory_movement_costs();

-- =====================================================
-- Optional: Drop the function after use (comment out if you want to keep it)
-- =====================================================
-- DROP FUNCTION IF EXISTS fix_inventory_movement_costs();
