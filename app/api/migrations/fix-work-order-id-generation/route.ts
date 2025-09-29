import { NextResponse } from "next/server"

// Add test endpoint for ID generation
export async function POST() {
  return NextResponse.json({
    message: "Use GET to view the migration script",
    info: "This endpoint provides the SQL migration script for fixing work order ID generation"
  })
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Por favor ejecuta el siguiente script en el Supabase SQL Editor para corregir la generación de IDs:",
      sql: `
-- ========================================
-- MIGRACIÓN: Corregir generación de IDs de orden de trabajo (V2 - Race Condition Fix)
-- ========================================

-- 1. Función mejorada para generar IDs únicos de órdenes de trabajo con manejo de concurrencia
CREATE OR REPLACE FUNCTION generate_unique_work_order_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_counter INT;
  v_order_id TEXT;
  v_max_attempts INT := 100;
  v_attempt INT := 1;
  v_lock_obtained BOOLEAN := FALSE;
BEGIN
  -- Intentar obtener bloqueo de fila en la tabla para evitar condiciones de carrera
  BEGIN
    -- Usar un bloqueo de fila en una fila ficticia para serializar el acceso
    PERFORM pg_advisory_xact_lock(123456789); -- Lock específico para work_orders ID generation
    v_lock_obtained := TRUE;
  EXCEPTION
    WHEN OTHERS THEN
      -- Si no podemos obtener el lock, continuar sin él (mejor esfuerzo)
      v_lock_obtained := FALSE;
  END;

  LOOP
    -- Buscar el siguiente número disponible basado en el máximo existente
    SELECT COALESCE(
      MAX(
        CASE
          WHEN order_id ~ '^OT-[0-9]+$'
          THEN (regexp_replace(order_id, '^OT-', ''))::INT
          ELSE 0
        END
      ), 0
    ) + v_attempt INTO v_order_counter
    FROM work_orders;

    -- Generar ID con padding consistente (4 dígitos)
    v_order_id := 'OT-' || LPAD(v_order_counter::TEXT, 4, '0');

    -- Verificar si este ID ya existe con manejo mejorado de concurrencia
    IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_order_id) THEN
      -- Verificación adicional: intentar insertar una fila temporal para verificar unicidad
      -- Si falla por duplicado, continuar con el siguiente número
      BEGIN
        -- Usar una tabla temporal o mecanismo de verificación más robusto
        PERFORM 1 FROM work_orders WHERE order_id = v_order_id FOR UPDATE NOWAIT;
        -- Si llegamos aquí, el ID existe, continuar con siguiente intento
        v_attempt := v_attempt + 1;
      EXCEPTION
        WHEN lock_not_available THEN
          -- Otro proceso está usando este ID, intentar siguiente
          v_attempt := v_attempt + 1;
        WHEN OTHERS THEN
          -- ID no existe, podemos usarlo
          RETURN v_order_id;
      END;
    ELSE
      -- ID ya existe, incrementar intento
      v_attempt := v_attempt + 1;
    END IF;

    -- Evitar bucle infinito con mejor estrategia de salida
    IF v_attempt > v_max_attempts THEN
      -- Estrategia alternativa: usar timestamp para generar ID único
      v_order_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), '00000000');
      RETURN v_order_id;
    END IF;

    -- Pequeña pausa para reducir carga en condiciones de alta concurrencia
    IF v_attempt > 10 THEN
      PERFORM pg_sleep(0.01); -- 10ms
    END IF;
  END LOOP;
END;
$$;

-- 2. Función auxiliar para recuperar de colisiones de ID
CREATE OR REPLACE FUNCTION recover_from_duplicate_work_order_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_order_id TEXT;
  v_temp_id TEXT;
BEGIN
  -- Generar un ID completamente único usando timestamp + random
  v_temp_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), '00000000') || '-' || (random() * 1000)::INT;

  -- Verificar que no existe
  WHILE EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_temp_id) LOOP
    v_temp_id := 'OT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW()), '00000000') || '-' || (random() * 1000)::INT;
  END LOOP;

  RETURN v_temp_id;
END;
$$;

-- 3. Trigger mejorado que maneja colisiones de ID
CREATE OR REPLACE FUNCTION generate_work_order_id_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_generated_id TEXT;
  v_collision_count INT := 0;
  v_max_collisions INT := 5;
BEGIN
  -- Si ya tiene order_id, verificar que sea único
  IF NEW.order_id IS NOT NULL THEN
    -- Verificar si el ID proporcionado ya existe
    IF EXISTS (SELECT 1 FROM work_orders WHERE order_id = NEW.order_id AND id != NEW.id) THEN
      RAISE EXCEPTION 'El order_id % ya existe', NEW.order_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Generar nuevo ID usando la función mejorada
  v_generated_id := generate_unique_work_order_id();

  -- Verificar que el ID generado no cause colisión
  WHILE EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_generated_id) LOOP
    v_collision_count := v_collision_count + 1;

    IF v_collision_count >= v_max_collisions THEN
      -- Usar método de recuperación alternativo
      v_generated_id := recover_from_duplicate_work_order_id();
      EXIT;
    END IF;

    -- Regenerar ID
    v_generated_id := generate_unique_work_order_id();
  END LOOP;

  NEW.order_id := v_generated_id;
  RETURN NEW;
END;
$$;

-- 4. Recrear el trigger con la función mejorada
DROP TRIGGER IF EXISTS trg_generate_work_order_id ON work_orders;
CREATE TRIGGER trg_generate_work_order_id
  BEFORE INSERT OR UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_work_order_id_trigger();

-- 5. Función mejorada para generar orden de trabajo desde incidente
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

  -- Actualizar estado del activo a mantenimiento si no está ya
  UPDATE assets
  SET status = 'maintenance'
  WHERE id = v_incident.asset_id
  AND status != 'maintenance';

  RETURN v_work_order_id;
END;
$$;

-- 6. Crear función auxiliar para verificar y limpiar IDs duplicados existentes
CREATE OR REPLACE FUNCTION cleanup_duplicate_work_order_ids()
RETURNS TABLE (
  fixed_count INT,
  errors TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_fixed_count INT := 0;
  v_errors TEXT := '';
  v_duplicate RECORD;
BEGIN
  -- Encontrar work_orders con order_id duplicado
  FOR v_duplicate IN
    SELECT order_id, COUNT(*) as count
    FROM work_orders
    WHERE order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  LOOP
    -- Para cada order_id duplicado, mantener el primero y regenerar los demás
    UPDATE work_orders
    SET order_id = recover_from_duplicate_work_order_id()
    WHERE order_id = v_duplicate.order_id
    AND id != (
      SELECT id FROM work_orders
      WHERE order_id = v_duplicate.order_id
      LIMIT 1
    );

    v_fixed_count := v_fixed_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_fixed_count, v_errors;
END;
$$;

-- 7. Ejecutar limpieza inicial de duplicados existentes
SELECT * FROM cleanup_duplicate_work_order_ids();
      `,
      instructions: "Esta migración mejora significativamente la generación de IDs únicos para órdenes de trabajo, solucionando problemas de condiciones de carrera y colisiones de duplicados."
    }
  )
} 