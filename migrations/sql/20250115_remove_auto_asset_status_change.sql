-- ========================================
-- MIGRACIÓN: Remover cambio automático de estado de activos al crear órdenes de trabajo
-- ========================================
-- 
-- PROBLEMA:
-- Los activos se establecían automáticamente en estado 'maintenance' cuando se creaban
-- órdenes de trabajo, lo que causaba:
-- - Los activos no estaban disponibles para programación de checklists
-- - No se podía cargar diesel en los activos
-- - Los usuarios debían cambiar manualmente el estado, creando un proceso doble
--
-- SOLUCIÓN:
-- Remover el cambio automático de estado. Los activos mantendrán su estado actual hasta que:
-- - La orden de trabajo se complete (se establece a 'operational' automáticamente)
-- - El usuario cambie manualmente el estado
--
-- FECHA: 2025-01-15
-- ========================================

-- Actualizar función generate_work_order_from_incident para remover el cambio automático de estado
CREATE OR REPLACE FUNCTION generate_work_order_from_incident(
  p_incident_id UUID,
  p_priority TEXT DEFAULT 'Media'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_incident RECORD;
  v_work_order_id UUID;
  v_order_id TEXT;
  v_required_parts JSONB;
  v_estimated_cost DECIMAL(10,2) := 0;
BEGIN
  -- Obtener datos del incidente
  SELECT * INTO v_incident FROM incident_history WHERE id = p_incident_id;

  IF v_incident IS NULL THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;

  -- Procesar repuestos del incidente si existen
  IF v_incident.parts IS NOT NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', part_item->>'name',
        'partNumber', COALESCE(part_item->>'partNumber', ''),
        'quantity', COALESCE((part_item->>'quantity')::int, 1),
        'unit_price', COALESCE((part_item->>'cost')::decimal, 0),
        'total_price', COALESCE((part_item->>'quantity')::int * (part_item->>'cost')::decimal, 0),
        'supplier', '',
        'description', 'Requerido por incidente: ' || v_incident.type
      )
    ) INTO v_required_parts
    FROM jsonb_array_elements(v_incident.parts) AS part_item;

    SELECT COALESCE(SUM((part->>'total_price')::decimal), 0)
    INTO v_estimated_cost
    FROM jsonb_array_elements(v_required_parts) AS part;
  END IF;

  -- Agregar costo de mano de obra si está disponible
  IF v_incident.labor_cost IS NOT NULL THEN
    v_estimated_cost := v_estimated_cost + v_incident.labor_cost::decimal;
  END IF;

  -- Crear la orden de trabajo (order_id será generado por el trigger)
  INSERT INTO work_orders (
    asset_id,
    description,
    type,
    priority,
    status,
    requested_by,
    required_parts,
    estimated_cost,
    estimated_duration,
    incident_id,
    created_at,
    updated_at
  ) VALUES (
    v_incident.asset_id,
    'Orden correctiva por incidente: ' || v_incident.type || ' - ' || v_incident.description,
    'corrective',
    p_priority,
    'Pendiente',
    v_incident.created_by,
    v_required_parts,
    CASE WHEN v_estimated_cost > 0 THEN v_estimated_cost ELSE NULL END,
    CASE WHEN v_incident.labor_hours IS NOT NULL THEN v_incident.labor_hours ELSE NULL END,
    p_incident_id,
    NOW(),
    NOW()
  ) RETURNING id, order_id INTO v_work_order_id, v_order_id;

  -- Log del ID generado para auditoría
  RAISE NOTICE 'Work order created with ID: % and order_id: %', v_work_order_id, v_order_id;

  -- Actualizar el incidente con el ID de la orden de trabajo
  UPDATE incident_history
  SET work_order_id = v_work_order_id,
      updated_at = NOW()
  WHERE id = p_incident_id;

  -- NOTA: Se removió el cambio automático de estado del activo a 'maintenance'
  -- Los activos mantendrán su estado actual cuando se crean órdenes de trabajo
  -- El estado se establecerá a 'operational' cuando la orden de trabajo se complete

  RETURN v_work_order_id;
END;
$$;

