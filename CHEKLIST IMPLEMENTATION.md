# Implementación Estratégica de Checklists en el Sistema de Gestión de Mantenimiento

## Análisis del Estado Actual

El sistema de gestión de mantenimiento actualmente cuenta con una estructura robusta para la gestión de activos, modelos de equipos y mantenimientos, pero el módulo de checklists requiere una implementación completa. A continuación se detallan los componentes existentes y las limitaciones actuales.

### Componentes Existentes

1. **Interfaz de Usuario Básica**:
   - Páginas para listas de checklists (diarios, semanales, mensuales)
   - Componentes para ejecución de checklists y firma digital
   - Formularios para creación de plantillas

2. **Estructura Parcial de Base de Datos**:
   - Tablas `checklists`, `checklist_sections`, `checklist_items`
   - Tablas `completed_checklists` y `checklist_issues`
   - Relaciones con `assets` y `equipment_models`

### Limitaciones Actuales

1. **Datos Estáticos**: Los componentes utilizan datos de ejemplo en lugar de datos reales.
2. **Falta de Integración**: Los checklists no están completamente integrados con el flujo de trabajo de mantenimiento.
3. **Automatización Limitada**: No existe generación automática de checklists basados en planes de mantenimiento.
4. **Manejo de Estados Incompleto**: El ciclo de vida completo de los checklists no está implementado.

## Plan de Implementación por Fases

La implementación se dividirá en cuatro fases principales para garantizar un desarrollo sistemático y funcional:

### Fase 1: Estructura de Datos y API Base

#### 1.1 Refinamiento del Modelo de Datos

Las tablas actuales son adecuadas pero requieren algunos ajustes y extensiones:

```typescript
// Types para las tablas existentes
export type Checklist = {
  id: string
  name: string
  model_id: string | null
  interval_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ChecklistSection = {
  id: string
  checklist_id: string
  title: string
  order_index: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ChecklistItem = {
  id: string
  section_id: string
  description: string
  required: boolean
  order_index: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type CompletedChecklist = {
  id: string
  checklist_id: string
  asset_id: string
  completed_items: CompletedItemData[]
  technician: string
  completion_date: string
  notes: string
  status: 'Completado' | 'Con Problemas'
  service_order_id: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ChecklistIssue = {
  id: string
  checklist_id: string
  item_id: string
  status: 'flag' | 'fail'
  description: string
  notes: string | null
  photo_url: string | null
  work_order_id: string | null
  resolved: boolean
  resolution_date: string | null
  created_at: string
  created_by: string | null
  updated_by: string | null
}

// Extensiones propuestas
export type ChecklistTemplate = {
  id: string
  name: string
  description: string
  model_id: string
  frequency: 'diario' | 'semanal' | 'mensual' | 'trimestral' | 'personalizado'
  hours_interval?: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type ChecklistSchedule = {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: 'pendiente' | 'en_progreso' | 'completado' | 'vencido' | 'con_problemas'
  assigned_to: string
  maintenance_plan_id?: string
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

// Type para datos de items completados (almacenado como JSONB)
export type CompletedItemData = {
  id: string
  item_id: string
  status: 'pass' | 'flag' | 'fail'
  value?: string
  notes?: string
  photo_url?: string
}
```

#### 1.2 Migración de Base de Datos

Crear las siguientes migraciones para extender el esquema actual:

```sql
-- Migration: update_checklist_tables
-- Agregar columnas a la tabla checklists
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS hours_interval INTEGER;

-- Agregar columnas a la tabla checklist_items
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'check';
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS expected_value TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS tolerance TEXT;

-- Crear tabla checklist_schedules si no existe
CREATE TABLE IF NOT EXISTS checklist_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES checklists(id),
  asset_id UUID REFERENCES assets(id),
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pendiente',
  assigned_to UUID REFERENCES auth.users(id),
  maintenance_plan_id UUID REFERENCES maintenance_plans(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Crear índices para mejorar la velocidad de consulta
CREATE INDEX IF NOT EXISTS idx_checklist_schedules_asset_id ON checklist_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_checklist_schedules_status ON checklist_schedules(status);
CREATE INDEX IF NOT EXISTS idx_checklist_schedules_scheduled_date ON checklist_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_checklist_items_section_id ON checklist_items(section_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_checklist_id ON checklist_sections(checklist_id);
```

#### 1.3 Implementación de APIs

Crear las siguientes APIs en el directorio `app/api/checklists`:

1. **API de Plantillas de Checklist**

