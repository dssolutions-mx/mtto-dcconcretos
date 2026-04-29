-- Unscoped COORDINADOR_MANTENIMIENTO (plant_id and business_unit_id both NULL):
-- full read/write diesel visibility (warehouses, transactions, snapshots).
-- Evidence rows inherit via diesel_transactions subquery RLS.

DROP POLICY IF EXISTS "Diesel transactions hierarchical access" ON public.diesel_transactions;
CREATE POLICY "Diesel transactions hierarchical access" ON public.diesel_transactions
USING (
  (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
    AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
    AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'JEFE_PLANTA'::user_role
      AND diesel_transactions.plant_id = ANY (public.profile_scoped_plant_ids(pr.id))))
  OR (EXISTS (SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid()
      AND pr.plant_id = diesel_transactions.plant_id
      AND pr.role = ANY (ARRAY['DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  ))
) WITH CHECK (
  (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
    AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
    AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles p JOIN plants pl ON pl.business_unit_id = p.business_unit_id
    WHERE p.id = auth.uid() AND p.plant_id IS NULL AND p.business_unit_id IS NOT NULL
      AND diesel_transactions.plant_id = pl.id AND p.role = 'COORDINADOR_MANTENIMIENTO'::user_role))
  OR (EXISTS (SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid() AND pr.role = 'JEFE_PLANTA'::user_role
      AND diesel_transactions.plant_id = ANY (public.profile_scoped_plant_ids(pr.id))))
  OR (EXISTS (SELECT 1 FROM profiles pr
    WHERE pr.id = auth.uid()
      AND pr.plant_id = diesel_transactions.plant_id
      AND pr.role = ANY (ARRAY['DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  ))
);

DROP POLICY IF EXISTS "Diesel snapshots hierarchical access" ON public.diesel_inventory_snapshots;
CREATE POLICY "Diesel snapshots hierarchical access" ON public.diesel_inventory_snapshots
USING (warehouse_id IN (
  SELECT w.id FROM diesel_warehouses w
  WHERE w.plant_id IN (
    SELECT p.id FROM plants p
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role)
    UNION
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
    SELECT plant_id
    FROM unnest(public.profile_scoped_plant_ids((SELECT auth.uid()))) AS plant_id
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'JEFE_PLANTA'::user_role)
    UNION
    SELECT pr.plant_id
    FROM profiles pr
    WHERE pr.id = auth.uid()
      AND pr.plant_id IS NOT NULL
      AND pr.role = ANY (ARRAY['DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  )
))
WITH CHECK (warehouse_id IN (
  SELECT w.id FROM diesel_warehouses w
  WHERE w.plant_id IN (
    SELECT p.id FROM plants p
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role)
    UNION
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
    SELECT plant_id
    FROM unnest(public.profile_scoped_plant_ids((SELECT auth.uid()))) AS plant_id
    WHERE EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'JEFE_PLANTA'::user_role)
    UNION
    SELECT pr.plant_id
    FROM profiles pr
    WHERE pr.id = auth.uid()
      AND pr.plant_id IS NOT NULL
      AND pr.role = ANY (ARRAY['DOSIFICADOR'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role])
  )
));

DROP POLICY IF EXISTS "Users can view warehouses for their plants and business units" ON public.diesel_warehouses;
CREATE POLICY "Users can view warehouses for their plants and business units" ON public.diesel_warehouses
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = 'COORDINADOR_MANTENIMIENTO'::user_role)
    OR plant_id IN (
    SELECT p.id FROM plants p
    WHERE p.id IN (SELECT plant_id FROM profiles WHERE id = auth.uid() AND plant_id IS NOT NULL)
    OR p.id = ANY (public.profile_scoped_plant_ids((SELECT auth.uid())))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.business_unit_id = p.business_unit_id
      AND pr.business_unit_id IS NOT NULL AND pr.role = 'JEFE_UNIDAD_NEGOCIO'::user_role)
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id = p.business_unit_id
      AND pr.role = ANY(ARRAY['GERENCIA_GENERAL'::user_role, 'COORDINADOR_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
      AND pr.role = ANY(ARRAY['GERENCIA_GENERAL'::user_role, 'AREA_ADMINISTRATIVA'::user_role, 'AUXILIAR_COMPRAS'::user_role, 'DOSIFICADOR'::user_role, 'EJECUTIVO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id = p.id AND pr.role = 'DOSIFICADOR'::user_role)
  ));
