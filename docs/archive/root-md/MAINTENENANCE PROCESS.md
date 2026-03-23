# Proceso Completo: Mantenimientos Preventivos y Correctivos

## Proceso de Mantenimiento Preventivo

A diferencia de los correctivos (que nacen de incidencias), los preventivos siguen este flujo:

1. **Programación Automática**:
   - Sistema calcula cuándo se debe realizar el próximo mantenimiento según:
     - Horas/kilómetros acumulados
     - Calendario (frecuencia temporal)
   - Cuando un activo alcanza el 90% del intervalo, entra en "Próximo"

2. **Generación de Orden de Trabajo Preventiva**:
   - Se crea automáticamente o manualmente una OT preventiva
   - Incluye lista predefinida de tareas y repuestos necesarios
   - Estado inicial: "Planificada"

3. **Proceso de Compra Anticipada**:
   - Se genera OC para repuestos con anticipación
   - El proceso de aprobación es similar pero menos urgente
   - Logística puede planificar compras más eficientemente

4. **Ejecución Planificada**:
   - Se asigna fecha específica y técnico
   - Se ejecuta usando checklist preventivo predefinido
   - Se registran todos los trabajos realizados

5. **Cierre**:
   - Se completa la OT
   - Se genera OS
   - Se actualiza mantenimiento_history
   - Se recalcula próximo mantenimiento

## Estructura Completa del Sistema (Revisada)

### 1. Tablas Base

