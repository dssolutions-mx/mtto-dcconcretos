-- Allow JEFE_UNIDAD_NEGOCIO to pass diesel RLS for any plant in their business unit
-- even when profiles.plant_id is set (legacy / inconsistent data). COORDINADOR_MANTENIMIENTO
-- at BU level remains restricted to profiles.plant_id IS NULL so plant-scoped Coordinadores
-- do not gain BU-wide diesel access.
-- Mirrors: diesel_transactions, diesel_inventory_snapshots, diesel_warehouses SELECT.

-- 1. diesel_transactions
DROP POLICY IF EXISTS "Diesel transactions hierarchical access" ON diesel_transactions;
CREATE POLICY "Diesel transactions hierarchical access" ON diesel_transactions
USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
) WITH CHECK (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL
    AND profiles.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.plant_id = diesel_transactions.plant_id
    AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])))
);

-- 2. diesel_inventory_snapshots
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
    WHERE pr.id = auth.uid() AND pr.business_unit_id IS NOT NULL
      AND pr.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
    UNION
    SELECT p.id FROM plants p
    JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
    WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NOT NULL
      AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role
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
    WHERE pr.id = auth.uid() AND pr.business_unit_id IS NOT NULL
      AND pr.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
    UNION
    SELECT p.id FROM plants p
    JOIN profiles pr ON pr.business_unit_id = p.business_unit_id
    WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NOT NULL
      AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role
    UNION
    SELECT profiles.plant_id FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.plant_id IS NOT NULL
      AND profiles.role = ANY (ARRAY['JEFE_PLANTA'::user_role, 'DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  )
));

-- 3. diesel_warehouses SELECT
DROP POLICY IF EXISTS "Users can view warehouses for their plants and business units" ON diesel_warehouses;
CREATE POLICY "Users can view warehouses for their plants and business units" ON diesel_warehouses FOR SELECT
USING (plant_id IN (
  SELECT p.id FROM plants p
  WHERE p.id = (SELECT plant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.business_unit_id = p.business_unit_id
      AND pr.business_unit_id IS NOT NULL AND pr.role = 'JEFE_UNIDAD_NEGOCIO'::user_role)
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id = p.business_unit_id
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id = p.id AND pr.role = 'DOSIFICADOR'::user_role)
));
