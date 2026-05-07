-- Multi-plant JEFE_PLANTA / ENCARGADO_MANTENIMIENTO hardening:
-- 1) user_can_insert_asset — insert into any scoped plant (not only profiles.plant_id).
-- 2) purchase_orders — standalone POs (work_order_id IS NULL) honor profile_scoped_plant_ids.
-- 3) assets — explicit scoped OR on SELECT/UPDATE USING / DELETE; drop redundant ALL policy so
--    UPDATE WITH CHECK (user_can_update_asset_plant) is not duplicated by a permissive ALL WITH CHECK.

-- ---------------------------------------------------------------------------
-- 1) user_can_insert_asset
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_insert_asset(p_new_plant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_plant_id uuid;
  v_user_business_unit_id uuid;
  v_user_role text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT plant_id, business_unit_id, role::text
  INTO v_user_plant_id, v_user_business_unit_id, v_user_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NULL AND v_user_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NULL THEN
    RETURN true;
  END IF;

  IF v_user_plant_id IS NULL AND v_user_business_unit_id IS NOT NULL THEN
    IF p_new_plant_id IS NULL THEN
      RETURN true;
    ELSE
      RETURN EXISTS (
        SELECT 1 FROM public.plants
        WHERE id = p_new_plant_id
          AND business_unit_id = v_user_business_unit_id
      );
    END IF;
  END IF;

  IF v_user_role IN ('JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO') THEN
    IF p_new_plant_id IS NULL THEN
      RETURN true;
    END IF;
    RETURN p_new_plant_id = ANY (public.profile_scoped_plant_ids(v_user_id));
  END IF;

  IF v_user_plant_id IS NOT NULL THEN
    IF p_new_plant_id IS NULL THEN
      RETURN true;
    ELSE
      RETURN p_new_plant_id = v_user_plant_id;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

COMMENT ON FUNCTION public.user_can_insert_asset(uuid) IS
  'Whether the current user may INSERT an asset with the given plant_id. JEFE_PLANTA / ENCARGADO use profile_scoped_plant_ids.';

-- ---------------------------------------------------------------------------
-- 2) purchase_orders — standalone PO branch
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enhanced flexible purchase orders access" ON public.purchase_orders;

CREATE POLICY "Enhanced flexible purchase orders access" ON public.purchase_orders
  FOR ALL
  USING (
    (
      purchase_orders.work_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.work_orders wo
        JOIN public.assets a ON a.id = wo.asset_id
        WHERE wo.id = purchase_orders.work_order_id
      )
    )
    OR (
      purchase_orders.work_order_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_authorization_summary uas
        WHERE uas.user_id = auth.uid()
          AND (
            uas.plant_id IS NULL
            OR uas.plant_id = purchase_orders.plant_id
            OR purchase_orders.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
          )
      )
    )
  )
  WITH CHECK (
    (
      purchase_orders.work_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.work_orders wo
        JOIN public.assets a ON a.id = wo.asset_id
        WHERE wo.id = purchase_orders.work_order_id
      )
    )
    OR (
      purchase_orders.work_order_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_authorization_summary uas
        WHERE uas.user_id = auth.uid()
          AND (
            uas.plant_id IS NULL
            OR uas.plant_id = purchase_orders.plant_id
            OR purchase_orders.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) assets — scoped SELECT / UPDATE USING / DELETE; remove duplicate ALL
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Assets hierarchical access - select" ON public.assets;

CREATE POLICY "Assets hierarchical access - select" ON public.assets
  FOR SELECT
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
        AND (assets.plant_id = pl.id OR assets.plant_id IS NULL)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.plant_id = assets.plant_id OR assets.plant_id IS NULL)
    )
    OR (
      assets.plant_id IS NOT NULL
      AND assets.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Assets hierarchical access - update" ON public.assets;

CREATE POLICY "Assets hierarchical access - update" ON public.assets
  FOR UPDATE
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
        AND (assets.plant_id = pl.id OR assets.plant_id IS NULL)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.plant_id = assets.plant_id OR assets.plant_id IS NULL)
    )
    OR (
      assets.plant_id IS NOT NULL
      AND assets.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
    )
  )
  WITH CHECK (public.user_can_update_asset_plant(assets.id, assets.plant_id));

DROP POLICY IF EXISTS "Assets hierarchical access - delete" ON public.assets;

CREATE POLICY "Assets hierarchical access - delete" ON public.assets
  FOR DELETE
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
        AND (assets.plant_id = pl.id OR assets.plant_id IS NULL)
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (profiles.plant_id = assets.plant_id OR assets.plant_id IS NULL)
    )
    OR (
      assets.plant_id IS NOT NULL
      AND assets.plant_id = ANY (public.profile_scoped_plant_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Assets hierarchical access - no recursion" ON public.assets;
