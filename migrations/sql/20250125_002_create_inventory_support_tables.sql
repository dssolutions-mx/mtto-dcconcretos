-- =====================================================
-- Inventory System - Support Tables
-- Migration: 20250125_002_create_inventory_support_tables
-- Description: Create support tables (supplier_part_numbers, purchase_order_receipts, unit_conversions)
-- =====================================================

-- =====================================================
-- 1. supplier_part_numbers Table (Multi-supplier support)
-- =====================================================
CREATE TABLE IF NOT EXISTS supplier_part_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id UUID REFERENCES inventory_parts(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  supplier_part_number TEXT NOT NULL,
  supplier_part_name TEXT, -- Supplier's name for the part
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, supplier_part_number),
  UNIQUE(part_id, supplier_id) -- One entry per part per supplier
);

COMMENT ON TABLE supplier_part_numbers IS 'Maps internal part numbers to supplier-specific numbers';
COMMENT ON COLUMN supplier_part_numbers.is_primary IS 'Primary supplier part number for this part';

CREATE INDEX IF NOT EXISTS idx_supplier_parts_part ON supplier_part_numbers(part_id);
CREATE INDEX IF NOT EXISTS idx_supplier_parts_supplier ON supplier_part_numbers(supplier_id);

-- =====================================================
-- 2. po_inventory_receipts Table (Multiple Receipts Tracking)
-- Note: Renamed from purchase_order_receipts to avoid collision with existing file upload table
-- =====================================================
CREATE TABLE IF NOT EXISTS po_inventory_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  receipt_number TEXT NOT NULL, -- e.g., 'REC-PO001-001'
  receipt_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  warehouse_id UUID REFERENCES inventory_warehouses(id) NOT NULL,
  items JSONB NOT NULL, -- [{po_item_index, part_id, quantity, unit_cost}]
  total_items INTEGER NOT NULL,
  total_value NUMERIC(12,2) NOT NULL,
  notes TEXT,
  received_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE po_inventory_receipts IS 'Tracks each inventory receipt event for a PO (supports partial receipts)';

CREATE INDEX IF NOT EXISTS idx_po_inv_receipts_po ON po_inventory_receipts(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_inv_receipts_date ON po_inventory_receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_inv_receipts_warehouse ON po_inventory_receipts(warehouse_id);

-- Generate receipt number function
CREATE OR REPLACE FUNCTION generate_inventory_receipt_number(po_order_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM po_inventory_receipts pr
  JOIN purchase_orders po ON pr.purchase_order_id = po.id
  WHERE po.order_id = po_order_id;
  
  RETURN 'REC-' || po_order_id || '-' || LPAD(v_count::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_inventory_receipt_number IS 'Generates unique receipt number for inventory receipts';

-- =====================================================
-- 3. unit_conversions Table (UoM Support)
-- =====================================================
CREATE TABLE IF NOT EXISTS unit_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  conversion_factor NUMERIC(15,6) NOT NULL,
  is_bidirectional BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_unit, to_unit)
);

COMMENT ON TABLE unit_conversions IS 'Unit of measure conversions for inventory parts';

-- Seed common conversions
INSERT INTO unit_conversions (id, from_unit, to_unit, conversion_factor) VALUES
  (uuid_generate_v4(), 'gallons', 'liters', 3.78541),
  (uuid_generate_v4(), 'liters', 'gallons', 0.264172),
  (uuid_generate_v4(), 'kg', 'lbs', 2.20462),
  (uuid_generate_v4(), 'lbs', 'kg', 0.453592),
  (uuid_generate_v4(), 'meters', 'feet', 3.28084),
  (uuid_generate_v4(), 'feet', 'meters', 0.3048),
  (uuid_generate_v4(), 'inches', 'cm', 2.54),
  (uuid_generate_v4(), 'cm', 'inches', 0.393701)
ON CONFLICT (from_unit, to_unit) DO NOTHING;

-- Conversion function
CREATE OR REPLACE FUNCTION convert_units(
  p_quantity NUMERIC,
  p_from_unit TEXT,
  p_to_unit TEXT
) RETURNS NUMERIC AS $$
DECLARE
  v_factor NUMERIC;
BEGIN
  IF p_from_unit = p_to_unit THEN
    RETURN p_quantity;
  END IF;
  
  SELECT conversion_factor INTO v_factor
  FROM unit_conversions
  WHERE from_unit = LOWER(p_from_unit) AND to_unit = LOWER(p_to_unit);
  
  IF v_factor IS NULL THEN
    RAISE EXCEPTION 'No conversion found from % to %', p_from_unit, p_to_unit;
  END IF;
  
  RETURN ROUND(p_quantity * v_factor, 4);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION convert_units IS 'Converts quantity from one unit to another using conversion factors';
