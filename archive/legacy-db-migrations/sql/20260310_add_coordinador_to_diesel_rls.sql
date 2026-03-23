-- Add COORDINADOR_MANTENIMIENTO to diesel RLS policies
-- Encargado de Mantenimiento was renamed to Coordinador de Mantenimiento; the role no longer exists.
-- This migration replaces ENCARGADO_MANTENIMIENTO with COORDINADOR_MANTENIMIENTO in BU-level branches
-- and adds COORDINADOR_MANTENIMIENTO to plant-level branches.
-- Migration: 20260310_add_coordinador_to_diesel_rls

-- 1. DIESEL_INVENTORY_SNAPSHOTS: Replace ENCARGADO with COORDINADOR in BU-level, add COORDINADOR to plant-level
DROP POLICY IF EXISTS "Diesel snapshots hierarchical access" ON diesel_inventory_snapshots;
CREATE POLICY "Diesel snapshots hierarchical access" ON diesel_inventory_snapshots
USING (warehouse_id IN (
  SELECT w.id FROM diesel_warehouses w
  WHERE w.plant_id IN (
    SELECT p.id FROM plants p
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    UNION
    SELECT p.id FROM plants p
    JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
    WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NOT NULL
      AND pr.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
    UNION
    SELECT profiles.plant_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.plant_id IS NOT NULL
      AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  )
)) WITH CHECK (warehouse_id IN (
  SELECT w.id FROM diesel_warehouses w
  WHERE w.plant_id IN (
    SELECT p.id FROM plants p
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    UNION
    SELECT p.id FROM plants p
    JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
    WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NOT NULL
      AND pr.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
    UNION
    SELECT profiles.plant_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.plant_id IS NOT NULL
      AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  )
));

-- 2. DIESEL_TRANSACTIONS: Replace ENCARGADO with COORDINADOR in BU-level, add COORDINADOR to plant-level
DROP POLICY IF EXISTS "Diesel transactions hierarchical access" ON diesel_transactions;
CREATE POLICY "Diesel transactions hierarchical access" ON diesel_transactions
USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
) WITH CHECK (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
);

-- 3. DIESEL_WAREHOUSES (SELECT): Replace ENCARGADO with COORDINADOR in BU-level condition
DROP POLICY IF EXISTS "Users can view warehouses for their plants and business units" ON diesel_warehouses;
CREATE POLICY "Users can view warehouses for their plants and business units" ON diesel_warehouses FOR SELECT
USING (plant_id IN (
  SELECT p.id FROM plants p
  WHERE p.id = (SELECT plant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id = p.business_unit_id
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id = p.id AND pr.role = 'DOSIFICADOR'::user_role)
));
