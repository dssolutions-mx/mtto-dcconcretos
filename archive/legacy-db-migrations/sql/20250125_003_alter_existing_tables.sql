-- =====================================================
-- Inventory System - Alter Existing Tables
-- Migration: 20250125_003_alter_existing_tables
-- Description: Add inventory columns to purchase_orders and work_orders
-- =====================================================

-- =====================================================
-- 1. Purchase Orders Enhancement (Extended)
-- =====================================================

-- Add fulfillment source column
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS fulfillment_source TEXT 
  CHECK (fulfillment_source IN ('purchase', 'inventory', 'mixed')) DEFAULT 'purchase';

-- Add inventory fulfillment tracking
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS inventory_fulfilled BOOLEAN DEFAULT false;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS inventory_fulfillment_date TIMESTAMPTZ;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS inventory_fulfilled_by UUID REFERENCES auth.users(id);

-- Add inventory receipt tracking
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS received_to_inventory BOOLEAN DEFAULT false;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS received_to_inventory_date TIMESTAMPTZ;

ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS received_to_inventory_by UUID REFERENCES auth.users(id);

-- Track received quantities per item
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS received_items_summary JSONB DEFAULT '[]'::jsonb;
-- Format: [{item_index: 0, ordered_qty: 10, received_qty: 5, remaining_qty: 5}]

COMMENT ON COLUMN purchase_orders.fulfillment_source IS 'Source of fulfillment: purchase, inventory, or mixed';
COMMENT ON COLUMN purchase_orders.inventory_fulfilled IS 'PO was fulfilled FROM inventory (deducted stock)';
COMMENT ON COLUMN purchase_orders.received_to_inventory IS 'PO items were received TO inventory (added stock)';
COMMENT ON COLUMN purchase_orders.received_items_summary IS 'Tracks partial receipts per item: [{item_index, ordered_qty, received_qty, remaining_qty}]';

-- =====================================================
-- 2. Work Orders Enhancement (Extended)
-- =====================================================

-- Add inventory reservation tracking
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS inventory_reserved BOOLEAN DEFAULT false;

ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS inventory_reservation_date TIMESTAMPTZ;

ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS inventory_checked BOOLEAN DEFAULT false;

ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS inventory_check_date TIMESTAMPTZ;

-- Track reservation details
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS reserved_parts_summary JSONB DEFAULT '[]'::jsonb;
-- Format: [{part_id, part_name, warehouse_id, warehouse_name, reserved_qty, movement_id}]

COMMENT ON COLUMN work_orders.inventory_reserved IS 'Whether parts have been reserved from inventory';
COMMENT ON COLUMN work_orders.inventory_checked IS 'Whether inventory availability was checked';
COMMENT ON COLUMN work_orders.reserved_parts_summary IS 'Details of reserved parts: [{part_id, part_name, warehouse_id, warehouse_name, reserved_qty, movement_id}]';
