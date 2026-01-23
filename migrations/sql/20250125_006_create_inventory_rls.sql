-- =====================================================
-- Inventory System - RLS Policies
-- Migration: 20250125_006_create_inventory_rls
-- Description: Row Level Security for inventory tables following hierarchical access patterns
-- =====================================================

-- =====================================================
-- Enable RLS on all inventory tables
-- =====================================================
ALTER TABLE inventory_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_part_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_inventory_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 1. INVENTORY_PARTS POLICIES
-- =====================================================

-- Policy: All authenticated users can view active parts
CREATE POLICY "Users can view active inventory parts"
  ON inventory_parts FOR SELECT
  USING (is_active = true);

-- Policy: Supervisors can create/update parts
CREATE POLICY "Supervisors manage inventory parts"
  ON inventory_parts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  );

-- =====================================================
-- 2. SUPPLIER_PART_NUMBERS POLICIES
-- =====================================================

-- Policy: Users can view supplier part numbers for parts they can see
CREATE POLICY "Users can view supplier part numbers"
  ON supplier_part_numbers FOR SELECT
  USING (
    part_id IN (SELECT id FROM inventory_parts WHERE is_active = true)
  );

-- Policy: Supervisors can manage supplier part numbers
CREATE POLICY "Supervisors manage supplier part numbers"
  ON supplier_part_numbers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  );

-- =====================================================
-- 3. INVENTORY_WAREHOUSES POLICIES
-- =====================================================

-- Policy: Users can view warehouses for their plants and business units
CREATE POLICY "Users can view warehouses for their plants"
  ON inventory_warehouses FOR SELECT
  USING (
    plant_id IN (
      SELECT p.id FROM plants p
      WHERE p.id IN (
        SELECT plant_id FROM profiles WHERE id = auth.uid()
      )
      OR p.business_unit_id IN (
        SELECT business_unit_id FROM profiles 
        WHERE id = auth.uid() 
          AND plant_id IS NULL
          AND role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO')
      )
      OR EXISTS (
        SELECT 1 FROM profiles pr
        WHERE pr.id = auth.uid()
          AND pr.plant_id IS NULL
          AND pr.business_unit_id IS NULL
          AND pr.role IN ('GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'AUXILIAR_COMPRAS')
      )
    )
  );

-- Policy: Supervisors can create warehouses in accessible plants
CREATE POLICY "Supervisors create warehouses in accessible plants"
  ON inventory_warehouses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA'
        )
        AND pr.status = 'active'
    )
    AND plant_id IN (
      SELECT p.id FROM plants p
      WHERE p.id IN (
        SELECT plant_id FROM profiles WHERE id = auth.uid()
      )
      OR p.business_unit_id IN (
        SELECT business_unit_id FROM profiles 
        WHERE id = auth.uid() 
          AND plant_id IS NULL
          AND role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO')
      )
      OR EXISTS (
        SELECT 1 FROM profiles pr
        WHERE pr.id = auth.uid()
          AND pr.plant_id IS NULL
          AND pr.business_unit_id IS NULL
          AND pr.role = 'GERENCIA_GENERAL'
      )
    )
  );

-- Policy: Supervisors can update warehouses in accessible plants
CREATE POLICY "Supervisors update warehouses in accessible plants"
  ON inventory_warehouses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA'
        )
        AND pr.status = 'active'
    )
    AND plant_id IN (
      SELECT p.id FROM plants p
      WHERE p.id IN (
        SELECT plant_id FROM profiles WHERE id = auth.uid()
      )
      OR p.business_unit_id IN (
        SELECT business_unit_id FROM profiles 
        WHERE id = auth.uid() 
          AND plant_id IS NULL
          AND role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO')
      )
      OR EXISTS (
        SELECT 1 FROM profiles pr
        WHERE pr.id = auth.uid()
          AND pr.plant_id IS NULL
          AND pr.business_unit_id IS NULL
          AND pr.role = 'GERENCIA_GENERAL'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA'
        )
        AND pr.status = 'active'
    )
  );

-- =====================================================
-- 4. INVENTORY_STOCK POLICIES
-- =====================================================

-- Policy: Users can view stock for warehouses they can access
CREATE POLICY "Users can view stock for accessible warehouses"
  ON inventory_stock FOR SELECT
  USING (
    warehouse_id IN (
      SELECT id FROM inventory_warehouses
    )
  );

-- Policy: Supervisors can manage stock
CREATE POLICY "Supervisors manage inventory stock"
  ON inventory_stock FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  );

-- Policy: Hide costs from operators
CREATE POLICY "Hide costs from operators"
  ON inventory_stock FOR SELECT
  USING (
    average_unit_cost IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role != 'OPERADOR'
        AND pr.status = 'active'
    )
  );

-- =====================================================
-- 5. INVENTORY_MOVEMENTS POLICIES
-- =====================================================

-- Policy: Users can view movements for warehouses they can access
CREATE POLICY "Users can view movements for accessible warehouses"
  ON inventory_movements FOR SELECT
  USING (
    warehouse_id IN (
      SELECT id FROM inventory_warehouses
    )
  );

-- Policy: Supervisors can create movements
CREATE POLICY "Supervisors create inventory movements"
  ON inventory_movements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
    AND performed_by = auth.uid()
  );

-- Policy: Stock adjustments require manager role
CREATE POLICY "Managers only for stock adjustments"
  ON inventory_movements FOR INSERT
  WITH CHECK (
    movement_type != 'adjustment'
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA'
        )
        AND pr.status = 'active'
    )
  );

-- Policy: Hide costs from operators
CREATE POLICY "Hide movement costs from operators"
  ON inventory_movements FOR SELECT
  USING (
    unit_cost IS NULL
    OR total_cost IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role != 'OPERADOR'
        AND pr.status = 'active'
    )
  );

-- =====================================================
-- 6. PO_INVENTORY_RECEIPTS POLICIES
-- =====================================================

-- Policy: Users can view receipts for POs they can access
CREATE POLICY "Users can view receipts for accessible POs"
  ON po_inventory_receipts FOR SELECT
  USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders
    )
  );

-- Policy: Supervisors can create receipts
CREATE POLICY "Supervisors create purchase order receipts"
  ON po_inventory_receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN (
          'GERENCIA_GENERAL', 
          'JEFE_UNIDAD_NEGOCIO', 
          'ENCARGADO_MANTENIMIENTO', 
          'JEFE_PLANTA',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
    AND received_by = auth.uid()
  );

-- =====================================================
-- 7. UNIT_CONVERSIONS POLICIES
-- =====================================================

-- Policy: All authenticated users can view unit conversions
CREATE POLICY "Users can view unit conversions"
  ON unit_conversions FOR SELECT
  USING (true);

-- Policy: Only admins can manage unit conversions
CREATE POLICY "Admins manage unit conversions"
  ON unit_conversions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'GERENCIA_GENERAL'
        AND pr.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = 'GERENCIA_GENERAL'
        AND pr.status = 'active'
    )
  );
