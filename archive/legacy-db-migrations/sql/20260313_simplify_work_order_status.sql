-- Simplify work order status: Pendiente, Programada, Esperando repuestos, Completada
-- Maps legacy statuses (Cotizada, Aprobada, En ejecución, etc.) to new simplified set

-- 1. Map legacy statuses to new values
UPDATE work_orders
SET status = 'Pendiente'
WHERE status IN (
  'Cotizada',
  'Aprobada',
  'En ejecución',
  'En Progreso',
  'en_progreso',
  'pendiente'
);

UPDATE work_orders
SET status = 'Esperando repuestos'
WHERE status = 'Esperando Partes';

-- 2. Update approve_purchase_order to set WO status = 'Pendiente' instead of 'Aprobada'
CREATE OR REPLACE FUNCTION "public"."approve_purchase_order"("p_purchase_order_id" "uuid", "p_approved_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Actualizar orden de compra
  UPDATE purchase_orders
  SET
    status = 'Aprobada',
    approved_by = p_approved_by,
    approval_date = NOW(),
    updated_at = NOW()
  WHERE id = p_purchase_order_id;

  -- Actualizar orden de trabajo asociada (simplified: Pendiente = ready for next steps)
  UPDATE work_orders
  SET
    status = 'Pendiente',
    approval_status = 'Aprobada',
    approved_by = p_approved_by,
    approval_date = NOW(),
    updated_at = NOW()
  WHERE purchase_order_id = p_purchase_order_id;
END;
$$;
