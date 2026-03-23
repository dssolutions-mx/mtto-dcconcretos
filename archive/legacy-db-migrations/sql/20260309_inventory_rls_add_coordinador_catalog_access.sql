-- =====================================================
-- Add COORDINADOR_MANTENIMIENTO and GERENTE_MANTENIMIENTO to parts catalog RLS
-- Migration: 20260309_inventory_rls_add_coordinador_catalog_access
-- Description: Allow coordinador de mantenimiento to add parts to the catalog
-- =====================================================

-- 1. INVENTORY_PARTS: Drop and recreate policy
DROP POLICY IF EXISTS "Supervisors manage inventory parts" ON inventory_parts;
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
          'COORDINADOR_MANTENIMIENTO',
          'GERENTE_MANTENIMIENTO',
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
          'COORDINADOR_MANTENIMIENTO',
          'GERENTE_MANTENIMIENTO',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  );

-- 2. SUPPLIER_PART_NUMBERS: Drop and recreate policy
DROP POLICY IF EXISTS "Supervisors manage supplier part numbers" ON supplier_part_numbers;
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
          'COORDINADOR_MANTENIMIENTO',
          'GERENTE_MANTENIMIENTO',
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
          'COORDINADOR_MANTENIMIENTO',
          'GERENTE_MANTENIMIENTO',
          'AUXILIAR_COMPRAS'
        )
        AND pr.status = 'active'
    )
  );

-- 3. INVENTORY_WAREHOUSES: Update SELECT policy for BU scope visibility
DROP POLICY IF EXISTS "Users can view warehouses for their plants" ON inventory_warehouses;
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
          AND role IN ('GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'ENCARGADO_MANTENIMIENTO', 'COORDINADOR_MANTENIMIENTO')
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
