-- =====================================================
-- Inventory System - Core Tables
-- Migration: 20250125_001_create_inventory_core_tables
-- Description: Create core inventory tables (parts, warehouses, stock, movements)
-- =====================================================

-- =====================================================
-- 1. inventory_parts Table (Enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number TEXT UNIQUE NOT NULL,
  part_number_normalized TEXT GENERATED ALWAYS AS (
    UPPER(REGEXP_REPLACE(part_number, '[^A-Z0-9]', '', 'g'))
  ) STORED, -- For fuzzy matching
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Repuesto', 'Consumible', 'Herramienta', 'Otro')),
  unit_of_measure TEXT DEFAULT 'pcs', -- 'pcs', 'liters', 'kg', etc.
  manufacturer TEXT,
  supplier_id UUID REFERENCES suppliers(id),
  warranty_period_months INTEGER,
  specifications JSONB DEFAULT '{}'::jsonb, -- Additional specs, dimensions, etc.
  default_unit_cost NUMERIC(10,2), -- Default cost for manual entries
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE inventory_parts IS 'Master catalog of all parts/consumables';
COMMENT ON COLUMN inventory_parts.part_number_normalized IS 'Normalized part number for fuzzy matching (uppercase, alphanumeric only)';
COMMENT ON COLUMN inventory_parts.specifications IS 'Additional specs, dimensions, etc. in JSONB format';

-- Indexes for parts catalog
CREATE INDEX IF NOT EXISTS idx_inventory_parts_number ON inventory_parts(part_number);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_normalized ON inventory_parts(part_number_normalized);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_name ON inventory_parts USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_inventory_parts_category ON inventory_parts(category);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_supplier ON inventory_parts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_active ON inventory_parts(is_active) WHERE is_active = true;

-- =====================================================
-- 2. inventory_warehouses Table
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id UUID REFERENCES plants(id) NOT NULL,
  warehouse_code TEXT NOT NULL, -- e.g., 'ALM-001-PARTS'
  name TEXT NOT NULL, -- e.g., 'Planta 1 - Almacén de Repuestos'
  location_notes TEXT,
  is_primary BOOLEAN DEFAULT false, -- Primary warehouse for auto-selection
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plant_id, warehouse_code)
);

COMMENT ON TABLE inventory_warehouses IS 'Warehouses for parts inventory, similar to diesel_warehouses structure';
COMMENT ON COLUMN inventory_warehouses.is_primary IS 'Primary warehouse for auto-selection when multiple warehouses exist';

CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_plant ON inventory_warehouses(plant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_active ON inventory_warehouses(is_active) WHERE is_active = true;

-- =====================================================
-- 3. inventory_stock Table (Enhanced with Cost Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES inventory_parts(id) NOT NULL,
  warehouse_id UUID REFERENCES inventory_warehouses(id) NOT NULL,
  current_quantity NUMERIC(10,2) DEFAULT 0 NOT NULL,
  reserved_quantity NUMERIC(10,2) DEFAULT 0 NOT NULL, -- Reserved for work orders
  min_stock_level NUMERIC(10,2) DEFAULT 0,
  max_stock_level NUMERIC(10,2),
  reorder_point NUMERIC(10,2), -- Alert threshold
  -- Cost tracking (Weighted Average)
  average_unit_cost NUMERIC(10,2) DEFAULT 0, -- Updated on each receipt
  total_value NUMERIC(12,2) GENERATED ALWAYS AS (current_quantity * average_unit_cost) STORED,
  -- Audit fields
  last_movement_date TIMESTAMPTZ,
  last_counted_date TIMESTAMPTZ,
  oldest_reservation_date TIMESTAMPTZ, -- Track stale reservations
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(part_id, warehouse_id),
  -- Constraints for data integrity
  CONSTRAINT check_reserved_not_negative CHECK (reserved_quantity >= 0),
  CONSTRAINT check_current_not_too_negative CHECK (current_quantity >= -10), -- Small tolerance
  CONSTRAINT check_reserved_le_current CHECK (reserved_quantity <= current_quantity + 10) -- Small tolerance
);

COMMENT ON TABLE inventory_stock IS 'Warehouse-level stock tracking with cost tracking';
COMMENT ON COLUMN inventory_stock.average_unit_cost IS 'Weighted average cost per unit, updated on each receipt';
COMMENT ON COLUMN inventory_stock.total_value IS 'Generated column: current_quantity * average_unit_cost';
COMMENT ON COLUMN inventory_stock.oldest_reservation_date IS 'Tracks oldest reservation for stale reservation alerts';

-- Indexes for stock queries
CREATE INDEX IF NOT EXISTS idx_inventory_stock_part ON inventory_stock(part_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_warehouse ON inventory_stock(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_part_warehouse ON inventory_stock(part_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_low ON inventory_stock(warehouse_id) 
  WHERE current_quantity - reserved_quantity < reorder_point;
CREATE INDEX IF NOT EXISTS idx_inventory_stock_stale_reservations ON inventory_stock(oldest_reservation_date) 
  WHERE reserved_quantity > 0;

-- =====================================================
-- 4. inventory_movements Table (Enhanced with Full Audit)
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES inventory_parts(id) NOT NULL,
  stock_id UUID REFERENCES inventory_stock(id) NOT NULL,
  warehouse_id UUID REFERENCES inventory_warehouses(id) NOT NULL, -- Denormalized for queries
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'receipt',           -- Received from purchase order (explicit action)
    'issue',             -- Issued to work order
    'adjustment',        -- Manual adjustment (physical count, damage, etc.)
    'transfer_out',       -- Transfer to another warehouse (outgoing)
    'transfer_in',        -- Transfer from another warehouse (incoming)
    'return',             -- Return from work order (unused parts)
    'reservation',        -- Reserve for work order
    'unreserve',          -- Unreserve from work order (cancel/edit)
    'return_to_supplier'  -- Return defective parts to supplier
  )),
  quantity NUMERIC(10,2) NOT NULL, -- Positive for receipts/in, negative for issues/out
  unit_cost NUMERIC(10,2), -- Cost per unit at time of movement
  total_cost NUMERIC(10,2), -- ABS(quantity) * unit_cost
  -- Reference tracking
  reference_type TEXT CHECK (reference_type IN (
    'purchase_order', 'work_order', 'manual', 'transfer', 
    'work_order_edit', 'work_order_cancel', 'work_order_delete',
    'supplier_return'
  )),
  reference_id UUID,
  -- Specific references
  work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  transfer_to_warehouse_id UUID REFERENCES inventory_warehouses(id),
  -- Supplier return tracking
  supplier_return_reason TEXT,
  supplier_return_status TEXT CHECK (supplier_return_status IN (
    'pending', 'shipped', 'credited', 'replaced', 'rejected'
  )),
  -- Audit fields
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) NOT NULL,
  movement_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Extended audit (optional)
  ip_address INET,
  user_agent TEXT
);

COMMENT ON TABLE inventory_movements IS 'Complete audit trail of all inventory transactions';
COMMENT ON COLUMN inventory_movements.quantity IS 'Positive for receipts/transfers_in, negative for issues/transfers_out';
COMMENT ON COLUMN inventory_movements.total_cost IS 'ABS(quantity) * unit_cost';

-- Comprehensive indexes for movements
CREATE INDEX IF NOT EXISTS idx_movements_part ON inventory_movements(part_id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON inventory_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_stock ON inventory_movements(stock_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_date ON inventory_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_movements_wo ON inventory_movements(work_order_id) WHERE work_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movements_po ON inventory_movements(purchase_order_id) WHERE purchase_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movements_wo_type ON inventory_movements(work_order_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_po_type ON inventory_movements(purchase_order_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_movements_reservations ON inventory_movements(work_order_id) 
  WHERE movement_type = 'reservation';