```sql
CREATE TABLE equipment_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id TEXT NOT NULL UNIQUE,         -- ID personalizado (ej: "MOD001")
  name TEXT NOT NULL,                    -- Nombre del modelo
  manufacturer TEXT NOT NULL,            -- Fabricante
  category TEXT NOT NULL,                -- Categoría (Excavadora, Generador, etc.)
  description TEXT,                      -- Descripción general
  year_introduced INTEGER,               -- Año de introducción
  expected_lifespan INTEGER,             -- Vida útil esperada en años
  specifications JSONB,                  -- Especificaciones técnicas
  maintenance_unit TEXT NOT NULL DEFAULT 'hours', -- Unidad de medida (hours/kilometers)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_intervals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID REFERENCES equipment_models(id) ON DELETE CASCADE,
  interval_value INTEGER NOT NULL,       -- Valor del intervalo (horas o kilómetros)
  name TEXT NOT NULL,                    -- Nombre del mantenimiento
  description TEXT,                      -- Descripción
  type TEXT NOT NULL,                    -- Tipo (Básico, Intermedio, Completo)
  estimated_duration FLOAT,              -- Duración estimada en horas
  required_parts JSONB,                  -- Repuestos necesarios para este mantenimiento
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id TEXT NOT NULL UNIQUE,         -- ID personalizado (ej: "EQ-001")
  name TEXT NOT NULL,                    -- Nombre del activo
  model_id UUID REFERENCES equipment_models(id),
  serial_number TEXT,                    -- Número de serie
  location TEXT,                         -- Ubicación
  department TEXT,                       -- Departamento
  purchase_date TIMESTAMPTZ,             -- Fecha de adquisición
  installation_date TIMESTAMPTZ,         -- Fecha de instalación
  initial_hours INTEGER DEFAULT 0,       -- Horas iniciales
  current_hours INTEGER DEFAULT 0,       -- Horas actuales
  initial_kilometers INTEGER DEFAULT 0,  -- Kilómetros iniciales
  current_kilometers INTEGER DEFAULT 0,  -- Kilómetros actuales
  status TEXT DEFAULT 'operational',     -- Estado (operational, maintenance, repair, inactive, retired)
  notes TEXT,                            -- Notas adicionales
  warranty_expiration TIMESTAMPTZ,       -- Vencimiento de garantía
  is_new BOOLEAN DEFAULT true,           -- Si es nuevo
  purchase_cost DECIMAL(10, 2),          -- Costo de adquisición
  registration_info TEXT,                -- Información de registro
  insurance_policy TEXT,                 -- Número de póliza
  insurance_start_date TIMESTAMPTZ,      -- Inicio de cobertura
  insurance_end_date TIMESTAMPTZ,        -- Fin de cobertura
  photos TEXT[],                         -- URLs de fotos en Storage
  insurance_documents TEXT[],            -- URLs de documentos de seguro
  last_maintenance_date TIMESTAMPTZ,     -- Fecha del último mantenimiento
  created_by UUID,                       -- ID del usuario que creó el registro
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  interval_id UUID REFERENCES maintenance_intervals(id),
  interval_value INTEGER NOT NULL,       -- Valor para el mantenimiento (horas o km)
  name TEXT NOT NULL,                    -- Nombre del plan
  description TEXT,                      -- Descripción
  last_completed TIMESTAMPTZ,            -- Último completado
  next_due TIMESTAMPTZ,                  -- Próximo vencimiento
  status TEXT DEFAULT 'Programado',      -- Estado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Tablas de Checklists

```sql
CREATE TABLE checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- Nombre del checklist
  model_id UUID REFERENCES equipment_models(id),
  interval_id UUID REFERENCES maintenance_intervals(id),
  type TEXT NOT NULL DEFAULT 'preventive', -- preventive/corrective
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                   -- Título de la sección
  order_index INTEGER NOT NULL,          -- Orden de la sección
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID REFERENCES checklist_sections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,                 -- ID del ítem (ej: "1.1")
  description TEXT NOT NULL,             -- Descripción del ítem
  required BOOLEAN DEFAULT true,         -- Si es obligatorio
  order_index INTEGER NOT NULL,          -- Orden del ítem
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE completed_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES checklists(id),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  work_order_id UUID,                    -- Orden de trabajo asociada (si es preventivo)
  item_status JSONB NOT NULL,            -- Estado de cada ítem (pass/flag/fail)
  item_notes JSONB,                      -- Notas por ítem
  item_photos JSONB,                     -- Fotos por ítem
  technician_id UUID NOT NULL,           -- Técnico responsable
  technician_name TEXT NOT NULL,         -- Nombre del técnico
  signature TEXT,                        -- Firma digital
  completion_date TIMESTAMPTZ NOT NULL,  -- Fecha de completado
  notes TEXT,                            -- Notas generales
  status TEXT DEFAULT 'Completado',      -- Estado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE checklist_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id UUID REFERENCES completed_checklists(id),
  item_id TEXT NOT NULL,                 -- ID del ítem del checklist
  status TEXT NOT NULL,                  -- "flag" o "fail"
  description TEXT NOT NULL,             -- Descripción del ítem
  notes TEXT,                            -- Notas del técnico
  photo_url TEXT,                        -- URL de la foto
  work_order_id UUID,                    -- Referencia a la orden de trabajo generada
  resolved BOOLEAN DEFAULT false,        -- Si ha sido resuelto
  resolution_date TIMESTAMPTZ,           -- Fecha de resolución
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Tablas de Órdenes

