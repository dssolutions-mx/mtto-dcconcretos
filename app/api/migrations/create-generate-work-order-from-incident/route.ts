import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { 
      message: "Por favor ejecuta el siguiente script en el Supabase SQL Editor:",
      sql: `
-- ========================================
-- MIGRACIÓN: Crear función generate_work_order_from_incident
-- ========================================

-- 1. Agregar columna incident_id a work_orders si no existe
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES incident_history(id);

-- 2. Crear función para generar orden de trabajo desde incidente
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
  v_order_counter INT;
  v_order_id TEXT;
  v_required_parts JSONB;
  v_estimated_cost DECIMAL(10,2) := 0;
BEGIN
  -- Obtener datos del incidente
  SELECT * INTO v_incident FROM incident_history WHERE id = p_incident_id;
  
  IF v_incident IS NULL THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;
  
  -- Generar ID secuencial para la orden de trabajo
  SELECT COUNT(*) + 1 INTO v_order_counter FROM work_orders;
  v_order_id := 'OT-' || LPAD(v_order_counter::TEXT, 4, '0');
  
  -- Procesar repuestos del incidente si existen
  IF v_incident.parts IS NOT NULL THEN
    -- Convertir partes del incidente al formato required_parts de work orders
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
    
    -- Calcular costo estimado de repuestos
    SELECT COALESCE(SUM((part->>'total_price')::decimal), 0)
    INTO v_estimated_cost
    FROM jsonb_array_elements(v_required_parts) AS part;
  END IF;
  
  -- Agregar costo de mano de obra si está disponible
  IF v_incident.labor_cost IS NOT NULL THEN
    v_estimated_cost := v_estimated_cost + v_incident.labor_cost::decimal;
  END IF;
  
  -- Crear la orden de trabajo
  INSERT INTO work_orders (
    order_id,
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
    v_order_id,
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
  ) RETURNING id INTO v_work_order_id;
  
  -- Actualizar el incidente con el ID de la orden de trabajo
  UPDATE incident_history
  SET work_order_id = v_work_order_id,
      updated_at = NOW()
  WHERE id = p_incident_id;
  
  -- Actualizar estado del activo a mantenimiento si no está ya
  UPDATE assets
  SET status = 'maintenance'
  WHERE id = v_incident.asset_id
  AND status != 'maintenance';
  
  RETURN v_work_order_id;
END;
$$;
      `,
      instructions: "Ejecuta este script en el Supabase SQL Editor para crear la función faltante y la columna incident_id."
    }
  )
} 