```typescript
// app/api/checklists/templates/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  const { data, error } = await supabase
    .from('checklists')
    .select(`
      *,
      checklist_sections(
        *,
        checklist_items(*)
      ),
      equipment_models(
        name,
        manufacturer
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  const { template } = await request.json()
  
  // 1. Crear la plantilla de checklist
  const { data: checklistData, error: checklistError } = await supabase
    .from('checklists')
    .insert({
      name: template.name,
      description: template.description,
      model_id: template.model_id,
      frequency: template.frequency,
      hours_interval: template.hours_interval,
    })
    .select('*')
    .single()

  if (checklistError) {
    return NextResponse.json({ error: checklistError.message }, { status: 500 })
  }

  const checklistId = checklistData.id

  // 2. Crear las secciones
  for (const [sectionIndex, section] of template.sections.entries()) {
    const { data: sectionData, error: sectionError } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_id: checklistId,
        title: section.title,
        order_index: sectionIndex,
      })
      .select('*')
      .single()

    if (sectionError) {
      return NextResponse.json({ error: sectionError.message }, { status: 500 })
    }

    const sectionId = sectionData.id

    // 3. Crear los items de cada sección
    for (const [itemIndex, item] of section.items.entries()) {
      const { error: itemError } = await supabase
        .from('checklist_items')
        .insert({
          section_id: sectionId,
          description: item.description,
          required: item.required ?? true,
          item_type: item.item_type ?? 'check',
          expected_value: item.expected_value,
          tolerance: item.tolerance,
          order_index: itemIndex,
        })

      if (itemError) {
        return NextResponse.json({ error: itemError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ success: true, id: checklistId })
}
```

2. **API de Programación de Checklists**

```typescript
// app/api/checklists/schedules/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const type = url.searchParams.get('type')
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  let query = supabase
    .from('checklist_schedules')
          .select(`
            *,
      checklists (
        *,
        equipment_models (name, manufacturer)
      ),
      assets (name, asset_id, location),
      profiles:assigned_to (nombre, apellido)
    `)
    .order('scheduled_date', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  if (type) {
    query = query.eq('checklists.frequency', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  const { schedule } = await request.json()
  
  const { data, error } = await supabase
    .from('checklist_schedules')
    .insert({
      template_id: schedule.template_id,
      asset_id: schedule.asset_id,
      scheduled_date: schedule.scheduled_date,
      status: schedule.status || 'pendiente',
      assigned_to: schedule.assigned_to,
      maintenance_plan_id: schedule.maintenance_plan_id,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}
```

#### 1.4 Implementación de RPCs para Operaciones Complejas

Crear funciones RPC para operaciones que requieren múltiples operaciones en la base de datos:

```sql
-- Function: generate_checklists_from_maintenance_plan
CREATE OR REPLACE FUNCTION generate_checklists_from_maintenance_plan(
  maintenance_plan_id UUID,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  assigned_to UUID
) RETURNS SETOF UUID AS $$
DECLARE
  v_asset_id UUID;
  v_model_id UUID;
  v_checklist_id UUID;
  v_schedule_id UUID;
  rec RECORD;
BEGIN
  -- Obtener información del plan de mantenimiento
  SELECT asset_id, assets.model_id 
  INTO v_asset_id, v_model_id
  FROM maintenance_plans
  JOIN assets ON maintenance_plans.asset_id = assets.id
  WHERE maintenance_plans.id = maintenance_plan_id;
  
  -- Obtener checklists aplicables para este modelo
  FOR rec IN 
    SELECT id FROM checklists 
    WHERE model_id = v_model_id
  LOOP
    v_checklist_id := rec.id;
    
    -- Crear programación de checklist
    INSERT INTO checklist_schedules (
      template_id,
      asset_id,
      scheduled_date,
      status,
      assigned_to,
      maintenance_plan_id
    ) VALUES (
      v_checklist_id,
      v_asset_id,
      scheduled_date,
      'pendiente',
      assigned_to,
      maintenance_plan_id
    ) RETURNING id INTO v_schedule_id;
    
    RETURN NEXT v_schedule_id;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Function: mark_checklist_as_completed
CREATE OR REPLACE FUNCTION mark_checklist_as_completed(
  p_schedule_id UUID,
  p_completed_items JSONB,
  p_technician TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_checklist_id UUID;
  v_asset_id UUID;
  v_status TEXT := 'Completado';
  v_item JSONB;
  v_completed_id UUID;
  v_has_issues BOOLEAN := FALSE;
BEGIN
  -- Obtener información de la programación
  SELECT template_id, asset_id 
  INTO v_checklist_id, v_asset_id
  FROM checklist_schedules
  WHERE id = p_schedule_id;
  
  -- Verificar si hay problemas
  FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
  LOOP
    IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
      v_has_issues := TRUE;
      v_status := 'Con Problemas';
    END IF;
  END LOOP;
  
  -- Registrar el checklist completado
  INSERT INTO completed_checklists (
    checklist_id,
    asset_id,
    completed_items,
    technician,
    completion_date,
    notes,
    status
  ) VALUES (
    v_checklist_id,
    v_asset_id,
    p_completed_items,
    p_technician,
    NOW(),
    p_notes,
    v_status
  ) RETURNING id INTO v_completed_id;
  
  -- Actualizar estado de la programación
  UPDATE checklist_schedules
  SET status = 'completado'
  WHERE id = p_schedule_id;
  
  -- Si hay problemas, registrarlos
  IF v_has_issues THEN
    FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
    LOOP
      IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
        INSERT INTO checklist_issues (
          checklist_id,
          item_id,
          status,
          description,
          notes,
          photo_url,
          resolved
        ) VALUES (
          v_completed_id,
          v_item->>'item_id',
          v_item->>'status',
          'Problema detectado durante el checklist',
          v_item->>'notes',
          v_item->>'photo_url',
          FALSE
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Actualizar fecha de último mantenimiento del activo
  UPDATE assets
  SET last_maintenance_date = NOW()
  WHERE id = v_asset_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'completed_id', v_completed_id,
    'has_issues', v_has_issues
  );
END;
$$ LANGUAGE plpgsql;
```

#### 1.5 Implementación de Servicios Auxiliares

Crear servicios para la interacción con las APIs:

```typescript
// lib/services/checklist-service.ts
import { createClient } from '@/lib/supabase/client'

export const checklistService = {
  // Obtener plantillas de checklist
  async getTemplates() {
    const supabase = createClient()
    const { data, error } = await supabase.from('checklists').select(`
              *,
              checklist_sections(
                *,
                checklist_items(*)
      ),
      equipment_models(
        name,
        manufacturer
      )
    `).order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error obteniendo plantillas: ${error.message}`)
    }
    
    return data
  },

  // Crear una nueva plantilla de checklist
  async createTemplate(template) {
    const supabase = createClient()
    
    // Use the API to create the template with all its sections and items
    const response = await fetch('/api/checklists/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template }),
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(`Error creando plantilla: ${result.error}`)
    }
    
    return result
  },

  // Obtener programaciones de checklists
  async getSchedules({ status, type }) {
    const supabase = createClient()
    
    let query = `/api/checklists/schedules`
    const params = new URLSearchParams()
    
    if (status) params.append('status', status)
    if (type) params.append('type', type)
    
    if (params.toString()) {
      query += `?${params.toString()}`
    }
    
    const response = await fetch(query)
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(`Error obteniendo programaciones: ${result.error}`)
    }
    
    return result.data
  },
  
  // Programar un nuevo checklist
  async scheduleChecklist(schedule) {
    const response = await fetch('/api/checklists/schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ schedule }),
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(`Error programando checklist: ${result.error}`)
    }
    
    return result.data
  },
  
  // Completar un checklist
  async completeChecklist(scheduleId, completedItems, technician, notes) {
    const supabase = createClient()
    
    const { data, error } = await supabase.rpc('mark_checklist_as_completed', {
      p_schedule_id: scheduleId,
      p_completed_items: completedItems,
      p_technician: technician,
      p_notes: notes
    })

  if (error) {
      throw new Error(`Error completando checklist: ${error.message}`)
    }
    
    return data
  },
  
  // Generar checklists a partir de un plan de mantenimiento
  async generateFromMaintenancePlan(maintenancePlanId, scheduledDate, assignedTo) {
    const supabase = createClient()
    
    const { data, error } = await supabase.rpc('generate_checklists_from_maintenance_plan', {
      maintenance_plan_id: maintenancePlanId,
      scheduled_date: scheduledDate,
      assigned_to: assignedTo
    })
    
    if (error) {
      throw new Error(`Error generando checklists: ${error.message}`)
    }
    
    return data
  }
}
```

#### 1.6 Hooks para Consumo de Datos

Implementar hooks reutilizables para consumir los servicios:

```typescript
// hooks/use-checklists.ts
import { useState, useEffect } from 'react'
import { checklistService } from '@/lib/services/checklist-service'

export function useChecklistTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true)
        const data = await checklistService.getTemplates()
        setTemplates(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadTemplates()
  }, [])

  async function createTemplate(template) {
    try {
      setLoading(true)
      const result = await checklistService.createTemplate(template)
      // Recargar las plantillas después de crear una nueva
      const data = await checklistService.getTemplates()
      setTemplates(data)
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { templates, loading, error, createTemplate }
}

export function useChecklistSchedules(initialFilters = {}) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(initialFilters)

  useEffect(() => {
    async function loadSchedules() {
      try {
        setLoading(true)
        const data = await checklistService.getSchedules(filters)
        setSchedules(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadSchedules()
  }, [filters])

  async function scheduleChecklist(schedule) {
    try {
      setLoading(true)
      const result = await checklistService.scheduleChecklist(schedule)
      // Recargar las programaciones después de crear una nueva
      const data = await checklistService.getSchedules(filters)
      setSchedules(data)
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  async function updateFilters(newFilters) {
    setFilters({ ...filters, ...newFilters })
  }

  return { schedules, loading, error, scheduleChecklist, updateFilters }
}

export function useChecklistExecution(scheduleId) {
  const [checklist, setChecklist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadChecklist() {
      try {
        setLoading(true)
        const supabase = createClient()
        
        const { data, error } = await supabase
          .from('checklist_schedules')
    .select(`
      *,
            checklists (
              *,
              checklist_sections (
                *,
                checklist_items (*)
              )
            ),
            assets (*)
          `)
          .eq('id', scheduleId)
          .single()
          
        if (error) throw new Error(error.message)
        setChecklist(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    if (scheduleId) {
      loadChecklist()
    }
  }, [scheduleId])

  async function completeChecklist(completedItems, technician, notes) {
    try {
      setLoading(true)
      return await checklistService.completeChecklist(scheduleId, completedItems, technician, notes)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { checklist, loading, error, completeChecklist }
}
```

Esta primera fase establece las bases de datos, APIs y servicios necesarios para implementar la funcionalidad de checklists. En la siguiente fase se desarrollarán los componentes de la interfaz de usuario y las páginas para interactuar con estas APIs.

### Fase 2: Interfaz de Usuario para Gestión de Checklists

En esta fase se implementarán las interfaces de usuario necesarias para la gestión de plantillas de checklists, programación de inspecciones y ejecución de los mismos.

#### 2.1 Componentes Reutilizables

##### 2.1.1 Formulario de Creación/Edición de Plantillas

```tsx
// components/checklists/checklist-template-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Save, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { checklistService } from "@/lib/services/checklist-service"

const formSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  model_id: z.string().uuid("Seleccione un modelo válido"),
  frequency: z.enum(["diario", "semanal", "mensual", "trimestral", "personalizado"]),
  hours_interval: z.number().optional(),
  sections: z.array(
    z.object({
      title: z.string().min(1, "El título es requerido"),
      items: z.array(
        z.object({
          description: z.string().min(1, "La descripción es requerida"),
          required: z.boolean().default(true),
          item_type: z.enum(["check", "measure", "input"]).default("check"),
          expected_value: z.string().optional(),
          tolerance: z.string().optional(),
        })
      ).min(1, "Debe agregar al menos un item")
    })
  ).min(1, "Debe agregar al menos una sección")
});

export function ChecklistTemplateForm({ models, onSuccess }) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      model_id: "",
      frequency: "mensual",
      hours_interval: undefined,
      sections: [
        {
          title: "Inspección General",
          items: [{ description: "", required: true, item_type: "check" }]
        }
      ]
    }
  })
  
  async function onSubmit(values) {
    try {
      setIsSubmitting(true)
      await checklistService.createTemplate(values)
      toast({
        title: "Plantilla creada",
        description: "La plantilla se ha creado correctamente",
        variant: "success"
      })
      if (onSuccess) onSuccess()
      form.reset()
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  function addSection() {
    const sections = form.getValues("sections")
    form.setValue("sections", [
      ...sections,
      {
        title: "",
        items: [{ description: "", required: true, item_type: "check" }]
      }
    ])
  }
  
  function addItem(sectionIndex) {
    const sections = form.getValues("sections")
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items.push({ 
      description: "", 
      required: true, 
      item_type: "check" 
    })
    form.setValue("sections", updatedSections)
  }
  
  function removeSection(sectionIndex) {
    const sections = form.getValues("sections")
    if (sections.length === 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe haber al menos una sección",
        variant: "destructive"
      })
      return
    }
    const updatedSections = sections.filter((_, i) => i !== sectionIndex)
    form.setValue("sections", updatedSections)
  }
  
  function removeItem(sectionIndex, itemIndex) {
    const sections = form.getValues("sections")
    if (sections[sectionIndex].items.length === 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe haber al menos un item en cada sección",
        variant: "destructive"
      })
      return
    }
    const updatedSections = [...sections]
    updatedSections[sectionIndex].items = updatedSections[sectionIndex].items.filter((_, i) => i !== itemIndex)
    form.setValue("sections", updatedSections)
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Plantilla</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Mantenimiento Preventivo 500 horas" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descripción detallada del checklist" 
                        rows={3} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="model_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo de Equipo</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar modelo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.manufacturer} - {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar frecuencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="diario">Diario</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="mensual">Mensual</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="personalizado">Personalizado (Horas)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {form.watch("frequency") === "personalizado" && (
                <FormField
                  control={form.control}
                  name="hours_interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo en Horas</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Ej: 500" 
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
          
          {/* Secciones del Checklist */}
          {form.watch("sections").map((section, sectionIndex) => (
            <Card key={sectionIndex}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sección {sectionIndex + 1}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  type="button"
                  onClick={() => removeSection(sectionIndex)}
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name={`sections.${sectionIndex}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título de la Sección</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Inspección Visual" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Items de la Sección */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Items de Verificación</h4>
                  
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="grid gap-4 border p-4 rounded-md">
                      <div className="flex justify-between items-start">
                        <h5 className="text-sm font-medium">Item {itemIndex + 1}</h5>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          type="button"
                          onClick={() => removeItem(sectionIndex, itemIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name={`sections.${sectionIndex}.items.${itemIndex}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Verificar nivel de aceite" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`sections.${sectionIndex}.items.${itemIndex}.required`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="w-4 h-4"
                                />
                              </FormControl>
                              <FormLabel className="text-sm">Requerido</FormLabel>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name={`sections.${sectionIndex}.items.${itemIndex}.item_type`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo</FormLabel>
                              <Select 
                                onValueChange={field.onChange} 
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Tipo de item" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="check">Verificación</SelectItem>
                                  <SelectItem value="measure">Medición</SelectItem>
                                  <SelectItem value="input">Entrada de texto</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {form.watch(`sections.${sectionIndex}.items.${itemIndex}.item_type`) === "measure" && (
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name={`sections.${sectionIndex}.items.${itemIndex}.expected_value`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valor Esperado</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: 80 psi" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`sections.${sectionIndex}.items.${itemIndex}.tolerance`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tolerancia</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ej: ±5 psi" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addItem(sectionIndex)}
                    className="mt-2"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Agregar Item
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button
            type="button"
            variant="outline"
            onClick={addSection}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Agregar Sección
          </Button>
          
          <Card>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Guardando..." : "Guardar Plantilla"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </Form>
  )
}
```

##### 2.1.2 Formulario de Ejecución de Checklists

```tsx
// components/checklists/checklist-execution-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form } from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertTriangle, XCircle, Camera, Save, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { SignatureCanvas } from "@/components/checklists/signature-canvas"
import { useRouter } from "next/navigation"

type ChecklistItem = {
  id: string
  description: string
  required: boolean
  item_type: string
  expected_value?: string
  tolerance?: string
}

type ChecklistSection = {
  id: string
  title: string
  checklist_items: ChecklistItem[]
}

type ChecklistExecutionProps = {
  schedule: any
  onComplete: (result: any) => void
}

export function ChecklistExecutionForm({ schedule, onComplete }: ChecklistExecutionProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [itemStatuses, setItemStatuses] = useState<Record<string, { status: string; notes?: string; value?: string }>>({})
  const [photos, setPhotos] = useState<Record<string, string>>({})
  
  const form = useForm({
    defaultValues: {
      technician: "",
      notes: ""
    }
  })
  
  const checklist = schedule?.checklists
  const sections = checklist?.checklist_sections || []
  const asset = schedule?.assets
  
  function handleItemStatusChange(itemId: string, status: string) {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }))
  }
  
  function handleItemNotesChange(itemId: string, notes: string) {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes }
    }))
  }
  
  function handleItemValueChange(itemId: string, value: string) {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], value }
    }))
  }
  
  async function capturePhoto(itemId: string) {
    // En una implementación real, esto podría usar la cámara del dispositivo
    // Para este ejemplo, simularemos con una URL de imagen
    try {
      // Simulación de captura de foto
      const photoUrl = `https://example.com/photos/${Date.now()}.jpg`
      setPhotos(prev => ({
        ...prev,
        [itemId]: photoUrl
      }))
      
      toast({
        title: "Foto capturada",
        description: "La foto se ha guardado correctamente",
        variant: "default"
      })
    } catch (error) {
      toast({
        title: "Error al capturar la foto",
        description: error.message,
        variant: "destructive"
      })
    }
  }
  
  async function onSubmit(values) {
    try {
      setIsSubmitting(true)
      
      if (!signature) {
        toast({
          title: "Firma requerida",
          description: "Por favor, firme el formulario para completar la inspección",
          variant: "destructive"
        })
        setIsSubmitting(false)
        return
      }
      
      const completedItems = Object.entries(itemStatuses).map(([itemId, data]) => ({
        id: itemId,
        item_id: itemId,
        status: data.status,
        notes: data.notes || "",
        value: data.value || "",
        photo_url: photos[itemId] || null
      }))
      
      // Verificar que todos los items requeridos estén completados
      let missingRequired = false
      sections.forEach(section => {
        section.checklist_items.forEach(item => {
          if (item.required && !itemStatuses[item.id]) {
            missingRequired = true
          }
        })
      })
      
      if (missingRequired) {
        toast({
          title: "Items requeridos sin completar",
          description: "Por favor, complete todos los items requeridos",
          variant: "destructive"
        })
        setIsSubmitting(false)
        return
      }
      
      // Enviar datos al servidor
      const result = await fetch(`/api/checklists/schedules/${schedule.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technician: values.technician,
          notes: values.notes,
          signature: signature,
          completed_items: completedItems
        }),
      }).then(res => res.json())
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast({
        title: "Checklist completado",
        description: "El checklist se ha completado correctamente",
        variant: "success"
      })
      
      if (onComplete) {
        onComplete(result)
      } else {
        router.push('/checklists')
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  function renderStatusIcon(status) {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'flag':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }
  
  if (!checklist) {
    return <div>Cargando...</div>
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Información de la Inspección</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium">Activo</h3>
                  <p>{asset?.name} ({asset?.asset_id})</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Ubicación</h3>
                  <p>{asset?.location}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Tipo de Checklist</h3>
                  <p>{checklist.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Fecha Programada</h3>
                  <p>{new Date(schedule.scheduled_date).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Técnico Responsable</label>
                <Input 
                  {...form.register("technician")} 
                  placeholder="Nombre del técnico" 
                  required 
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Secciones del Checklist */}
          {sections.map((section, sectionIndex) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Items de la Sección */}
                <div className="space-y-4">
                  {section.checklist_items.map((item, itemIndex) => (
                    <div key={item.id} className="border p-4 rounded-md space-y-3">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="text-sm font-medium">{item.description}</h4>
                          {item.required && (
                            <Badge variant="outline" className="mt-1">Requerido</Badge>
                          )}
                          {item.expected_value && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Valor esperado: {item.expected_value} {item.tolerance ? `(${item.tolerance})` : ''}
                            </p>
                          )}
                        </div>
                        
                        {itemStatuses[item.id]?.status && (
                          <div>{renderStatusIcon(itemStatuses[item.id].status)}</div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={itemStatuses[item.id]?.status === 'pass' ? 'default' : 'outline'}
                          onClick={() => handleItemStatusChange(item.id, 'pass')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Bien
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={itemStatuses[item.id]?.status === 'flag' ? 'default' : 'outline'}
                          onClick={() => handleItemStatusChange(item.id, 'flag')}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Alerta
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={itemStatuses[item.id]?.status === 'fail' ? 'default' : 'outline'}
                          onClick={() => handleItemStatusChange(item.id, 'fail')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Mal
                        </Button>
                      </div>
                      
                      {(item.item_type === 'measure' || item.item_type === 'input') && (
                        <div>
                          <Input
                            placeholder={item.item_type === 'measure' ? "Ingrese la medida" : "Ingrese el valor"}
                            value={itemStatuses[item.id]?.value || ''}
                            onChange={(e) => handleItemValueChange(item.id, e.target.value)}
                            className="mt-2"
                          />
                        </div>
                      )}
                      
                      {(itemStatuses[item.id]?.status === 'flag' || itemStatuses[item.id]?.status === 'fail') && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Describa el problema"
                            value={itemStatuses[item.id]?.notes || ''}
                            onChange={(e) => handleItemNotesChange(item.id, e.target.value)}
                          />
                          
                          <div className="flex justify-between">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => capturePhoto(item.id)}
                            >
                              <Camera className="h-4 w-4 mr-1" />
                              Tomar Foto
                            </Button>
                            
                            {photos[item.id] && (
                              <span className="text-xs text-muted-foreground">
                                Foto capturada
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Card>
            <CardHeader>
              <CardTitle>Notas Adicionales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...form.register("notes")}
                placeholder="Agregue cualquier observación adicional"
                rows={4}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Firma del Técnico</CardTitle>
            </CardHeader>
            <CardContent>
              <SignatureCanvas onSave={setSignature} />
              {signature && (
                <div className="mt-2 text-xs text-green-600">
                  Firma guardada correctamente
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Completar Inspección
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </Form>
  )
}
```

##### 2.1.3 Formulario de Programación de Checklists

```tsx
// components/checklists/schedule-checklist-form.tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Save, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { checklistService } from "@/lib/services/checklist-service"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  template_id: z.string().uuid("Seleccione una plantilla válida"),
  asset_id: z.string().uuid("Seleccione un activo válido"),
  scheduled_date: z.date(),
  assigned_to: z.string().uuid("Seleccione un técnico válido"),
});

type ScheduleChecklistFormProps = {
  templates: any[]
  assets: any[]
  technicians: any[]
  onSuccess?: () => void
}

export function ScheduleChecklistForm({ templates, assets, technicians, onSuccess }: ScheduleChecklistFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      template_id: "",
      asset_id: "",
      scheduled_date: new Date(),
      assigned_to: "",
    }
  })
  
  async function onSubmit(values) {
    try {
      setIsSubmitting(true)
      await checklistService.scheduleChecklist(values)
      toast({
        title: "Checklist programado",
        description: "El checklist se ha programado correctamente",
        variant: "success"
      })
      if (onSuccess) onSuccess()
      form.reset()
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Programar Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plantilla de Checklist</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar plantilla" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="asset_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activo</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar activo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assets.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name} ({asset.asset_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="scheduled_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha Programada</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Técnico Asignado</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar técnico" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {technicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.nombre} {tech.apellido}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="ml-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Programar Checklist
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  )
}
```

#### 2.2 Implementación de Páginas

##### 2.2.1 Página de Listado de Plantillas

```tsx
// app/checklists/page.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle } from "lucide-react"
import Link from "next/link"
import { ChecklistTemplatesList } from "@/components/checklists/checklist-templates-list"
import { ChecklistSchedulesList } from "@/components/checklists/checklist-schedules-list"

export const metadata: Metadata = {
  title: "Checklists | Sistema de Mantenimiento",
  description: "Gestión de checklists de inspección y mantenimiento",
}

export default async function ChecklistsPage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener plantillas de checklist
  const { data: templates } = await supabase
    .from('checklists')
    .select(`
      *,
      checklist_sections(count),
      equipment_models(name, manufacturer)
    `)
    .order('created_at', { ascending: false })

  // Obtener programaciones pendientes
  const { data: pendingSchedules } = await supabase
    .from('checklist_schedules')
    .select(`
      *,
      checklists (name, frequency),
      assets (name, asset_id, location),
      profiles:assigned_to (nombre, apellido)
    `)
    .eq('status', 'pendiente')
    .order('scheduled_date', { ascending: true })
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Checklists</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/checklists/crear">
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva Plantilla
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/checklists/programar">
              <PlusCircle className="h-4 w-4 mr-2" />
              Programar Checklist
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="templates">Plantillas</TabsTrigger>
          <TabsTrigger value="scheduled">Programados</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="mt-6">
          <ChecklistTemplatesList templates={templates || []} />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-6">
          <ChecklistSchedulesList schedules={pendingSchedules || []} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

##### 2.2.2 Página de Creación de Plantillas

```tsx
// app/checklists/crear/page.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ChecklistTemplateForm } from "@/components/checklists/checklist-template-form"

export const metadata: Metadata = {
  title: "Crear Plantilla de Checklist | Sistema de Mantenimiento",
  description: "Creación de nuevas plantillas de checklist para inspecciones",
}

export default async function CreateChecklistTemplatePage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener modelos de equipos
  const { data: models } = await supabase
    .from('equipment_models')
    .select('*')
    .order('manufacturer', { ascending: true })
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/checklists">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Crear Plantilla de Checklist</h1>
      </div>
      
      <ChecklistTemplateForm 
        models={models || []} 
        onSuccess={() => {
          // En el cliente, redireccionaremos a la lista de plantillas
        }} 
      />
    </div>
  )
}
```

##### 2.2.3 Página de Programación de Checklists

```tsx
// app/checklists/programar/page.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ScheduleChecklistForm } from "@/components/checklists/schedule-checklist-form"

export const metadata: Metadata = {
  title: "Programar Checklist | Sistema de Mantenimiento",
  description: "Programación de inspecciones basadas en plantillas de checklist",
}

export default async function ScheduleChecklistPage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener plantillas de checklist
  const { data: templates } = await supabase
    .from('checklists')
    .select('*')
    .order('name', { ascending: true })
  
  // Obtener activos
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .order('name', { ascending: true })
  
  // Obtener técnicos
  const { data: technicians } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'technician')
    .order('nombre', { ascending: true })
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/checklists">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Programar Checklist</h1>
      </div>
      
      <div className="max-w-3xl mx-auto">
        <ScheduleChecklistForm 
          templates={templates || []} 
          assets={assets || []} 
          technicians={technicians || []} 
          onSuccess={() => {
            // En el cliente, redireccionaremos a la lista de programaciones
          }} 
        />
      </div>
    </div>
  )
}
```

##### 2.2.4 Página de Ejecución de Checklist

```tsx
// app/checklists/ejecutar/[id]/page.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { ChecklistExecutionForm } from "@/components/checklists/checklist-execution-form"
import { notFound } from "next/navigation"

export async function generateMetadata({ params }): Promise<Metadata> {
  return {
    title: "Ejecutar Checklist | Sistema de Mantenimiento",
    description: "Formulario de ejecución de inspección",
  }
}

export default async function ExecuteChecklistPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener información del checklist programado
  const { data: schedule, error } = await supabase
    .from('checklist_schedules')
    .select(`
      *,
      checklists (
        *,
        checklist_sections (
          *,
          checklist_items (*)
        )
      ),
      assets (*)
    `)
    .eq('id', params.id)
    .single()
  
  if (error || !schedule) {
    notFound()
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/checklists">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Ejecutar Checklist</h1>
      </div>
      
      <div className="space-y-6">
        <ChecklistExecutionForm 
          schedule={schedule} 
          onComplete={(result) => {
            // Esta función se ejecutará en el cliente
            // La redirección se manejará dentro del componente
          }} 
        />
      </div>
    </div>
  )
}
```

##### 2.2.5 Componentes Auxiliares para Listados

Para completar la implementación de la interfaz de usuario, necesitamos crear componentes para mostrar los listados:

```tsx
// components/checklists/checklist-templates-list.tsx
"use client"

import { useState } from "react"
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  FileText, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Calendar 
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"

export function ChecklistTemplatesList({ templates }) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  
  async function handleDelete(id: string) {
    try {
      setIsDeleting(true)
      // Implementación pendiente de la eliminación
      // En producción, esto debería verificar si hay dependencias
      
      toast({
        title: "Plantilla eliminada",
        description: "La plantilla ha sido eliminada correctamente",
        variant: "default"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }
  
  function renderFrequencyBadge(frequency: string) {
    switch (frequency) {
      case 'diario':
        return <Badge variant="secondary">Diario</Badge>
      case 'semanal':
        return <Badge variant="outline">Semanal</Badge>
      case 'mensual':
        return <Badge variant="default">Mensual</Badge>
      case 'trimestral':
        return <Badge variant="default">Trimestral</Badge>
      case 'personalizado':
        return <Badge variant="secondary">Personalizado</Badge>
      default:
        return null
    }
  }
  
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-60">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No hay plantillas disponibles</h3>
          <p className="text-muted-foreground mb-4">
            Cree una nueva plantilla para empezar a programar inspecciones
          </p>
          <Button asChild>
            <Link href="/checklists/crear">
              Crear Primera Plantilla
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantillas de Checklists</CardTitle>
        <CardDescription>
          Plantillas disponibles para programar inspecciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Secciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>
                  {template.equipment_models?.manufacturer} {template.equipment_models?.name}
                </TableCell>
                <TableCell>
                  {renderFrequencyBadge(template.frequency)}
                  {template.hours_interval && (
                    <span className="ml-2 text-xs">({template.hours_interval} horas)</span>
                  )}
                </TableCell>
                <TableCell>{template.checklist_sections[0]?.count || 0}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/editar/${template.id}`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/checklists/programar?template=${template.id}`}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Programar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(template.id)}
                        disabled={isDeleting}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

```tsx
// components/checklists/checklist-schedules-list.tsx
"use client"

import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, ClipboardCheck } from "lucide-react"
import Link from "next/link"

export function ChecklistSchedulesList({ schedules }) {
  function renderStatusBadge(status) {
    switch (status) {
      case 'pendiente':
        return <Badge variant="outline">Pendiente</Badge>
      case 'en_progreso':
        return <Badge variant="secondary">En Progreso</Badge>
      case 'completado':
        return <Badge variant="default" className="bg-green-600">Completado</Badge>
      case 'vencido':
        return <Badge variant="destructive">Vencido</Badge>
      case 'con_problemas':
        return <Badge variant="destructive">Con Problemas</Badge>
      default:
        return null
    }
  }
  
  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-60">
          <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No hay checklists programados</h3>
          <p className="text-muted-foreground mb-4">
            Programe un nuevo checklist para comenzar a realizar inspecciones
          </p>
          <Button asChild>
            <Link href="/checklists/programar">
              Programar Primer Checklist
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklists Programados</CardTitle>
        <CardDescription>
          Inspecciones programadas pendientes de ejecución
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Checklist</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  {new Date(schedule.scheduled_date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">
                  {schedule.checklists?.name}
                  <div className="text-xs text-muted-foreground">
                    {schedule.checklists?.frequency}
                  </div>
                </TableCell>
                <TableCell>
                  {schedule.assets?.name}
                  <div className="text-xs text-muted-foreground">
                    {schedule.assets?.location}
                  </div>
                </TableCell>
                <TableCell>
                  {schedule.profiles?.nombre} {schedule.profiles?.apellido}
                </TableCell>
                <TableCell>
                  {renderStatusBadge(schedule.status)}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm">
                    <Link href={`/checklists/ejecutar/${schedule.id}`}>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Ejecutar
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

### Fase 3: Integración con el Flujo de Mantenimiento

La tercera fase se centrará en la integración del módulo de checklists con el sistema de gestión de mantenimiento existente, permitiendo que los resultados de las inspecciones generen órdenes de trabajo, alerten sobre problemas y se asocien con activos específicos.

#### 3.1 API para Integración con Mantenimiento

Primero, desarrollaremos los endpoints de API necesarios para la integración:

```typescript
// app/api/checklists/schedules/[id]/complete/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  const { technician, notes, signature, completed_items } = await request.json()
  
  try {
    // Llamar a la función RPC para marcar el checklist como completado
    const { data, error } = await supabase.rpc('mark_checklist_as_completed', {
      p_schedule_id: params.id,
      p_completed_items: completed_items,
      p_technician: technician,
      p_notes: notes
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Si hay problemas, crear una orden de trabajo
    if (data.has_issues) {
      // Obtener información del checklist
      const { data: scheduleData } = await supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(name),
          assets(id, name, asset_id, model_id)
        `)
        .eq('id', params.id)
        .single()
        
      if (scheduleData) {
        // Crear una orden de trabajo para los problemas detectados
        const { data: workOrder, error: workOrderError } = await supabase
          .from('work_orders')
          .insert({
            title: `Problemas detectados en checklist ${scheduleData.checklists.name}`,
            description: `Durante la inspección se detectaron problemas que requieren atención.\n\nNotas: ${notes || 'No se proporcionaron notas adicionales'}`,
            asset_id: scheduleData.assets.id,
            priority: 'media',
            status: 'pendiente',
            type: 'correctivo',
            requested_by: technician,
            reported_issue: 'Problemas detectados durante checklist de inspección',
            completed_checklist_id: data.completed_id
          })
          .select()
          .single()
        
        if (workOrderError) {
          console.error('Error creating work order:', workOrderError)
        } else {
          // Actualizar el registro de problemas con la orden de trabajo
          await supabase
            .from('checklist_issues')
            .update({ work_order_id: workOrder.id })
            .eq('checklist_id', data.completed_id)
        }
          
        // Incluir información de la orden de trabajo en la respuesta
        data.work_order = workOrder
      }
    }
    
    // Guardar la firma (en un entorno real esto se haría en el storage de Supabase)
    if (signature) {
      const signatureId = data.completed_id
      
      // Aquí se implementaría la lógica para guardar la firma en Storage
      // Por ejemplo:
      // const { data: signatureData, error: signatureError } = await supabase.storage
      //   .from('signatures')
      //   .upload(`${signatureId}.png`, base64ToBlob(signature), {
      //     contentType: 'image/png',
      //   })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

#### 3.2 Disparadores de Base de Datos para Automatización

Los disparadores de base de datos nos permitirán automatizar acciones cuando se completen checklists o se detecten problemas:

```sql
-- Trigger: update_asset_last_inspection_date
CREATE OR REPLACE FUNCTION update_asset_last_inspection_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE assets
  SET last_inspection_date = NEW.completion_date
  WHERE id = NEW.asset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_checklist_completed
AFTER INSERT ON completed_checklists
FOR EACH ROW
EXECUTE FUNCTION update_asset_last_inspection_date();

-- Trigger: notify_checklist_issues
CREATE OR REPLACE FUNCTION notify_checklist_issues()
RETURNS TRIGGER AS $$
BEGIN
  -- Esta función insertará una notificación en la tabla de notificaciones
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_entity,
    entity_id,
    status,
    priority
  )
  SELECT 
    u.id,
    'Problema detectado en checklist',
    CONCAT('Se ha detectado un problema en el activo ', a.name, ' (', a.asset_id, ')'),
    'issue',
    'checklist_issue',
    NEW.id,
    'unread',
    CASE WHEN NEW.status = 'fail' THEN 'high' ELSE 'medium' END
  FROM 
    profiles u
    CROSS JOIN assets a
  WHERE 
    u.role IN ('admin', 'supervisor', 'manager') AND
    a.id = (
      SELECT asset_id FROM completed_checklists WHERE id = NEW.checklist_id
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_checklist_issue_created
AFTER INSERT ON checklist_issues
FOR EACH ROW
EXECUTE FUNCTION notify_checklist_issues();
```

#### 3.3 Integración con el Sistema de Notificaciones

Crearemos un servicio de notificaciones para alertar a los usuarios sobre problemas detectados en los checklists:

```typescript
// lib/services/notification-service.ts
import { createClient } from '@/lib/supabase/client'

export const notificationService = {
  async getNotifications(userId: string) {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      
    if (error) {
      throw new Error(`Error obteniendo notificaciones: ${error.message}`)
    }
    
    return data
  },
  
  async markAsRead(notificationId: string) {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notificationId)
      
    if (error) {
      throw new Error(`Error marcando notificación como leída: ${error.message}`)
    }
  },
  
  async getUnreadCount(userId: string) {
    const supabase = createClient()
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unread')
      
    if (error) {
      throw new Error(`Error contando notificaciones: ${error.message}`)
    }
    
    return count
  },
  
  // Suscribirse a nuevas notificaciones en tiempo real
  subscribeToNewNotifications(userId: string, callback: (notification: any) => void) {
    const supabase = createClient()
    
    const subscription = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
      
    return () => {
      subscription.unsubscribe()
    }
  }
}
```

#### 3.4 Integración con el Módulo de Órdenes de Trabajo

Implementaremos la lógica para crear órdenes de trabajo basadas en los problemas detectados en los checklists:

```typescript
// lib/services/checklist-to-workorder-service.ts
import { createClient } from '@/lib/supabase/client'

export const checklistToWorkorderService = {
  // Convertir un problema de checklist en una orden de trabajo
  async createWorkOrderFromIssue(issueId: string, priority: string = 'media') {
    const supabase = createClient()
    
    // Obtener la información del problema
    const { data: issue, error: issueError } = await supabase
      .from('checklist_issues')
      .select(`
        *,
        checklist:checklist_id(
          *,
          asset:asset_id(*)
        ),
        item:item_id(*)
      `)
      .eq('id', issueId)
      .single()
    
    if (issueError) {
      throw new Error(`Error obteniendo información del problema: ${issueError.message}`)
    }
    
    // Crear la orden de trabajo
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .insert({
        title: `Problema en ${issue.item.description}`,
        description: issue.notes || issue.description,
        asset_id: issue.checklist.asset_id,
        priority,
        status: 'pendiente',
        type: 'correctivo',
        reported_issue: `Problema detectado durante checklist: ${issue.description}`,
        photo_url: issue.photo_url
      })
      .select()
      .single()
    
    if (workOrderError) {
      throw new Error(`Error creando orden de trabajo: ${workOrderError.message}`)
    }
    
    // Actualizar el problema con el ID de la orden de trabajo
    const { error: updateError } = await supabase
      .from('checklist_issues')
      .update({ work_order_id: workOrder.id })
      .eq('id', issueId)
    
    if (updateError) {
      throw new Error(`Error actualizando problema: ${updateError.message}`)
    }
    
    return workOrder
  },
  
  // Obtener problemas pendientes que no tienen órdenes de trabajo asociadas
  async getPendingIssues() {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('checklist_issues')
      .select(`
        *,
        checklist:checklist_id(
          completion_date,
          asset:asset_id(name, asset_id, location)
        )
      `)
      .is('work_order_id', null)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Error obteniendo problemas pendientes: ${error.message}`)
    }
    
    return data
  }
}
```

#### 3.5 Implementación de Vistas de Informes

Crearemos vistas que permitan analizar el estado de los checklists y detectar tendencias en los problemas:

```sql
-- Vista: active_assets_without_recent_inspection
CREATE OR REPLACE VIEW active_assets_without_recent_inspection AS
SELECT 
  a.*,
  em.name AS model_name,
  em.manufacturer,
  COALESCE(cc.last_inspection, a.last_inspection_date) AS last_inspection,
  EXTRACT(DAY FROM NOW() - COALESCE(cc.last_inspection, a.last_inspection_date)) AS days_since_last_inspection
FROM 
  assets a
  JOIN equipment_models em ON a.model_id = em.id
  LEFT JOIN (
    SELECT 
      asset_id, 
      MAX(completion_date) AS last_inspection
    FROM 
      completed_checklists
    GROUP BY 
      asset_id
  ) cc ON a.id = cc.asset_id
WHERE 
  a.status = 'activo' AND
  (
    COALESCE(cc.last_inspection, a.last_inspection_date) IS NULL OR
    EXTRACT(DAY FROM NOW() - COALESCE(cc.last_inspection, a.last_inspection_date)) > 30
  );

-- Vista: common_checklist_issues
CREATE OR REPLACE VIEW common_checklist_issues AS
SELECT 
  ci.item_id,
  i.description AS item_description,
  s.title AS section_title,
  c.name AS checklist_name,
  COUNT(*) AS issue_count
FROM 
  checklist_issues ci
  JOIN checklist_items i ON ci.item_id = i.id
  JOIN checklist_sections s ON i.section_id = s.id
  JOIN checklists c ON s.checklist_id = c.id
GROUP BY 
  ci.item_id, i.description, s.title, c.name
ORDER BY 
  issue_count DESC;

-- Vista: checklist_completion_rate
CREATE OR REPLACE VIEW checklist_completion_rate AS
SELECT 
  date_trunc('month', cs.scheduled_date) AS month,
  c.name AS checklist_name,
  COUNT(*) AS total_scheduled,
  SUM(CASE WHEN cs.status = 'completado' THEN 1 ELSE 0 END) AS completed,
  ROUND(
    SUM(CASE WHEN cs.status = 'completado' THEN 1 ELSE 0 END)::numeric / 
    COUNT(*)::numeric * 100, 
    2
  ) AS completion_rate
FROM 
  checklist_schedules cs
  JOIN checklists c ON cs.template_id = c.id
WHERE 
  cs.scheduled_date >= NOW() - INTERVAL '12 months'
GROUP BY 
  date_trunc('month', cs.scheduled_date), c.name
ORDER BY 
  month DESC, checklist_name;
```

#### 3.6 Componente de Dashboard para Checklists

Implementaremos un componente para el dashboard principal que muestre información relevante sobre los checklists:

```tsx
// components/dashboard/checklist-status-card.tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export function ChecklistStatusCard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pending: 0,
    completed: 0,
    overdue: 0,
    completionRate: 0,
    pendingToday: []
  })
  
  useEffect(() => {
    async function loadChecklistStats() {
      try {
        setLoading(true)
        const supabase = createClient()
        
        // Obtener checklists pendientes
        const { data: pendingData, error: pendingError } = await supabase
          .from('checklist_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendiente')
        
        // Obtener checklists completados en los últimos 30 días
        const { data: completedData, error: completedError } = await supabase
          .from('checklist_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completado')
          .gte('scheduled_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        
        // Obtener checklists vencidos
        const { data: overdueData, error: overdueError } = await supabase
          .from('checklist_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendiente')
          .lt('scheduled_date', new Date().toISOString())
        
        // Obtener checklists programados para hoy
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const { data: todayData, error: todayError } = await supabase
          .from('checklist_schedules')
          .select(`
            id,
            checklists (name),
            assets (name, asset_id)
          `)
          .eq('status', 'pendiente')
          .gte('scheduled_date', today.toISOString())
          .lt('scheduled_date', tomorrow.toISOString())
        
        if (pendingError || completedError || overdueError || todayError) {
          throw new Error('Error obteniendo estadísticas de checklists')
        }
        
        const total = (pendingData.count || 0) + (completedData.count || 0)
        const completionRate = total > 0 ? (completedData.count || 0) / total * 100 : 0
        
        setStats({
          pending: pendingData.count || 0,
          completed: completedData.count || 0,
          overdue: overdueData.count || 0,
          completionRate,
          pendingToday: todayData || []
        })
      } catch (error) {
        console.error('Error loading checklist stats:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadChecklistStats()
  }, [])
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checklists</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center">
            <p className="text-muted-foreground">Cargando estadísticas...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Checklists</span>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/checklists">
              Ver todos <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-sm">Pendientes</span>
            <span className="text-2xl font-bold">{stats.pending}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-sm">Completados (30d)</span>
            <span className="text-2xl font-bold">{stats.completed}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-sm">Vencidos</span>
            <span className="text-2xl font-bold text-destructive">{stats.overdue}</span>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm">Tasa de Completado</span>
            <span className="text-sm font-medium">{stats.completionRate.toFixed(0)}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>
        
        {stats.overdue > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Checklists vencidos</AlertTitle>
            <AlertDescription>
              Hay {stats.overdue} checklists que debieron completarse y siguen pendientes.
            </AlertDescription>
          </Alert>
        )}
        
        {stats.pendingToday.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Checklists para hoy:</h4>
            <ul className="space-y-2">
              {stats.pendingToday.slice(0, 3).map((item) => (
                <li key={item.id} className="text-sm">
                  <Link 
                    href={`/checklists/ejecutar/${item.id}`}
                    className="flex items-center hover:underline"
                  >
                    <ClipboardCheck className="h-4 w-4 mr-2 text-primary" />
                    {item.checklists.name} - {item.assets.name} ({item.assets.asset_id})
                  </Link>
                </li>
              ))}
              {stats.pendingToday.length > 3 && (
                <li className="text-sm text-muted-foreground">
                  Y {stats.pendingToday.length - 3} más...
                </li>
              )}
            </ul>
          </div>
        )}
        
        {stats.pending === 0 && stats.overdue === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle>Todo al día</AlertTitle>
            <AlertDescription>
              No hay checklists pendientes en este momento.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
```

### Fase 4: Automatización, Informes y Optimizaciones

La cuarta y última fase completará la implementación del sistema de checklists con funciones avanzadas de automatización, generación de informes y optimizaciones para mejorar la experiencia del usuario.

#### 4.1 Generación Automática de Programaciones

Implementaremos un sistema que genere automáticamente checklists programados basados en patrones predefinidos:

```typescript
// app/api/checklists/generate-schedules/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { addDays, addMonths, addWeeks, getDay, format } from 'date-fns'

export async function POST(request: Request) {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )

  try {
    const { pattern, startDate, endDate, assetIds, templateIds, assignedTo } = await request.json()
    
    const startDateTime = new Date(startDate)
    const endDateTime = new Date(endDate)
    
    // Validar fechas
    if (endDateTime <= startDateTime) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la fecha de inicio' },
        { status: 400 }
      )
    }
    
    // Validar activos y plantillas
    if (!assetIds?.length || !templateIds?.length) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un activo y una plantilla' },
        { status: 400 }
      )
    }
    
    // Arreglo para almacenar los IDs de los checklists creados
    const createdSchedules = []
    
    // Procesar cada combinación de activo y plantilla
    for (const assetId of assetIds) {
      for (const templateId of templateIds) {
        
        // Obtener información de la plantilla
        const { data: template } = await supabase
          .from('checklists')
          .select('*')
          .eq('id', templateId)
          .single()
          
        if (!template) continue
        
        // Calcular fechas basadas en el patrón
        const scheduleDates = []
        let currentDate = new Date(startDateTime)
        
        switch (pattern) {
          case 'daily':
            // Diario
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addDays(currentDate, 1)
            }
            break
            
          case 'weekly':
            // Semanal (mismo día de la semana)
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addWeeks(currentDate, 1)
            }
            break
            
          case 'biweekly':
            // Quincenal
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addDays(currentDate, 14)
            }
            break
            
          case 'monthly':
            // Mensual (mismo día del mes)
            while (currentDate <= endDateTime) {
              scheduleDates.push(new Date(currentDate))
              currentDate = addMonths(currentDate, 1)
            }
            break
            
          case 'workdays':
            // Solo días laborables (lunes a viernes)
            while (currentDate <= endDateTime) {
              const dayOfWeek = getDay(currentDate)
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                scheduleDates.push(new Date(currentDate))
              }
              currentDate = addDays(currentDate, 1)
            }
            break
            
          default:
            break
        }
        
        // Crear las programaciones en la base de datos
        for (const scheduleDate of scheduleDates) {
          const { data, error } = await supabase
            .from('checklist_schedules')
            .insert({
              template_id: templateId,
              asset_id: assetId,
              scheduled_date: scheduleDate.toISOString(),
              status: 'pendiente',
              assigned_to: assignedTo
            })
            .select()
            .single()
            
          if (!error) {
            createdSchedules.push(data.id)
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      count: createdSchedules.length,
      schedules: createdSchedules
    })
    
  } catch (error) {
    console.error('Error generating schedules:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
```

#### 4.2 Informes y Análisis

Implementaremos un conjunto de informes para analizar el rendimiento de los checklists y la detección de problemas:

```tsx
// app/reportes/checklists/page.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChecklistCompletionChart } from "@/components/checklists/checklist-completion-chart"
import { CommonIssuesTable } from "@/components/checklists/common-issues-table"
import { AssetInspectionTable } from "@/components/checklists/asset-inspection-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const metadata: Metadata = {
  title: "Informes de Checklists | Sistema de Mantenimiento",
  description: "Análisis e informes sobre inspecciones y detección de problemas",
}

export default async function ChecklistReportsPage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener estadísticas de completado mensual
  const { data: completionRates } = await supabase
    .from('checklist_completion_rate')
    .select('*')
    .order('month', { ascending: false })
    .limit(12)
  
  // Obtener problemas más comunes
  const { data: commonIssues } = await supabase
    .from('common_checklist_issues')
    .select('*')
    .limit(10)
  
  // Obtener activos sin inspección reciente
  const { data: assetsWithoutInspection } = await supabase
    .from('active_assets_without_recent_inspection')
    .select('*')
    .order('days_since_last_inspection', { ascending: false })
    .limit(20)
    
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Informes de Checklists</h1>
      
      <Tabs defaultValue="completion" className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-3">
          <TabsTrigger value="completion">Tasa de Completado</TabsTrigger>
          <TabsTrigger value="issues">Problemas Comunes</TabsTrigger>
          <TabsTrigger value="assets">Activos sin Inspección</TabsTrigger>
        </TabsList>
        
        <TabsContent value="completion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasa de Completado de Checklists</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistCompletionChart data={completionRates || []} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="issues" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Problemas Más Comunes Detectados</CardTitle>
            </CardHeader>
            <CardContent>
              <CommonIssuesTable issues={commonIssues || []} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assets" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activos sin Inspección Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetInspectionTable assets={assetsWithoutInspection || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

Implementaremos los componentes necesarios para mostrar estos reportes:

```tsx
// components/checklists/checklist-completion-chart.tsx
"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

export function ChecklistCompletionChart({ data }) {
  const [chartData, setChartData] = useState([])
  
  useEffect(() => {
    if (!data) return
    
    // Transformar los datos para agruparlos por mes
    const transformedData = []
    const monthGroups = {}
    
    data.forEach(item => {
      const monthKey = item.month
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          month: monthKey,
          monthLabel: format(parseISO(monthKey), 'MMMM yyyy', { locale: es }),
          total: 0,
          completed: 0
        }
      }
      
      monthGroups[monthKey].total += item.total_scheduled
      monthGroups[monthKey].completed += item.completed
    })
    
    Object.values(monthGroups).forEach(monthData => {
      const completionRate = (monthData.completed / monthData.total) * 100
      transformedData.push({
        ...monthData,
        completionRate: Math.round(completionRate * 100) / 100
      })
    })
    
    // Ordenar por fecha (más reciente primero)
    transformedData.sort((a, b) => new Date(b.month) - new Date(a.month))
    
    // Limitar a los últimos 6 meses
    setChartData(transformedData.slice(0, 6).reverse())
  }, [data])
  
  if (chartData.length === 0) {
    return <div className="flex justify-center items-center h-60">No hay datos disponibles</div>
  }
  
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="monthLabel" />
          <YAxis yAxisId="left" orientation="left" domain={[0, 100]} />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip formatter={(value, name) => {
            if (name === 'Tasa Completado') return [`${value}%`, name]
            return [value, name]
          }} />
          <Legend />
          <Bar yAxisId="right" dataKey="total" name="Total Programados" fill="#8884d8" />
          <Bar yAxisId="right" dataKey="completed" name="Completados" fill="#82ca9d" />
          <Bar yAxisId="left" dataKey="completionRate" name="Tasa Completado" fill="#ff7300" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

```tsx
// components/checklists/common-issues-table.tsx
"use client"

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function CommonIssuesTable({ issues }) {
  if (!issues || issues.length === 0) {
    return <div className="text-center py-10">No se encontraron problemas recurrentes</div>
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción del Problema</TableHead>
          <TableHead>Sección</TableHead>
          <TableHead>Checklist</TableHead>
          <TableHead className="text-right">Ocurrencias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map(issue => (
          <TableRow key={issue.item_id}>
            <TableCell className="font-medium">{issue.item_description}</TableCell>
            <TableCell>{issue.section_title}</TableCell>
            <TableCell>{issue.checklist_name}</TableCell>
            <TableCell className="text-right">
              <Badge variant={issue.issue_count > 5 ? "destructive" : "default"}>
                {issue.issue_count}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

```tsx
// components/checklists/asset-inspection-table.tsx
"use client"

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import Link from "next/link"

export function AssetInspectionTable({ assets }) {
  if (!assets || assets.length === 0) {
    return <div className="text-center py-10">Todos los activos han sido inspeccionados recientemente</div>
  }
  
  function renderLastInspection(asset) {
    if (!asset.last_inspection) {
      return <span className="text-red-600">Nunca</span>
    }
    
    const days = asset.days_since_last_inspection
    let className = "text-green-600"
    
    if (days > 90) {
      className = "text-red-600"
    } else if (days > 30) {
      className = "text-yellow-600"
    }
    
    return (
      <span className={className}>
        {new Date(asset.last_inspection).toLocaleDateString()} ({days} días)
      </span>
    )
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Activo</TableHead>
          <TableHead>Modelo</TableHead>
          <TableHead>Ubicación</TableHead>
          <TableHead>Última inspección</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map(asset => (
          <TableRow key={asset.id}>
            <TableCell className="font-medium">
              {asset.name}
              <div className="text-xs text-muted-foreground">{asset.asset_id}</div>
            </TableCell>
            <TableCell>
              {asset.manufacturer} {asset.model_name}
            </TableCell>
            <TableCell>{asset.location}</TableCell>
            <TableCell>{renderLastInspection(asset)}</TableCell>
            <TableCell className="text-right">
              <Button asChild size="sm" variant="outline">
                <Link href={`/checklists/programar?asset=${asset.id}`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Programar
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

#### 4.3 Optimizaciones para Dispositivos Móviles

Para asegurar que el sistema funcione correctamente en dispositivos móviles, implementaremos mejoras específicas para la experiencia en móviles:

```tsx
// components/checklists/mobile-execution-header.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Info, User, MapPin, Calendar, Clipboard } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function MobileExecutionHeader({ schedule }) {
  const [open, setOpen] = useState(false)
  
  if (!schedule) return null
  
  const checklist = schedule.checklists
  const asset = schedule.assets
  
  return (
    <div className="lg:hidden sticky top-0 z-10 bg-background border-b py-2 px-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <Clipboard className="h-5 w-5 text-primary" />
        <div className="font-medium truncate max-w-[180px]">{checklist.name}</div>
      </div>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalles de la Inspección</SheetTitle>
            <SheetDescription>
              Información sobre el activo y el checklist
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-start space-x-3">
              <Clipboard className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Checklist</div>
                <div className="text-sm text-muted-foreground">{checklist.name}</div>
                {checklist.description && (
                  <div className="text-sm mt-1">{checklist.description}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Activo</div>
                <div className="text-sm text-muted-foreground">{asset.name}</div>
                <div className="text-sm">{asset.asset_id}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Ubicación</div>
                <div className="text-sm">{asset.location}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Fecha Programada</div>
                <div className="text-sm">
                  {format(new Date(schedule.scheduled_date), "PPP", { locale: es })}
                </div>
              </div>
            </div>
            
            {schedule.profiles && (
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Técnico Asignado</div>
                  <div className="text-sm">
                    {schedule.profiles.nombre} {schedule.profiles.apellido}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
```

#### 4.4 Trabajar sin Conexión

Implementaremos funcionalidades para permitir a los técnicos trabajar sin conexión, guardando los datos localmente y sincronizándolos cuando vuelvan a tener conexión:

```typescript
// lib/services/offline-checklist-service.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { createClient } from '@/lib/supabase/client'

interface ChecklistDB extends DBSchema {
  'offline-checklists': {
    key: string
    value: {
      id: string
      data: any
      synced: boolean
      timestamp: number
    }
  }
}

class OfflineChecklistService {
  private db: Promise<IDBPDatabase<ChecklistDB>>
  
  constructor() {
    this.db = openDB<ChecklistDB>('checklists-offline', 1, {
      upgrade(db) {
        db.createObjectStore('offline-checklists', { keyPath: 'id' })
      }
    })
  }
  
  // Guardar un checklist completado offline
  async saveOfflineChecklist(id: string, data: any) {
    const db = await this.db
    await db.put('offline-checklists', {
      id,
      data,
      synced: false,
      timestamp: Date.now()
    })
  }
  
  // Obtener todos los checklists pendientes de sincronización
  async getPendingSyncs() {
    const db = await this.db
    const all = await db.getAll('offline-checklists')
    return all.filter(item => !item.synced)
  }
  
  // Marcar un checklist como sincronizado
  async markAsSynced(id: string) {
    const db = await this.db
    const item = await db.get('offline-checklists', id)
    if (item) {
      item.synced = true
      await db.put('offline-checklists', item)
    }
  }
  
  // Sincronizar todos los checklists pendientes
  async syncAll() {
    const pending = await this.getPendingSyncs()
    const results = []
    
    const supabase = createClient()
    
    for (const item of pending) {
      try {
        const response = await fetch(`/api/checklists/schedules/${item.data.scheduleId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item.data),
        })
        
        const result = await response.json()
        
        if (response.ok) {
          await this.markAsSynced(item.id)
          results.push({ id: item.id, success: true, result })
        } else {
          results.push({ id: item.id, success: false, error: result.error })
        }
      } catch (error) {
        results.push({ id: item.id, success: false, error: 'Error de conexión' })
      }
    }
    
    return results
  }
  
  // Comprobar si hay elementos pendientes de sincronización
  async hasPendingSyncs() {
    const pending = await this.getPendingSyncs()
    return pending.length > 0
  }
  
  // Limpiar datos antiguos (más de 30 días)
  async cleanOldData() {
    const db = await this.db
    const all = await db.getAll('offline-checklists')
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    
    for (const item of all) {
      if (item.synced && item.timestamp < thirtyDaysAgo) {
        await db.delete('offline-checklists', item.id)
      }
    }
  }
}

export const offlineChecklistService = new OfflineChecklistService()
```

#### 4.5 Implementación de Notificaciones

Finalmente, implementaremos un sistema de notificaciones para mantener a los usuarios informados sobre los checklists pendientes:

```tsx
// components/notifications/checklist-notifications.tsx
"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { notificationService } from "@/lib/services/notification-service"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"

export function ChecklistNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!user) return
    
    async function loadNotifications() {
      try {
        setLoading(true)
        const data = await notificationService.getNotifications(user.id)
        setNotifications(data || [])
        
        const count = await notificationService.getUnreadCount(user.id)
        setUnreadCount(count || 0)
      } catch (error) {
        console.error('Error cargando notificaciones:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadNotifications()
    
    // Suscripción a nuevas notificaciones
    const unsubscribe = notificationService.subscribeToNewNotifications(
      user.id,
      (newNotification) => {
        setNotifications(prev => [newNotification, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    )
    
    return () => {
      unsubscribe()
    }
  }, [user])
  
  async function handleMarkAsRead(notificationId) {
    try {
      await notificationService.markAsRead(notificationId)
      
      // Actualizar la UI
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, status: 'read', read_at: new Date().toISOString() } 
            : notif
        )
      )
      
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }
  
  if (!user) return null
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h4 className="font-medium">Notificaciones</h4>
          {unreadCount > 0 && (
            <Badge variant="outline">{unreadCount} sin leer</Badge>
          )}
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Cargando notificaciones...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay notificaciones nuevas
            </div>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <DropdownMenuItem 
                key={notification.id}
                className={`p-3 cursor-pointer ${notification.status === 'unread' ? 'bg-muted/50' : ''}`}
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="flex flex-col space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{notification.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{notification.message}</p>
                  {notification.related_entity === 'checklist_issue' && (
                    <Link 
                      href={`/checklists/problemas/${notification.entity_id}`}
                      className="text-xs text-blue-600 hover:underline mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver detalles
                    </Link>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer justify-center text-center py-2">
              <Link href="/notificaciones">Ver todas las notificaciones</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Conclusión y Próximos Pasos

Con la implementación de estas cuatro fases, el sistema de checklists quedará completamente integrado en la plataforma de gestión de mantenimiento, permitiendo:

1. **Gestión completa de plantillas de inspección** con diferentes frecuencias y tipos de items.
2. **Programación flexible** de checklists para activos específicos.
3. **Ejecución eficiente** de inspecciones con captura de problemas y firmas digitales.
4. **Integración con mantenimiento correctivo** mediante la generación automática de órdenes de trabajo.
5. **Análisis y reportes** para la toma de decisiones basada en datos.
6. **Funcionalidades avanzadas** como trabajo sin conexión y notificaciones.

Para futuras mejoras, se podría considerar:

- Implementar un sistema de verificación por códigos QR para confirmar la presencia del técnico en el activo.
- Integración con sistemas IoT para comparar lecturas de sensores con las inspecciones manuales.
- Funcionalidades de inteligencia artificial para detectar patrones en problemas recurrentes.
- Expansión del sistema para incluir auditorías de seguridad y cumplimiento normativo.

Esta implementación proporciona una base sólida para la gestión eficiente de inspecciones de mantenimiento, mejorando la detección temprana de problemas y prolongando la vida útil de los activos.