```sql
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL UNIQUE,         -- ID personalizado (ej: "OT-1234")
  asset_id UUID REFERENCES assets(id),
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'corrective', -- preventive/corrective
  requested_by UUID,                     -- Solicitante
  assigned_to UUID,                      -- Técnico asignado
  planned_date TIMESTAMPTZ,
  estimated_duration FLOAT,
  priority TEXT DEFAULT 'Media',         -- Baja, Media, Alta, Crítica
  status TEXT DEFAULT 'Pendiente',       -- Pendiente, Cotizada, Aprobada, En ejecución, Completada
  required_parts JSONB,                  -- Repuestos preliminares
  estimated_cost DECIMAL(10, 2),
  
  -- Nuevos campos
  checklist_id UUID,                     -- Checklist que originó la OT (correctivas)
  maintenance_plan_id UUID,              -- Plan de mant. que originó la OT (preventivas)
  issue_items JSONB,                     -- Ítems con problemas (correctivas)
  purchase_order_id UUID,                -- Orden de compra asociada
  approval_status TEXT,                  -- Estado de aprobación
  approved_by UUID,                      -- Quién aprobó
  approval_date TIMESTAMPTZ,             -- Cuándo se aprobó
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL UNIQUE,         -- ID personalizado (ej: "OC-1234")
  work_order_id UUID REFERENCES work_orders(id),
  supplier TEXT,                         -- Proveedor
  total_amount DECIMAL(10, 2),
  requested_by UUID,
  approved_by UUID,
  approval_date TIMESTAMPTZ,
  expected_delivery_date TIMESTAMPTZ,
  actual_delivery_date TIMESTAMPTZ,
  status TEXT DEFAULT 'Pendiente',       -- Pendiente, Aprobada, Rechazada, Pedida, Recibida
  items JSONB,                           -- Ítems a comprar
  notes TEXT,
  invoice_number TEXT,                   -- Número de factura
  invoice_date TIMESTAMPTZ,
  payment_status TEXT,                   -- Estado de pago
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL UNIQUE,         -- ID personalizado (ej: "OS-1234")
  work_order_id UUID REFERENCES work_orders(id),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,              -- Nombre del activo
  type TEXT NOT NULL,                    -- Preventivo, Correctivo
  priority TEXT DEFAULT 'Media',         -- Prioridad
  status TEXT DEFAULT 'Completado',      -- Estado
  date TIMESTAMPTZ NOT NULL,             -- Fecha
  technician_id UUID,                    -- Técnico asignado ID
  technician TEXT NOT NULL,              -- Técnico nombre
  description TEXT NOT NULL,             -- Descripción
  findings TEXT,                         -- Hallazgos
  actions TEXT,                          -- Acciones realizadas
  notes TEXT,                            -- Notas
  parts JSONB,                           -- Repuestos utilizados
  labor_hours FLOAT,                     -- Horas de trabajo
  labor_cost DECIMAL(10, 2),             -- Costo de mano de obra
  parts_cost DECIMAL(10, 2),             -- Costo de repuestos
  total_cost DECIMAL(10, 2),             -- Costo total
  checklist_id UUID REFERENCES checklists(id),
  documents TEXT[],                      -- URLs de documentos relacionados
  created_by UUID,                       -- ID del usuario que creó la orden
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Tablas de Historiales

```sql
CREATE TABLE maintenance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,             -- Fecha del mantenimiento
  type TEXT NOT NULL,                    -- Preventivo, Correctivo
  hours INTEGER,                         -- Horas del equipo
  kilometers INTEGER,                    -- Kilómetros del equipo
  description TEXT NOT NULL,             -- Descripción
  findings TEXT,                         -- Hallazgos
  actions TEXT,                          -- Acciones realizadas
  technician_id UUID,                    -- ID del técnico responsable
  technician TEXT NOT NULL,              -- Nombre del técnico
  labor_hours FLOAT,                     -- Horas de trabajo
  labor_cost DECIMAL(10, 2),             -- Costo de mano de obra
  parts JSONB,                           -- Repuestos utilizados
  parts_cost DECIMAL(10, 2),             -- Costo de repuestos
  total_cost DECIMAL(10, 2),             -- Costo total
  work_order_id UUID,                    -- Orden de trabajo relacionada
  service_order_id UUID,                 -- Orden de servicio relacionada
  maintenance_plan_id UUID,              -- Plan de mantenimiento relacionado
  documents TEXT[],                      -- URLs de documentos relacionados
  created_by UUID,                       -- ID del usuario que registró
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,             -- Fecha del incidente
  type TEXT NOT NULL,                    -- Tipo (Falla, Advertencia)
  reported_by_id UUID,                   -- ID de quien reportó
  reported_by TEXT NOT NULL,             -- Nombre de quien reportó
  description TEXT NOT NULL,             -- Descripción
  impact TEXT,                           -- Impacto
  resolution TEXT,                       -- Resolución
  downtime FLOAT,                        -- Tiempo fuera de servicio (horas)
  labor_hours FLOAT,                     -- Horas de trabajo
  labor_cost DECIMAL(10, 2),             -- Costo de mano de obra
  parts JSONB,                           -- Repuestos utilizados
  parts_cost DECIMAL(10, 2),             -- Costo de repuestos
  total_cost DECIMAL(10, 2),             -- Costo total
  work_order_id UUID,                    -- Orden de trabajo relacionada
  service_order_id UUID,                 -- Orden de servicio relacionada
  checklist_id UUID,                     -- Checklist donde se detectó
  status TEXT DEFAULT 'Resuelto',        -- Estado
  documents TEXT[],                      -- URLs de documentos relacionados
  created_by UUID,                       -- ID del usuario que registró
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Principales Funciones del Sistema

