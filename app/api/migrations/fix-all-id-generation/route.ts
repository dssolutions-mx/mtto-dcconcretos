import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { 
      message: "Por favor ejecuta el siguiente script en el Supabase SQL Editor para corregir todas las generaciones de IDs:",
      sql: `
-- ========================================
-- MIGRACIÓN INTEGRAL: Corregir generación de IDs únicos
-- ========================================

-- 1. Función auxiliar para generar IDs únicos de órdenes de trabajo
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
      RAISE EXCEPTION 'No se pudo generar un ID único de orden de trabajo después de % intentos', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- 2. Función auxiliar para generar IDs únicos de órdenes de compra
CREATE OR REPLACE FUNCTION generate_unique_purchase_order_id()
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
          WHEN order_id ~ '^OC-[0-9]+$' 
          THEN (RIGHT(order_id, -3))::INT 
          ELSE 0 
        END
      ), 0
    ) + v_attempt INTO v_order_counter 
    FROM purchase_orders;
    
    v_order_id := 'OC-' || LPAD(v_order_counter::TEXT, 4, '0');
    
    -- Verificar si este ID ya existe
    IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE order_id = v_order_id) THEN
      RETURN v_order_id; -- ID único encontrado
    END IF;
    
    -- Incrementar intento
    v_attempt := v_attempt + 1;
    
    -- Evitar bucle infinito
    IF v_attempt > v_max_attempts THEN
      RAISE EXCEPTION 'No se pudo generar un ID único de orden de compra después de % intentos', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- 3. Actualizar función generate_work_order_from_incident con lógica de ID mejorada
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
  
  -- Generar ID único para la orden de trabajo usando la función auxiliar
  v_order_id := generate_unique_work_order_id();
  
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
  
  RETURN v_work_order_id;
END;
$$;

-- 4. Actualizar función generate_purchase_order con lógica de ID mejorada
CREATE OR REPLACE FUNCTION generate_purchase_order(
  p_work_order_id UUID,
  p_supplier TEXT,
  p_items JSONB,
  p_requested_by UUID = NULL,
  p_expected_delivery_date TIMESTAMPTZ = NOW(),
  p_quotation_url TEXT = NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id TEXT;
  v_po_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
BEGIN
  -- Generar ID único para la orden de compra usando la función auxiliar
  v_order_id := generate_unique_purchase_order_id();
  
  -- Calcular el monto total de los ítems
  SELECT COALESCE(SUM((item->>'total_price')::DECIMAL), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) AS item;
  
  -- Insertar la orden de compra
  INSERT INTO purchase_orders (
    order_id,
    work_order_id,
    supplier,
    items,
    total_amount,
    status,
    requested_by,
    expected_delivery_date,
    quotation_url
  ) VALUES (
    v_order_id,
    p_work_order_id,
    p_supplier,
    p_items,
    v_total_amount,
    'Pendiente',
    p_requested_by,
    p_expected_delivery_date,
    p_quotation_url
  ) RETURNING id INTO v_po_id;
  
  -- Actualizar la orden de trabajo con el ID de la orden de compra
  UPDATE work_orders
  SET purchase_order_id = v_po_id,
      updated_at = NOW()
  WHERE id = p_work_order_id;
  
  RETURN v_po_id;
END;
$$;

-- 5. Crear trigger para generar order_id automáticamente en work_orders
CREATE OR REPLACE FUNCTION generate_work_order_id_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    NEW.order_id := generate_unique_work_order_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe y crear uno nuevo
DROP TRIGGER IF EXISTS trg_generate_work_order_id ON work_orders;
CREATE TRIGGER trg_generate_work_order_id
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_work_order_id_trigger();

-- 6. Crear trigger para generar order_id automáticamente en purchase_orders
CREATE OR REPLACE FUNCTION generate_purchase_order_id_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    NEW.order_id := generate_unique_purchase_order_id();
  END IF;
  RETURN NEW;
END;
$$;

-- Eliminar trigger existente si existe y crear uno nuevo
DROP TRIGGER IF EXISTS trg_generate_purchase_order_id ON purchase_orders;
CREATE TRIGGER trg_generate_purchase_order_id
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_purchase_order_id_trigger();

-- 7. Función para reparar IDs duplicados existentes (solo ejecutar si es necesario)
CREATE OR REPLACE FUNCTION fix_duplicate_order_ids()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  duplicate_work_order RECORD;
  duplicate_purchase_order RECORD;
  new_id TEXT;
  fixed_count INT := 0;
BEGIN
  -- Arreglar órdenes de trabajo duplicadas
  FOR duplicate_work_order IN 
    SELECT order_id, array_agg(id) as ids
    FROM work_orders 
    WHERE order_id IS NOT NULL
    GROUP BY order_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer ID, cambiar los demás
    FOR i IN 2..array_length(duplicate_work_order.ids, 1) LOOP
      new_id := generate_unique_work_order_id();
      UPDATE work_orders 
      SET order_id = new_id 
      WHERE id = duplicate_work_order.ids[i];
      fixed_count := fixed_count + 1;
    END LOOP;
  END LOOP;
  
  -- Arreglar órdenes de compra duplicadas
  FOR duplicate_purchase_order IN 
    SELECT order_id, array_agg(id) as ids
    FROM purchase_orders 
    WHERE order_id IS NOT NULL
    GROUP BY order_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer ID, cambiar los demás
    FOR i IN 2..array_length(duplicate_purchase_order.ids, 1) LOOP
      new_id := generate_unique_purchase_order_id();
      UPDATE purchase_orders 
      SET order_id = new_id 
      WHERE id = duplicate_purchase_order.ids[i];
      fixed_count := fixed_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN 'Se corrigieron ' || fixed_count || ' IDs duplicados';
END;
$$;

-- COMENTARIO: Para ejecutar la reparación de IDs duplicados, ejecuta:
-- SELECT fix_duplicate_order_ids();
      `,
      instructions: [
        "Esta migración corrige todos los problemas de generación de IDs duplicados.",
        "1. Crea funciones auxiliares para generar IDs únicos de forma segura.",
        "2. Actualiza las funciones existentes para usar la nueva lógica.",
        "3. Crea triggers para generar automáticamente IDs únicos en nuevos registros.",
        "4. Incluye una función para reparar IDs duplicados existentes.",
        "5. Ejecuta 'SELECT fix_duplicate_order_ids();' si hay IDs duplicados en la base de datos."
      ]
    }
  )
} 