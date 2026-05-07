-- Remaining multi-plant JP / ENCARGADO gaps (Supabase MCP audit vs live policies).
-- See also 20260507120000 (plants), 20260508120000 (assets + related).

-- ---------------------------------------------------------------------------
-- 1) can_user_access_plant — JP must use scoped plants, not full BU join
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_user_access_plant(p_user_id uuid, p_plant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.plant_id IS NULL
      AND pr.business_unit_id IS NULL
      AND pr.role = ANY (
        ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role
        ]
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    INNER JOIN public.plants p ON p.business_unit_id = pr.business_unit_id
    WHERE pr.id = p_user_id
      AND p.id = p_plant_id
      AND pr.role IS DISTINCT FROM 'JEFE_PLANTA'::user_role
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.plant_id = p_plant_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = p_user_id
      AND pr.role = 'JEFE_PLANTA'::user_role
      AND p_plant_id = ANY (public.profile_scoped_plant_ids(pr.id))
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2) inventory_warehouses — SELECT + UPDATE: mirror INSERT (scoped union)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view warehouses for their plants" ON public.inventory_warehouses;

CREATE POLICY "Users can view warehouses for their plants" ON public.inventory_warehouses
  FOR SELECT
  USING (
    plant_id IN (
      SELECT p.id
      FROM public.plants p
      WHERE p.id = ANY (public.profile_scoped_plant_ids((SELECT auth.uid())))
        OR p.id IN (
          SELECT profiles.plant_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.plant_id IS NOT NULL
        )
        OR p.business_unit_id IN (
          SELECT profiles.business_unit_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.plant_id IS NULL
            AND profiles.role = ANY (
              ARRAY[
                'GERENCIA_GENERAL'::user_role,
                'JEFE_UNIDAD_NEGOCIO'::user_role,
                'ENCARGADO_MANTENIMIENTO'::user_role,
                'COORDINADOR_MANTENIMIENTO'::user_role,
                'GERENTE_MANTENIMIENTO'::user_role
              ]
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.plant_id IS NULL
            AND pr.business_unit_id IS NULL
            AND pr.role = ANY (
              ARRAY[
                'GERENCIA_GENERAL'::user_role,
                'AREA_ADMINISTRATIVA'::user_role,
                'AUXILIAR_COMPRAS'::user_role,
                'GERENTE_MANTENIMIENTO'::user_role
              ]
            )
        )
    )
  );

DROP POLICY IF EXISTS "Supervisors update warehouses in accessible plants" ON public.inventory_warehouses;

CREATE POLICY "Supervisors update warehouses in accessible plants" ON public.inventory_warehouses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = ANY (
          ARRAY[
            'GERENCIA_GENERAL'::user_role,
            'JEFE_UNIDAD_NEGOCIO'::user_role,
            'ENCARGADO_MANTENIMIENTO'::user_role,
            'JEFE_PLANTA'::user_role,
            'GERENTE_MANTENIMIENTO'::user_role,
            'COORDINADOR_MANTENIMIENTO'::user_role
          ]
        )
        AND pr.status = 'active'
    )
    AND plant_id IN (
      SELECT p.id
      FROM public.plants p
      WHERE p.id = ANY (public.profile_scoped_plant_ids((SELECT auth.uid())))
        OR p.id IN (
          SELECT profiles.plant_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.plant_id IS NOT NULL
        )
        OR p.business_unit_id IN (
          SELECT profiles.business_unit_id
          FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.plant_id IS NULL
            AND profiles.role = ANY (
              ARRAY[
                'GERENCIA_GENERAL'::user_role,
                'JEFE_UNIDAD_NEGOCIO'::user_role,
                'ENCARGADO_MANTENIMIENTO'::user_role,
                'COORDINADOR_MANTENIMIENTO'::user_role,
                'GERENTE_MANTENIMIENTO'::user_role
              ]
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.plant_id IS NULL
            AND pr.business_unit_id IS NULL
            AND pr.role = ANY (
              ARRAY[
                'GERENCIA_GENERAL'::user_role,
                'GERENTE_MANTENIMIENTO'::user_role
              ]
            )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) asset_accountability_tracking — JP / ENCARGADO: any scoped plant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view asset accountability in scope" ON public.asset_accountability_tracking;

CREATE POLICY "Users can view asset accountability in scope" ON public.asset_accountability_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.assets a
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE a.id = asset_accountability_tracking.asset_id
        AND (
          a.plant_id = p.plant_id
          OR (
            p.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
          )
          OR p.role = ANY (
            ARRAY[
              'GERENCIA_GENERAL'::user_role,
              'JEFE_UNIDAD_NEGOCIO'::user_role,
              'GERENTE_MANTENIMIENTO'::user_role
            ]
          )
          OR (
            p.role = ANY (
              ARRAY['JEFE_UNIDAD_NEGOCIO'::user_role, 'GERENTE_MANTENIMIENTO'::user_role]
            )
            AND EXISTS (
              SELECT 1
              FROM public.plants pl
              WHERE pl.id = a.plant_id
                AND pl.business_unit_id = p.business_unit_id
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) compliance_incidents — asset-linked: JP / ENCARGADO scoped plants
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view relevant compliance incidents" ON public.compliance_incidents;

CREATE POLICY "Users can view relevant compliance incidents" ON public.compliance_incidents
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = ANY (
            ARRAY[
              'GERENCIA_GENERAL'::user_role,
              'JEFE_UNIDAD_NEGOCIO'::user_role,
              'JEFE_PLANTA'::user_role,
              'ENCARGADO_MANTENIMIENTO'::user_role,
              'GERENTE_MANTENIMIENTO'::user_role,
              'COORDINADOR_MANTENIMIENTO'::user_role
            ]
          )
          OR (
            compliance_incidents.asset_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.assets a
              WHERE a.id = compliance_incidents.asset_id
                AND (
                  a.plant_id = p.plant_id
                  OR (
                    p.role = ANY (
                      ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
                    )
                    AND a.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
                  )
                )
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) profiles — SELECT: see colleagues on any scoped plant (JP / ENCARGADO)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles hierarchical access" ON public.profiles;

CREATE POLICY "Profiles hierarchical access" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.plant_id IS NULL
        AND p.business_unit_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.plant_id IS NULL
        AND p.business_unit_id IS NOT NULL
        AND (
          profiles.business_unit_id = p.business_unit_id
          OR (profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.plant_id IS NOT NULL
        AND (
          profiles.plant_id = p.plant_id
          OR (profiles.plant_id IS NULL AND profiles.business_unit_id IS NULL)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (
          ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
        )
        AND profiles.plant_id IS NOT NULL
        AND profiles.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
    )
  );

-- Note: assets also has per-command policies (select/update/delete) without profile_scoped_plant_ids
-- in USING; permissive OR with "Assets hierarchical access - no recursion" (ALL) still allows JP.
-- Do not drop "Assets hierarchical access - update" — it supplies WITH CHECK (user_can_update_asset_plant(...)).