### 1. Generación de Órdenes de Trabajo Preventivas

```sql
CREATE OR REPLACE FUNCTION generate_preventive_work_order(
  p_asset_id UUID,
  p_maintenance_plan_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_maintenance_interval RECORD;
  v_work_order_id UUID;
BEGIN
  -- Obtener información del plan de mantenimiento
  SELECT 
    mp.interval_value,
    mp.name,
    mp.description,
    mi.required_parts,
    mi.estimated_duration
  INTO v_maintenance_interval
  FROM maintenance_plans mp
  JOIN maintenance_intervals mi ON mp.interval_id = mi.id
  WHERE mp.id = p_maintenance_plan_id;
  
  -- Generar la orden de trabajo preventiva
  INSERT INTO work_orders (
    asset_id,
    description,
    type,
    priority,
    status,
    maintenance_plan_id,
    required_parts,
    estimated_duration,
    estimated_cost
  ) VALUES (
    p_asset_id,
    'Mantenimiento Preventivo: ' || v_maintenance_interval.name,
    'preventive',
    'Media',
    'Planificada',
    p_maintenance_plan_id,
    v_maintenance_interval.required_parts,
    v_maintenance_interval.estimated_duration,
    (SELECT SUM((part->>'cost')::decimal * (part->>'quantity')::int) 
     FROM jsonb_array_elements(v_maintenance_interval.required_parts) AS part)
  )
  RETURNING id INTO v_work_order_id;
  
  -- Actualizar el plan de mantenimiento
  UPDATE maintenance_plans
  SET status = 'En proceso'
  WHERE id = p_maintenance_plan_id;
  
  RETURN v_work_order_id;
END;
$$ LANGUAGE plpgsql;
```

### 2. Generación de Órdenes de Trabajo Correctivas (desde Checklist)

```sql
CREATE OR REPLACE FUNCTION generate_corrective_work_order(
  p_checklist_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_asset_id UUID;
  v_issues JSONB;
  v_work_order_id UUID;
BEGIN
  -- Obtener asset_id y los ítems con problemas
  SELECT cc.asset_id, 
         jsonb_agg(
           jsonb_build_object(
             'item_id', ci.item_id,
             'status', ci.status,
             'description', ci.description,
             'notes', ci.notes,
             'photo_url', ci.photo_url
           )
         )
  INTO v_asset_id, v_issues
  FROM completed_checklists cc
  JOIN checklist_issues ci ON cc.id = ci.checklist_id
  WHERE cc.id = p_checklist_id
  GROUP BY cc.asset_id;
  
  -- Generar la orden de trabajo correctiva
  INSERT INTO work_orders (
    asset_id,
    description,
    type,
    priority,
    status,
    checklist_id,
    issue_items
  ) VALUES (
    v_asset_id,
    'Acción correctiva generada desde checklist',
    'corrective',
    CASE 
      WHEN EXISTS (SELECT 1 FROM checklist_issues WHERE checklist_id = p_checklist_id AND status = 'fail')
      THEN 'Alta'
      ELSE 'Media'
    END,
    'Pendiente',
    p_checklist_id,
    v_issues
  )
  RETURNING id INTO v_work_order_id;
  
  -- Actualizar checklist_issues con la orden generada
  UPDATE checklist_issues
  SET work_order_id = v_work_order_id
  WHERE checklist_id = p_checklist_id;
  
  -- Actualizar el estado del activo
  UPDATE assets
  SET status = 'maintenance'
  WHERE id = v_asset_id;
  
  RETURN v_work_order_id;
END;
$$ LANGUAGE plpgsql;
```

