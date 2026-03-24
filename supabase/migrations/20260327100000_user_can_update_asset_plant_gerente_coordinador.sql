-- GERENTE_MANTENIMIENTO: may reassign assets across plants (global maintenance leadership).
-- COORDINADOR_MANTENIMIENTO: same plant-scoped rules as JEFE_PLANTA / ENCARGADO_MANTENIMIENTO.
-- Keeps existing branches including DOSIFICADOR (same-plant meter updates).

CREATE OR REPLACE FUNCTION public.user_can_update_asset_plant(p_asset_id uuid, p_new_plant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_plant_id uuid;
  v_user_plant_id uuid;
  v_user_role text;
  v_user_business_unit_id uuid;
  v_user_id uuid;
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

  IF v_user_plant_id IS NOT NULL AND v_user_role IN (
    'JEFE_PLANTA',
    'ENCARGADO_MANTENIMIENTO',
    'COORDINADOR_MANTENIMIENTO'
  ) THEN
    IF p_new_plant_id IS NULL THEN
      RETURN COALESCE(v_current_plant_id = v_user_plant_id, false);
    ELSE
      RETURN p_new_plant_id = v_user_plant_id;
    END IF;
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
