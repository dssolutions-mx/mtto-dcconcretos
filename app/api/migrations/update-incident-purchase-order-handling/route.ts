import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { 
      message: "Por favor ejecuta el siguiente script en el Supabase SQL Editor:",
      sql: `
-- ========================================
-- MIGRACIÓN: Mejorar manejo de evidencia y órdenes de compra desde incidentes
-- ========================================

-- 1. Actualizar la función generate_work_order_from_incident para mejor manejo de costos y evidencia
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
  v_evidence JSONB;
  v_parts_cost DECIMAL(10,2) := 0;
  v_labor_cost DECIMAL(10,2) := 0;
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
    INTO v_parts_cost
    FROM jsonb_array_elements(v_required_parts) AS part;
  END IF;
  
  -- Agregar costo de mano de obra si está disponible
  IF v_incident.labor_cost IS NOT NULL THEN
    v_labor_cost := v_incident.labor_cost::decimal;
  END IF;
  
  -- Calcular costo total estimado
  IF v_incident.total_cost IS NOT NULL AND v_incident.total_cost::decimal > 0 THEN
    -- Si hay un costo total definido en el incidente, usarlo
    v_estimated_cost := v_incident.total_cost::decimal;
  ELSE
    -- Calcular el costo total a partir de partes + mano de obra
    v_estimated_cost := v_parts_cost + v_labor_cost;
  END IF;
  
  -- Procesar evidencia del incidente
  IF v_incident.documents IS NOT NULL THEN
    -- Si es un array de strings (URLs), convertirlo a formato de evidencia
    IF jsonb_typeof(v_incident.documents) = 'array' THEN
      -- Verificar si el primer elemento es una cadena o un objeto
      IF jsonb_typeof(v_incident.documents->0) = 'string' THEN
        -- Es un array de strings, convertir a formato de evidencia
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', gen_random_uuid(),
            'url', url_item,
            'description', 'Evidencia de incidente: ' || v_incident.type,
            'category', 'identificacion_problema',
            'uploaded_at', COALESCE(v_incident.created_at, NOW())::text
          )
        ) INTO v_evidence
        FROM jsonb_array_elements_text(v_incident.documents) AS url_item;
      ELSE
        -- Ya es un array de objetos de evidencia, usarlo directamente
        v_evidence := v_incident.documents;
      END IF;
    END IF;
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
    creation_photos,
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
    v_evidence,
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

-- 2. Crear o actualizar la función para generar orden de compra de ajuste
CREATE OR REPLACE FUNCTION generate_adjustment_purchase_order(
  p_work_order_id UUID,
  p_supplier TEXT,
  p_items JSONB,
  p_requested_by UUID,
  p_original_po_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_counter INT;
  v_order_id TEXT;
  v_po_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
BEGIN
  -- Get the current order count to generate a sequential order ID
  SELECT COUNT(*) + 1 INTO v_order_counter FROM purchase_orders;
  
  -- Format the order ID
  v_order_id := 'OCA-' || LPAD(v_order_counter::TEXT, 4, '0');
  
  -- Calculate total amount from items
  SELECT COALESCE(SUM((item->>'total_price')::DECIMAL), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) AS item;
  
  -- Insert the adjustment purchase order
  INSERT INTO purchase_orders (
    order_id,
    work_order_id,
    supplier,
    items,
    total_amount,
    status,
    requested_by,
    expected_delivery_date,
    actual_delivery_date,
    approval_date,
    approved_by,
    is_adjustment,
    original_purchase_order_id
  ) VALUES (
    v_order_id,
    p_work_order_id,
    p_supplier,
    p_items,
    v_total_amount,
    'Recibida', -- Adjustment POs are typically already received
    p_requested_by,
    NOW(),
    NOW(),
    NOW(),
    p_requested_by,
    TRUE,
    p_original_po_id
  ) RETURNING id INTO v_po_id;
  
  RETURN v_po_id;
END;
$$;

-- 3. Asegurar que existan las columnas necesarias
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT FALSE;

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS original_purchase_order_id UUID REFERENCES purchase_orders(id);

-- 4. Actualizar la función para permitir generar órdenes de compra desde cualquier orden de trabajo
CREATE OR REPLACE FUNCTION should_allow_purchase_order_generation(
  p_work_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order RECORD;
  v_incident RECORD;
BEGIN
  -- Obtener los datos de la orden de trabajo
  SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
  
  IF v_work_order IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Si ya tiene una orden de compra, no permitir generar otra
  IF v_work_order.purchase_order_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Si tiene repuestos, permitir generación
  IF v_work_order.required_parts IS NOT NULL AND 
     jsonb_array_length(v_work_order.required_parts) > 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Si tiene costo estimado, permitir generación
  IF v_work_order.estimated_cost IS NOT NULL AND 
     v_work_order.estimated_cost > 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Si es correctiva, permitir generación
  IF v_work_order.type = 'corrective' THEN
    RETURN TRUE;
  END IF;
  
  -- Si proviene de un incidente, verificar datos del incidente
  IF v_work_order.incident_id IS NOT NULL THEN
    SELECT * INTO v_incident FROM incident_history WHERE id = v_work_order.incident_id;
    
    -- Si el incidente existe y tiene costos o partes, permitir generación
    IF v_incident IS NOT NULL THEN
      IF v_incident.total_cost IS NOT NULL OR
         v_incident.labor_cost IS NOT NULL OR
         v_incident.parts IS NOT NULL THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  -- Por defecto, no permitir
  RETURN FALSE;
END;
$$;
      `,
      instructions: "Ejecuta este script en el Supabase SQL Editor para mejorar la funcionalidad de generación de órdenes de trabajo desde incidentes, incluyendo transferencia de evidencia, costos y manejo de órdenes de compra."
    }
  )
} 