### 3. Generar Orden de Compra

```sql
CREATE OR REPLACE FUNCTION generate_purchase_order(
  p_work_order_id UUID,
  p_supplier TEXT,
  p_items JSONB,
  p_requested_by UUID,
  p_expected_delivery_date TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_total_amount DECIMAL(10, 2);
  v_po_id UUID;
BEGIN
  -- Calcular monto total
  SELECT COALESCE(SUM((item->>'quantity')::int * (item->>'unit_price')::decimal), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(p_items) AS item;
  
  -- Crear orden de compra
  INSERT INTO purchase_orders (
    work_order_id,
    supplier,
    total_amount,
    requested_by,
    expected_delivery_date,
    status,
    items
  ) VALUES (
    p_work_order_id,
    p_supplier,
    v_total_amount,
    p_requested_by,
    p_expected_delivery_date,
    'Pendiente',
    p_items
  )
  RETURNING id INTO v_po_id;
  
  -- Actualizar orden de trabajo
  UPDATE work_orders
  SET 
    purchase_order_id = v_po_id,
    status = 'En cotización',
    estimated_cost = v_total_amount,
    updated_at = NOW()
  WHERE id = p_work_order_id;
  
  RETURN v_po_id;
END;
$$ LANGUAGE plpgsql;
```

### 4. Aprobar Orden de Compra

```sql
CREATE OR REPLACE FUNCTION approve_purchase_order(
  p_purchase_order_id UUID,
  p_approved_by UUID
)
RETURNS VOID AS $$
BEGIN
  -- Actualizar orden de compra
  UPDATE purchase_orders
  SET 
    status = 'Aprobada',
    approved_by = p_approved_by,
    approval_date = NOW(),
    updated_at = NOW()
  WHERE id = p_purchase_order_id;
  
  -- Actualizar orden de trabajo asociada
  UPDATE work_orders
  SET 
    status = 'Aprobada',
    approval_status = 'Aprobada',
    approved_by = p_approved_by,
    approval_date = NOW(),
    updated_at = NOW()
  WHERE purchase_order_id = p_purchase_order_id;
END;
$$ LANGUAGE plpgsql;
```

### 5. Completar Orden de Trabajo y Generar Orden de Servicio

