-- Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO to remaining RLS policies
-- GERENTE_MANTENIMIENTO has global scope (same as GERENCIA_GENERAL) - access to everything
-- COORDINADOR_MANTENIMIENTO has plant/unit scope (same as ENCARGADO_MANTENIMIENTO)
-- Migration: 20260309_add_gerente_to_remaining_rls

-- 1. can_user_access_plant: Allow GERENTE_MANTENIMIENTO and GERENCIA_GENERAL with null/null to access any plant
CREATE OR REPLACE FUNCTION can_user_access_plant(p_user_id UUID, p_plant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles pr
    WHERE pr.id = p_user_id
      AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role::text IN ('GERENCIA_GENERAL', 'GERENTE_MANTENIMIENTO')
  ) OR EXISTS (
    SELECT 1 FROM profiles pr
    INNER JOIN plants p ON p.business_unit_id = pr.business_unit_id
    WHERE pr.id = p_user_id AND p.id = p_plant_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND plant_id = p_plant_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. DIESEL_INVENTORY_SNAPSHOTS: Add GERENTE_MANTENIMIENTO to global scope (plant_id IS NULL, business_unit_id IS NULL)
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
      AND pr.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role])
    UNION
    SELECT profiles.plant_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.plant_id IS NOT NULL
      AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role])
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
      AND pr.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role])
    UNION
    SELECT profiles.plant_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.plant_id IS NOT NULL
      AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role])
  )
));

-- 3. DIESEL_TRANSACTIONS: Add GERENTE_MANTENIMIENTO to global scope
DROP POLICY IF EXISTS "Diesel transactions hierarchical access" ON diesel_transactions;
CREATE POLICY "Diesel transactions hierarchical access" ON diesel_transactions
USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role])))
) WITH CHECK (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = ANY (ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role])))
);

-- 4. EQUIPMENT_MODELS: Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO
DROP POLICY IF EXISTS "Equipment models open access" ON equipment_models;
CREATE POLICY "Equipment models open access" ON equipment_models
USING (true) WITH CHECK (EXISTS (SELECT 1 FROM profiles p
  WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]) AND p.status = 'active'));

-- 5. TASK_PARTS: Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO
DROP POLICY IF EXISTS "Task parts management access" ON task_parts;
CREATE POLICY "Task parts management access" ON task_parts
USING (true) WITH CHECK (EXISTS (SELECT 1 FROM profiles p
  WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]) AND p.status = 'active'));

-- 6. DIESEL_WAREHOUSES: Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO to Supervisors create
DROP POLICY IF EXISTS "Supervisors create diesel warehouses in accessible plants" ON diesel_warehouses;
CREATE POLICY "Supervisors create diesel warehouses in accessible plants" ON diesel_warehouses FOR INSERT
WITH CHECK (can_user_access_plant(auth.uid(), plant_id)
  AND EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid()
    AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'JEFE_PLANTA'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])));

-- 7. DIESEL_WAREHOUSES: Add GERENTE_MANTENIMIENTO to "Users can view warehouses"
DROP POLICY IF EXISTS "Users can view warehouses for their plants and business units" ON diesel_warehouses;
CREATE POLICY "Users can view warehouses for their plants and business units" ON diesel_warehouses FOR SELECT
USING (plant_id IN (
  SELECT p.id FROM plants p
  WHERE p.id = (SELECT plant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id = p.business_unit_id
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id = p.id AND pr.role = 'DOSIFICADOR'::user_role)
));

-- 8. MAINTENANCE_INTERVALS: Add GERENTE_MANTENIMIENTO and COORDINADOR_MANTENIMIENTO
DROP POLICY IF EXISTS "Maintenance intervals management access" ON maintenance_intervals;
CREATE POLICY "Maintenance intervals management access" ON maintenance_intervals
USING (true) WITH CHECK (EXISTS (SELECT 1 FROM profiles p
  WHERE p.id = auth.uid() AND p.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'JEFE_UNIDAD_NEGOCIO'::user_role, 'JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]) AND p.status = 'active'));
