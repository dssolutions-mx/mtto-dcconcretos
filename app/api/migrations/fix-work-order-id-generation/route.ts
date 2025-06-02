import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { 
      message: "Por favor ejecuta el siguiente script en el Supabase SQL Editor para corregir la generación de IDs:",
      sql: `
-- ========================================
-- MIGRACIÓN: Corregir generación de IDs de orden de trabajo
-- ========================================

-- Actualizar función para generar orden de trabajo desde incidente con lógica de ID mejorada
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
  v_max_attempts INT := 100;
  v_attempt INT := 1;
BEGIN
  -- Obtener datos del incidente
  SELECT * INTO v_incident FROM incident_history WHERE id = p_incident_id;
  
  IF v_incident IS NULL THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;
  
  -- Generar ID único para la orden de trabajo
  LOOP
    -- Buscar el siguiente número disponible basado en el máximo existente
    SELECT COALESCE(
      MAX(
        CASE 
          WHEN order_id ~ '^OT-[0-9]+$' 
          THEN (RIGHT(order_id, -3))::INT 
          ELSE 0 
        END
      ), 0
    ) + v_attempt INTO v_order_counter 
    FROM work_orders;
    
    v_order_id := 'OT-' || LPAD(v_order_counter::TEXT, 4, '0');
    
    -- Verificar si este ID ya existe
    IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_order_id) THEN
      EXIT; -- ID único encontrado
    END IF;
    
    -- Incrementar intento
    v_attempt := v_attempt + 1;
    
    -- Evitar bucle infinito
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar un ID único después de % intentos', v_max_attempts;
    END IF;
  END LOOP;
  
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

-- También crear una función para generar IDs únicos para otras funciones similares
CREATE OR REPLACE FUNCTION generate_unique_work_order_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_counter INT;
  v_order_id TEXT;
  v_max_attempts INT := 100;
  v_attempt INT := 1;
BEGIN
  LOOP
    -- Buscar el siguiente número disponible basado en el máximo existente
    SELECT COALESCE(
      MAX(
        CASE 
          WHEN order_id ~ '^OT-[0-9]+$' 
          THEN (RIGHT(order_id, -3))::INT 
          ELSE 0 
        END
      ), 0
    ) + v_attempt INTO v_order_counter 
    FROM work_orders;
    
    v_order_id := 'OT-' || LPAD(v_order_counter::TEXT, 4, '0');
    
    -- Verificar si este ID ya existe
    IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_order_id) THEN
      RETURN v_order_id; -- ID único encontrado
    END IF;
    
    -- Incrementar intento
    v_attempt := v_attempt + 1;
    
    -- Evitar bucle infinito
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar un ID único después de % intentos', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;
      `,
      instructions: "Esta migración corrige el problema de IDs duplicados en las órdenes de trabajo generadas desde incidentes."
    }
  )
} 