```sql
CREATE OR REPLACE FUNCTION complete_work_order(
  p_work_order_id UUID,
  p_completion_data JSONB -- Datos completos de finalización
)
RETURNS UUID AS $$
DECLARE
  v_asset_id UUID;
  v_work_order RECORD;
  v_service_order_id UUID;
  v_parts_cost DECIMAL(10, 2);
  v_labor_cost DECIMAL(10, 2);
  v_total_cost DECIMAL(10, 2);
  v_is_preventive BOOLEAN;
BEGIN
  -- Obtener información de la orden de trabajo
  SELECT 
    wo.*,
    a.current_hours,
    a.current_kilometers,
    CASE WHEN wo.type = 'preventive' THEN true ELSE false END as is_preventive
  INTO v_work_order
  FROM work_orders wo
  JOIN assets a ON wo.asset_id = a.id
  WHERE wo.id = p_work_order_id;
  
  v_asset_id := v_work_order.asset_id;
  v_is_preventive := v_work_order.is_preventive;
  
  -- Calcular costos
  SELECT COALESCE(SUM((part->>'quantity')::int * (part->>'cost')::decimal), 0)
  INTO v_parts_cost
  FROM jsonb_array_elements(p_completion_data->'parts_used') AS part;
  
  v_labor_cost := COALESCE((p_completion_data->>'labor_cost')::decimal, 0);
  v_total_cost := v_parts_cost + v_labor_cost;
  
  -- Generar orden de servicio
  INSERT INTO service_orders (
    work_order_id,
    asset_id,
    asset_name,
    type,
    status,
    date,
    technician_id,
    technician,
    description,
    findings,
    actions,
    notes,
    parts,
    labor_hours,
    labor_cost,
    parts_cost,
    total_cost,
    checklist_id,
    documents
  ) VALUES (
    p_work_order_id,
    v_asset_id,
    (SELECT name FROM assets WHERE id = v_asset_id),
    v_work_order.type,
    'Completado',
    (p_completion_data->>'completion_date')::timestamptz,
    (p_completion_data->>'technician_id')::uuid,
    p_completion_data->>'technician_name',
    v_work_order.description,
    p_completion_data->>'findings',
    p_completion_data->>'actions',
    p_completion_data->>'notes',
    p_completion_data->'parts_used',
    (p_completion_data->>'labor_hours')::float,
    v_labor_cost,
    v_parts_cost,
    v_total_cost,
    v_work_order.checklist_id,
    p_completion_data->'photos'
  )
  RETURNING id INTO v_service_order_id;
  
  -- Actualizar orden de trabajo
  UPDATE work_orders
  SET 
    status = 'Completada',
    updated_at = NOW()
  WHERE id = p_work_order_id;
  
  -- Registrar en maintenance_history
  INSERT INTO maintenance_history (
    asset_id,
    date,
    type,
    hours,
    kilometers,
    description,
    findings,
    actions,
    technician_id,
    technician,
    labor_hours,
    labor_cost,
    parts,
    parts_cost,
    total_cost,
    work_order_id,
    service_order_id,
    maintenance_plan_id,
    documents,
    created_by
  ) VALUES (
    v_asset_id,
    (p_completion_data->>'completion_date')::timestamptz,
    v_work_order.type,
    COALESCE((p_completion_data->>'asset_hours')::int, v_work_order.current_hours),
    COALESCE((p_completion_data->>'asset_kilometers')::int, v_work_order.current_kilometers),
    v_work_order.description,
    p_completion_data->>'findings',
    p_completion_data->>'actions',
    (p_completion_data->>'technician_id')::uuid,
    p_completion_data->>'technician_name',
    (p_completion_data->>'labor_hours')::float,
    v_labor_cost,
    p_completion_data->'parts_used',
    v_parts_cost,
    v_total_cost,
    p_work_order_id,
    v_service_order_id,
    v_work_order.maintenance_plan_id,
    p_completion_data->'photos',
    (p_completion_data->>'created_by')::uuid
  );
  
  -- Si es correctivo, registrar en incident_history
  IF NOT v_is_preventive AND v_work_order.checklist_id IS NOT NULL THEN
    INSERT INTO incident_history (
      asset_id,
      date,
      type,
      reported_by_id,
      reported_by,
      description,
      resolution,
      labor_hours,
      labor_cost,
      parts,
      parts_cost,
      total_cost,
      work_order_id,
      service_order_id,
      checklist_id,
      status,
      documents,
      created_by
    ) VALUES (
      v_asset_id,
      (p_completion_data->>'completion_date')::timestamptz,
      'Falla',
      (p_completion_data->>'reported_by_id')::uuid,
      p_completion_data->>'reported_by_name',
      v_work_order.description,
      p_completion_data->>'actions',
      (p_completion_data->>'labor_hours')::float,
      v_labor_cost,
      p_completion_data->'parts_used',
      v_parts_cost,
      v_total_cost,
      p_work_order_id,
      v_service_order_id,
      v_work_order.checklist_id,
      'Resuelto',
      p_completion_data->'photos',
      (p_completion_data->>'created_by')::uuid
    );
    
    -- Actualizar checklist_issues como resueltos
    UPDATE checklist_issues
    SET 
      resolved = true,
      resolution_date = (p_completion_data->>'completion_date')::timestamptz
    WHERE work_order_id = p_work_order_id;
  END IF;
  
  -- Si es preventivo, actualizar el plan de mantenimiento
  IF v_is_preventive AND v_work_order.maintenance_plan_id IS NOT NULL THEN
    UPDATE maintenance_plans
    SET 
      last_completed = (p_completion_data->>'completion_date')::timestamptz,
      status = 'Completado',
      next_due = (
        SELECT calculate_next_maintenance(
          v_asset_id,
          interval_value
        )
      )
    WHERE id = v_work_order.maintenance_plan_id;
  END IF;
  
  -- Actualizar el estado y datos del activo
  UPDATE assets
  SET 
    status = 'operational',
    last_maintenance_date = (p_completion_data->>'completion_date')::timestamptz,
    current_hours = COALESCE((p_completion_data->>'asset_hours')::int, current_hours),
    current_kilometers = COALESCE((p_completion_data->>'asset_kilometers')::int, current_kilometers)
  WHERE id = v_asset_id;
  
  RETURN v_service_order_id;
END;
$$ LANGUAGE plpgsql;
```

