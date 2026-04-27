-- Part 2 (depends on 20260423130000): user_can_update_asset_plant, diesel, inventory, ingresos, view
-- If 20260423130000 was not applied on an environment, apply the full 20260423130000 file first.

-- 4) user_can_update_asset_plant — JEFE/ENCAGADO use profile_scoped_plant_ids
CREATE OR REPLACE FUNCTION public.user_can_update_asset_plant(p_asset_id uuid, p_new_plant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_plant_id uuid;
  v_user_plant_id uuid;
  v_user_role text;
  v_user_business_unit_id uuid;
  v_user_id uuid;
  v_scoped uuid[];
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.plant_id INTO v_current_plant_id
  FROM assets a
  WHERE a.id = p_asset_id;

  IF v_current_plant_id IS NULL AND NOT EXISTS (SELECT 1 FROM assets WHERE id = p_asset_id) THEN
    RETURN false;
  END IF;

  SELECT plant_id, business_unit_id, role::text
  INTO v_user_plant_id, v_user_business_unit_id, v_user_role
  FROM profiles
  WHERE id = v_user_id;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NULL AND v_user_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NULL THEN
    RETURN true;
  END IF;

  IF v_user_role = 'GERENTE_MANTENIMIENTO' THEN
    RETURN true;
  END IF;

  v_scoped := public.profile_scoped_plant_ids(v_user_id);

  IF v_user_role = 'COORDINADOR_MANTENIMIENTO' AND v_user_business_unit_id IS NOT NULL THEN
    IF p_new_plant_id IS NULL THEN
      IF v_current_plant_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1 FROM plants
          WHERE id = v_current_plant_id
          AND business_unit_id = v_user_business_unit_id
        );
      END IF;
      RETURN true;
    ELSE
      RETURN EXISTS (
        SELECT 1 FROM plants
        WHERE id = p_new_plant_id
        AND business_unit_id = v_user_business_unit_id
      );
    END IF;
  END IF;

  IF v_user_role = 'COORDINADOR_MANTENIMIENTO'
     AND v_user_business_unit_id IS NULL
     AND v_user_plant_id IS NOT NULL THEN
    IF p_new_plant_id IS NULL THEN
      RETURN COALESCE(v_current_plant_id = v_user_plant_id, false);
    ELSE
      RETURN p_new_plant_id = v_user_plant_id;
    END IF;
  END IF;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NOT NULL THEN
    IF p_new_plant_id IS NULL THEN
      IF v_current_plant_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1 FROM plants
          WHERE id = v_current_plant_id
          AND business_unit_id = v_user_business_unit_id
        );
      END IF;
      RETURN true;
    ELSE
      RETURN EXISTS (
        SELECT 1 FROM plants
        WHERE id = p_new_plant_id
        AND business_unit_id = v_user_business_unit_id
      );
    END IF;
  END IF;

  IF v_user_role = ANY (ARRAY['JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO'])
     AND cardinality(v_scoped) > 0
  THEN
    IF p_new_plant_id IS NULL THEN
      RETURN COALESCE(v_current_plant_id = ANY (v_scoped), false);
    END IF;
    IF p_new_plant_id = ANY (v_scoped) THEN
      RETURN COALESCE(v_current_plant_id IS NULL OR v_current_plant_id = ANY (v_scoped), false);
    END IF;
    RETURN false;
  END IF;

  IF v_user_plant_id IS NOT NULL
     AND v_user_role = 'DOSIFICADOR'
     AND v_current_plant_id IS NOT DISTINCT FROM v_user_plant_id
     AND p_new_plant_id IS NOT DISTINCT FROM v_current_plant_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- 5) Diesel
DROP POLICY IF EXISTS "Diesel transactions hierarchical access" ON public.diesel_transactions;
CREATE POLICY "Diesel transactions hierarchical access" ON public.diesel_transactions
USING (
  (EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.plant_id IS NULL AND pr.business_unit_id IS NULL
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
  USING (plant_id IN (
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

DROP POLICY IF EXISTS "Supervisors create warehouses in accessible plants" ON public.inventory_warehouses;
CREATE POLICY "Supervisors create warehouses in accessible plants"
  ON public.inventory_warehouses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = (SELECT auth.uid())
        AND pr.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'JEFE_UNIDAD_NEGOCIO'::user_role,
          'ENCARGADO_MANTENIMIENTO'::user_role,
          'JEFE_PLANTA'::user_role,
          'COORDINADOR_MANTENIMIENTO'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role
        ])
        AND pr.status = 'active'
    )
    AND plant_id IN (
      SELECT p.id FROM plants p
      WHERE p.id = ANY (public.profile_scoped_plant_ids((SELECT auth.uid())))
        OR p.business_unit_id IN (
          SELECT business_unit_id FROM profiles
          WHERE id = (SELECT auth.uid())
            AND plant_id IS NULL
            AND role = ANY (ARRAY[
              'GERENCIA_GENERAL'::user_role,
              'JEFE_UNIDAD_NEGOCIO'::user_role,
              'ENCARGADO_MANTENIMIENTO'::user_role,
              'COORDINADOR_MANTENIMIENTO'::user_role,
              'GERENTE_MANTENIMIENTO'::user_role
            ])
        )
        OR EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = (SELECT auth.uid())
            AND pr.plant_id IS NULL
            AND pr.business_unit_id IS NULL
            AND pr.role = ANY(ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
        )
    )
  );

DROP POLICY IF EXISTS "Users read KPI rollup for accessible plants" ON public.ingresos_gastos_kpi_plant_month;
CREATE POLICY "Users read KPI rollup for accessible plants"
  ON public.ingresos_gastos_kpi_plant_month
  FOR SELECT
  TO authenticated
  USING (
    plant_id IN (
      SELECT p.id
      FROM public.plants p
      INNER JOIN public.profiles pr ON pr.business_unit_id = p.business_unit_id
      WHERE pr.id = (SELECT auth.uid())
    )
    OR plant_id = ANY (public.profile_scoped_plant_ids((SELECT auth.uid())))
  );

CREATE OR REPLACE VIEW public.user_plants_expanded
WITH (security_invoker = true) AS
SELECT
  p.id AS user_id,
  x.plant_id,
  pl.name AS plant_name,
  p.business_unit_id,
  bu.name AS business_unit_name
FROM public.profiles p
CROSS JOIN LATERAL unnest(public.profile_scoped_plant_ids(p.id)) AS x(plant_id)
LEFT JOIN public.plants pl ON pl.id = x.plant_id
LEFT JOIN public.business_units bu ON bu.id = p.business_unit_id
WHERE p.id = (SELECT auth.uid())
  AND cardinality(public.profile_scoped_plant_ids(p.id)) > 0;

COMMENT ON VIEW public.user_plants_expanded IS
  'Current user’s plants (profile.plant_id + profile_managed_plants) for client filters.';

GRANT SELECT ON public.user_plants_expanded TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.profile_scoped_plant_ids(uuid) TO authenticated, anon, service_role;
