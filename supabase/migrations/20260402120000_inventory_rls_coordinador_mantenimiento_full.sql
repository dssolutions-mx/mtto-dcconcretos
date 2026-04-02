-- COORDINADOR_MANTENIMIENTO: close gaps vs legacy "Supervisors *" migration.
-- Remote DB uses warehouse authority policies (user_has_warehouse_permission) for stock/movements/receipts;
-- those already include COORDINADOR for release/receive. This migration:
-- 1) Adds COORDINADOR to stock adjustments (adjust) in user_has_warehouse_permission
-- 2) Aligns "Supervisors create warehouses" INSERT with UPDATE (coordinador + gerente + BU scope)
-- 3) Allows COORDINADOR on unit_conversions ALL policy (catalog UoM maintenance)

-- ---------------------------------------------------------------------------
-- 1) Warehouse helper: coordinador may adjust stock (parity with inventory_movements adjustment RLS path)
-- ---------------------------------------------------------------------------
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
    v_can_do := v_role IN (
      'GERENCIA_GENERAL','AREA_ADMINISTRATIVA','AUXILIAR_COMPRAS','ENCARGADO_ALMACEN',
      'JEFE_UNIDAD_NEGOCIO','JEFE_PLANTA','COORDINADOR_MANTENIMIENTO','GERENTE_MANTENIMIENTO'
    );
  ELSIF p_permission = 'receive' THEN
    v_can_do := v_role IN (
      'GERENCIA_GENERAL','AREA_ADMINISTRATIVA','AUXILIAR_COMPRAS','ENCARGADO_ALMACEN',
      'JEFE_UNIDAD_NEGOCIO','JEFE_PLANTA','COORDINADOR_MANTENIMIENTO','DOSIFICADOR','GERENTE_MANTENIMIENTO'
    );
  ELSIF p_permission = 'adjust' THEN
    v_can_do := v_role IN (
      'GERENCIA_GENERAL','AREA_ADMINISTRATIVA','ENCARGADO_ALMACEN','JEFE_UNIDAD_NEGOCIO',
      'GERENTE_MANTENIMIENTO','COORDINADOR_MANTENIMIENTO'
    );
  END IF;

  RETURN v_can_do;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) inventory_warehouses INSERT - was missing COORDINADOR_MANTENIMIENTO / GERENTE_MANTENIMIENTO
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Supervisors create warehouses in accessible plants" ON inventory_warehouses;
CREATE POLICY "Supervisors create warehouses in accessible plants"
  ON inventory_warehouses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
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
      WHERE p.id IN (SELECT plant_id FROM profiles WHERE id = auth.uid())
        OR p.business_unit_id IN (
          SELECT business_unit_id FROM profiles
          WHERE id = auth.uid()
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
          WHERE pr.id = auth.uid()
            AND pr.plant_id IS NULL
            AND pr.business_unit_id IS NULL
            AND pr.role = ANY (ARRAY['GERENCIA_GENERAL'::user_role, 'GERENTE_MANTENIMIENTO'::user_role])
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3) unit_conversions - allow coordinador to maintain conversion factors
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage unit conversions" ON unit_conversions;
CREATE POLICY "Admins manage unit conversions"
  ON unit_conversions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'COORDINADOR_MANTENIMIENTO'::user_role
        ])
        AND pr.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role = ANY (ARRAY[
          'GERENCIA_GENERAL'::user_role,
          'GERENTE_MANTENIMIENTO'::user_role,
          'COORDINADOR_MANTENIMIENTO'::user_role
        ])
        AND pr.status = 'active'
    )
  );