### 6. Verificar Activos que Necesitan Mantenimiento

```sql
CREATE OR REPLACE FUNCTION check_maintenance_due_assets()
RETURNS TABLE (
  asset_id UUID,
  asset_name TEXT,
  maintenance_plan_id UUID,
  plan_name TEXT, 
  next_due TIMESTAMPTZ,
  days_remaining INTEGER,
  value_remaining INTEGER,
  maintenance_unit TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as asset_id,
    a.name as asset_name,
    mp.id as maintenance_plan_id,
    mp.name as plan_name,
    mp.next_due,
    EXTRACT(DAY FROM mp.next_due - CURRENT_DATE)::INTEGER as days_remaining,
    CASE 
      WHEN em.maintenance_unit = 'hours' THEN 
        (mi.interval_value - (a.current_hours % mi.interval_value))
      ELSE 
        (mi.interval_value - (a.current_kilometers % mi.interval_value))
    END as value_remaining,
    em.maintenance_unit
  FROM maintenance_plans mp
  JOIN assets a ON mp.asset_id = a.id
  JOIN equipment_models em ON a.model_id = em.id
  JOIN maintenance_intervals mi ON mp.interval_id = mi.id
  WHERE 
    mp.status = 'Programado' AND
    a.status = 'operational' AND
    (
      mp.next_due <= (CURRENT_DATE + INTERVAL '30 days') OR
      CASE 
        WHEN em.maintenance_unit = 'hours' THEN 
          (mi.interval_value - (a.current_hours % mi.interval_value)) <= (mi.interval_value * 0.1)
        ELSE 
          (mi.interval_value - (a.current_kilometers % mi.interval_value)) <= (mi.interval_value * 0.1)
      END
    )
  ORDER BY days_remaining ASC;
END;
$$ LANGUAGE plpgsql;
```

## Flujo del Sistema: Ejemplo Completo

### Mantenimiento Preventivo:

1. **Detección automática**: Sistema detecta que un activo está cerca de su intervalo de mantenimiento
2. **Creación de OT**: Se genera automáticamente una OT preventiva
3. **Generación de OC**: Se crea una OC para los repuestos necesarios
4. **Aprobación**: Se aprueba la OC y se programan los trabajos
5. **Ejecución**: Técnico utiliza el checklist preventivo y realiza el mantenimiento
6. **Verificación**: Se verifica que todas las tareas se completaron correctamente
7. **Cierre**: Se cierra la OT, se genera la OS y se actualiza el historial
8. **Recálculo**: Se recalcula el próximo mantenimiento preventivo

