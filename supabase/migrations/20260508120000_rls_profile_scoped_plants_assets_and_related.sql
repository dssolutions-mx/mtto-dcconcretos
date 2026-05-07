-- Multi-plant JEFE_PLANTA / ENCARGADO_MANTENIMIENTO: extend RLS beyond profiles.plant_id = row.plant_id.
-- plants + profile_scoped_plant_ids was fixed in 20260507120000; assets and related policies still blocked
-- second plant (SELECT/UPDATE assets, composite rows, assignment history, operator history).

-- ---------------------------------------------------------------------------
-- 1) assets — same shape as legacy "Assets hierarchical access - no recursion"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Assets hierarchical access - no recursion" ON public.assets;

CREATE POLICY "Assets hierarchical access - no recursion" ON public.assets
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id IS NULL
        AND profiles.business_unit_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.plants pl ON pl.business_unit_id = p.business_unit_id
      WHERE p.id = auth.uid()
        AND p.plant_id IS NULL
        AND p.business_unit_id IS NOT NULL
        AND assets.plant_id = pl.id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id = assets.plant_id
    )
    OR assets.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id IS NULL
        AND profiles.business_unit_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.plants pl ON pl.business_unit_id = p.business_unit_id
      WHERE p.id = auth.uid()
        AND p.plant_id IS NULL
        AND p.business_unit_id IS NOT NULL
        AND assets.plant_id = pl.id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.plant_id = assets.plant_id
    )
    OR assets.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 2) asset_assignment_history — JP / ENCARGADO: any involved plant in scoped set
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view asset assignment history based on role" ON public.asset_assignment_history;

CREATE POLICY "Users can view asset assignment history based on role" ON public.asset_assignment_history
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT profiles.id
      FROM public.profiles
      WHERE profiles.role = ANY (
          ARRAY[
            'GERENCIA_GENERAL'::user_role,
            'AREA_ADMINISTRATIVA'::user_role
          ]
        )
        OR (
          profiles.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
          AND profiles.business_unit_id IN (
            SELECT pl.business_unit_id
            FROM public.plants pl
            WHERE pl.id = asset_assignment_history.new_plant_id
               OR pl.id = asset_assignment_history.previous_plant_id
          )
        )
        OR (
          profiles.role = 'JEFE_PLANTA'::user_role
          AND (
            (
              asset_assignment_history.new_plant_id IS NOT NULL
              AND asset_assignment_history.new_plant_id = ANY (
                public.profile_scoped_plant_ids(profiles.id)
              )
            )
            OR (
              asset_assignment_history.previous_plant_id IS NOT NULL
              AND asset_assignment_history.previous_plant_id = ANY (
                public.profile_scoped_plant_ids(profiles.id)
              )
            )
          )
        )
        OR (
          profiles.role = 'ENCARGADO_MANTENIMIENTO'::user_role
          AND (
            (
              asset_assignment_history.new_plant_id IS NOT NULL
              AND asset_assignment_history.new_plant_id = ANY (
                public.profile_scoped_plant_ids(profiles.id)
              )
            )
            OR (
              asset_assignment_history.previous_plant_id IS NOT NULL
              AND asset_assignment_history.previous_plant_id = ANY (
                public.profile_scoped_plant_ids(profiles.id)
              )
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) asset_composite_relationships — manage + view (JP / ENCARGADO scoped plants)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage composite relationships in their scope" ON public.asset_composite_relationships;

CREATE POLICY "Users can manage composite relationships in their scope" ON public.asset_composite_relationships
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.assets a_comp ON a_comp.id = asset_composite_relationships.composite_asset_id
      WHERE p.id = auth.uid()
        AND (
          p.plant_id = a_comp.plant_id
          OR p.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_comp.plant_id
            )
          )
          OR (
            p.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_comp.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p2
      JOIN public.assets a_component ON a_component.id = asset_composite_relationships.component_asset_id
      WHERE p2.id = auth.uid()
        AND (
          p2.plant_id = a_component.plant_id
          OR p2.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p2.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p2.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_component.plant_id
            )
          )
          OR (
            p2.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_component.plant_id = ANY (public.profile_scoped_plant_ids(p2.id))
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.assets a_comp ON a_comp.id = asset_composite_relationships.composite_asset_id
      WHERE p.id = auth.uid()
        AND (
          p.plant_id = a_comp.plant_id
          OR p.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_comp.plant_id
            )
          )
          OR (
            p.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_comp.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p2
      JOIN public.assets a_component ON a_component.id = asset_composite_relationships.component_asset_id
      WHERE p2.id = auth.uid()
        AND (
          p2.plant_id = a_component.plant_id
          OR p2.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p2.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p2.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_component.plant_id
            )
          )
          OR (
            p2.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_component.plant_id = ANY (public.profile_scoped_plant_ids(p2.id))
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can view composite relationships in their scope" ON public.asset_composite_relationships;

CREATE POLICY "Users can view composite relationships in their scope" ON public.asset_composite_relationships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.assets a_comp ON a_comp.id = asset_composite_relationships.composite_asset_id
      WHERE p.id = auth.uid()
        AND (
          p.plant_id = a_comp.plant_id
          OR p.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_comp.plant_id
            )
          )
          OR (
            p.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_comp.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p2
      JOIN public.assets a_component ON a_component.id = asset_composite_relationships.component_asset_id
      WHERE p2.id = auth.uid()
        AND (
          p2.plant_id = a_component.plant_id
          OR p2.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p2.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p2.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a_component.plant_id
            )
          )
          OR (
            p2.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a_component.plant_id = ANY (public.profile_scoped_plant_ids(p2.id))
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 4) operator_assignment_history — JP: asset on any scoped plant
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view operator assignment history in their scope" ON public.operator_assignment_history;

CREATE POLICY "Users can view operator assignment history in their scope" ON public.operator_assignment_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.assets a ON a.id = operator_assignment_history.asset_id
      WHERE p.id = auth.uid()
        AND (
          p.plant_id = a.plant_id
          OR (
            p.role = ANY (
              ARRAY['JEFE_PLANTA'::user_role, 'ENCARGADO_MANTENIMIENTO'::user_role]
            )
            AND a.plant_id = ANY (public.profile_scoped_plant_ids(p.id))
          )
          OR p.role = 'GERENCIA_GENERAL'::user_role
          OR (
            p.role = 'JEFE_UNIDAD_NEGOCIO'::user_role
            AND p.business_unit_id = (
              SELECT pl.business_unit_id FROM public.plants pl WHERE pl.id = a.plant_id
            )
          )
        )
    )
  );
