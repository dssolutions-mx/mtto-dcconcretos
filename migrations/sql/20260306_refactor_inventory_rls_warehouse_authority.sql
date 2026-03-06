-- =====================================================
-- Task 6 Step 5: Refactor inventory RLS for warehouse authority
-- Migration: 20260306_refactor_inventory_rls_warehouse_authority
-- Description: Write authority uses warehouse_responsibilities + legacy role
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_warehouse_permission(
  p_user_id uuid,
  p_warehouse_id uuid,
  p_permission text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_plant_id uuid;
  v_has_explicit boolean := false;
  v_can_do boolean := false;
BEGIN
  SELECT plant_id INTO v_plant_id FROM inventory_warehouses WHERE id = p_warehouse_id;

  IF p_permission = 'release' THEN
    SELECT EXISTS (
      SELECT 1 FROM warehouse_responsibilities wr
      WHERE wr.user_id = p_user_id
        AND wr.can_release_inventory = true
        AND wr.effective_from <= now()
        AND (wr.effective_until IS NULL OR wr.effective_until >= now())
        AND (wr.warehouse_id = p_warehouse_id OR wr.warehouse_id IS NULL
             OR (v_plant_id IS NOT NULL AND wr.plant_id = v_plant_id) OR wr.plant_id IS NULL)
    ) INTO v_has_explicit;
  ELSIF p_permission = 'receive' THEN
    SELECT EXISTS (
      SELECT 1 FROM warehouse_responsibilities wr
      WHERE wr.user_id = p_user_id
        AND wr.can_receive_inventory = true
        AND wr.effective_from <= now()
        AND (wr.effective_until IS NULL OR wr.effective_until >= now())
        AND (wr.warehouse_id = p_warehouse_id OR wr.warehouse_id IS NULL
             OR (v_plant_id IS NOT NULL AND wr.plant_id = v_plant_id) OR wr.plant_id IS NULL)
    ) INTO v_has_explicit;
  ELSIF p_permission = 'adjust' THEN
    SELECT EXISTS (
      SELECT 1 FROM warehouse_responsibilities wr
      WHERE wr.user_id = p_user_id
        AND wr.can_adjust_inventory = true
        AND wr.effective_from <= now()
        AND (wr.effective_until IS NULL OR wr.effective_until >= now())
        AND (wr.warehouse_id = p_warehouse_id OR wr.warehouse_id IS NULL
             OR (v_plant_id IS NOT NULL AND wr.plant_id = v_plant_id) OR wr.plant_id IS NULL)
    ) INTO v_has_explicit;
  END IF;

  IF v_has_explicit THEN
    RETURN true;
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

  IF p_permission = 'release' THEN
    v_can_do := v_role IN ('GERENCIA_GENERAL','AREA_ADMINISTRATIVA','AUXILIAR_COMPRAS','ENCARGADO_ALMACEN','JEFE_UNIDAD_NEGOCIO','JEFE_PLANTA','ENCARGADO_MANTENIMIENTO');
  ELSIF p_permission = 'receive' THEN
    v_can_do := v_role IN ('GERENCIA_GENERAL','AREA_ADMINISTRATIVA','AUXILIAR_COMPRAS','ENCARGADO_ALMACEN','JEFE_UNIDAD_NEGOCIO','JEFE_PLANTA','ENCARGADO_MANTENIMIENTO','DOSIFICADOR');
  ELSIF p_permission = 'adjust' THEN
    v_can_do := v_role IN ('GERENCIA_GENERAL','AREA_ADMINISTRATIVA','ENCARGADO_ALMACEN','JEFE_UNIDAD_NEGOCIO');
  END IF;

  RETURN v_can_do;
END;
$$;