### Mantenimiento Correctivo:

1. **Detección de problema**: Técnico ejecuta checklist y marca problemas con "flag" o "fail"
2. **Generación automática de OT**: Sistema crea OT correctiva
3. **Evaluación y cotización**: Se evalúan los problemas y se genera una OC
4. **Aprobación**: Se aprueba la OC según el monto
5. **Ejecución**: Se realiza el trabajo correctivo
6. **Verificación**: Se verifica que el problema fue solucionado correctamente
7. **Cierre**: Se cierra la OT, se genera la OS
8. **Registro dual**: Se actualiza tanto maintenance_history como incident_history

Esta estructura completa permite gestionar todo el ciclo de vida de los mantenimientos, desde la definición de los modelos y activos, hasta la ejecución y seguimiento de los trabajos preventivos y correctivos, pasando por los procesos administrativos de compra y aprobación.

# Maintenance Process Documentation

## Fase 1: Modelo de Equipos y Mantenimiento

- Definición de modelos de equipos con información técnica
- Configuración de intervalos de mantenimiento preventivo
- Gestión de tareas de mantenimiento asociadas a intervalos
- Administración de repuestos asociados a tareas de mantenimiento
- Registro y seguimiento de activos basados en modelos

## Fase 2: Calendario y Checklists

- Planificación calendarizada de mantenimientos preventivos
- Generación de órdenes de trabajo preventivas automáticas
- Creación de checklists de mantenimiento
- Ejecución de checklists diarios/semanales/mensuales
- Generación automática de órdenes de trabajo por fallos

## Fase 3: Órdenes de Servicio, Trabajo y Compra

- Flujo completo de órdenes de trabajo:
  - Creación manual o automática (desde checklists o planificación)
  - Asignación a técnicos
  - Aprobación de trabajos
  - Cotización de repuestos
  - Generación de órdenes de compra
  - Registro de completación de trabajos
  - Generación de órdenes de servicio

- Integración de funcionalidades clave:
  - Función de base de datos `generate_purchase_order` para administrar la creación de órdenes de compra
  - Función de base de datos `generate_service_order_from_work_order` para registrar automáticamente servicios realizados
  - API completa para el registro de completación de trabajos
  - Historial de mantenimiento asociado a activos
  - Seguimiento de costos de mano de obra y repuestos

- Interfaces de usuario:
  - Vista de órdenes de trabajo con filtros por estado y tipo
  - Formulario de completación de trabajos con cálculo de costos
  - Vista de órdenes de compra con seguimiento de aprobación y pedidos
  - Vista detallada de órdenes de servicio con repuestos utilizados

## Diagrama de Flujo

```
                          ┌───────────────┐
                          │   Checklist   │
                          └───────┬───────┘
                                  │
                                  ▼
┌──────────────┐          ┌───────────────┐
│  Calendario  ├─────────►│  Orden de     │
└──────────────┘          │   Trabajo     │
                          └───────┬───────┘
                                  │
                  ┌───────────────┼────────────────┐
                  │               │                │
                  ▼               ▼                ▼
      ┌─────────────────┐ ┌───────────────┐ ┌─────────────┐
      │ Mantenimiento   │ │   Orden de    │ │ Historial   │
      │   Preventivo    │ │    Compra     │ │     de      │
      └────────┬────────┘ └───────┬───────┘ │ Mantenimiento│
               │                  │         └─────────────┘
               │                  │
               ▼                  ▼
      ┌─────────────────┐ ┌───────────────┐
      │    Orden de     │ │  Inventario   │
      │    Servicio     │ │ de Repuestos  │
      └─────────────────┘ └───────────────┘
```

## Próximos Pasos

En fases futuras, se implementará:

- Módulo completo de inventario de repuestos
- Alertas y notificaciones para mantenimientos
- Dashboard de KPIs de mantenimiento
- Exportación de reportes
- Aplicación móvil para técnicos