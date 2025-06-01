import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Crear un cliente de servicio que use la service_role key para bypass RLS
const createServiceClient = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for service client
        },
      },
    }
  )
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  
  if (!id) {
    return NextResponse.json({ error: 'Se requiere ID del checklist' }, { status: 400 })
  }
  
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { data, error } = await supabase
    .from('checklist_schedules')
    .select(`
      *,
      checklists (
        *,
        checklist_sections (
          *,
          checklist_items(*)
        ),
        equipment_models (
          id, 
          name, 
          manufacturer
        )
      ),
      assets (
        id,
        name,
        asset_id,
        location
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(request: Request) {
  const { 
    schedule_id, 
    completed_items, 
    technician, 
    notes, 
    signature,
    equipment_hours_reading,
    equipment_kilometers_reading 
  } = await request.json()
  
  if (!schedule_id || !completed_items) {
    return NextResponse.json({ 
      error: 'Faltan campos requeridos (schedule_id, completed_items)' 
    }, { status: 400 })
  }
  
  try {
    // Verificar variables de entorno
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('SUPABASE_SERVICE_ROLE_KEY no está configurada, usando cliente anónimo')
      
      // Usar cliente anónimo si no hay service key
      const cookieStore = await cookies()
      
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
                // Ignorar errores de cookies en server components
              }
            },
          },
        }
      )
      
      return await processChecklistCompletionEnhanced(
        supabase, 
        schedule_id, 
        completed_items, 
        technician, 
        notes, 
        signature,
        equipment_hours_reading,
        equipment_kilometers_reading
      )
    } else {
      console.log('Usando cliente de servicio con service_role_key')
      const supabase = createServiceClient()
      return await processChecklistCompletionEnhanced(
        supabase, 
        schedule_id, 
        completed_items, 
        technician, 
        notes, 
        signature,
        equipment_hours_reading,
        equipment_kilometers_reading
      )
    }
    
  } catch (error: any) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processChecklistCompletionEnhanced(
  supabase: any, 
  schedule_id: string, 
  completed_items: any[], 
  technician: string, 
  notes: string, 
  signature: string,
  equipment_hours_reading?: number,
  equipment_kilometers_reading?: number
) {
  try {
    // Use the enhanced database function
    const { data, error } = await supabase.rpc('process_checklist_completion_enhanced', {
      p_schedule_id: schedule_id,
      p_completed_items: completed_items,
      p_technician: technician || 'Técnico',
      p_notes: notes || '',
      p_signature_data: signature || '',
      p_equipment_hours_reading: equipment_hours_reading || null,
      p_equipment_kilometers_reading: equipment_kilometers_reading || null
    })
    
    if (error) throw error
    
    return NextResponse.json({ 
      success: true, 
      data: data
    })
  } catch (error: any) {
    console.error('Error in enhanced checklist completion:', error)
    
    // Fallback to the original process if the enhanced function fails
    console.log('Falling back to original process...')
    return await processChecklistCompletion(
      supabase, 
      schedule_id, 
      completed_items, 
      technician, 
      notes, 
      signature
    )
  }
}

async function processChecklistCompletion(
  supabase: any, 
  schedule_id: string, 
  completed_items: any[], 
  technician: string, 
  notes: string, 
  signature: string
) {
  // 1. Obtener información de la programación del checklist
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('checklist_schedules')
    .select('template_id, asset_id')
    .eq('id', schedule_id)
    .single()
  
  if (scheduleError) throw scheduleError
  
  // 2. Ensure we have the correct asset UUID
  let assetUuid = scheduleData.asset_id
  
  // If asset_id is not a valid UUID, try to find the asset by asset_id string
  if (typeof scheduleData.asset_id === 'string' && !scheduleData.asset_id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('id')
      .eq('asset_id', scheduleData.asset_id)
      .single()
    
    if (!assetError && assetData) {
      assetUuid = assetData.id
    }
  }
  
  // 3. Verificar si hay ítems con problemas
  const hasIssues = completed_items.some((item: any) => 
    item.status === 'flag' || item.status === 'fail'
  )
  
  // 4. Get technician name - use the provided value or default
  let technicianName = 'Técnico'
  
  // If technician parameter was provided, use it
  if (technician && typeof technician === 'string' && technician.length > 0) {
    technicianName = technician
  }

  // 5. Crear el registro de checklist completado
  const { data: completedData, error: completedError } = await supabase
    .from('completed_checklists')
    .insert({
      checklist_id: scheduleData.template_id,
      asset_id: assetUuid,
      completed_items: completed_items,
      technician: technicianName,
      completion_date: new Date().toISOString(),
      notes: notes,
      signature_data: signature,
      status: hasIssues ? 'Con Problemas' : 'Completado'
    })
    .select('id')
    .single()
  
  if (completedError) throw completedError
  
  // 6. Actualizar el estado de la programación a completado
  const { error: updateError } = await supabase
    .from('checklist_schedules')
    .update({ 
      status: 'completado',
      updated_at: new Date().toISOString()
    })
    .eq('id', schedule_id)
  
  if (updateError) throw updateError
  
  // 7. Si hay problemas, registrarlos
  if (hasIssues) {
    for (const item of completed_items) {
      if (item.status === 'flag' || item.status === 'fail') {
        const { error: issueError } = await supabase
          .from('checklist_issues')
          .insert({
            checklist_id: completedData.id,
            item_id: String(item.item_id), // Convert to string to match column type
            status: item.status,
            description: 'Problema detectado durante el checklist',
            notes: item.notes || '',
            photo_url: item.photo_url || null,
            resolved: false
          })
        
        if (issueError) throw issueError
      }
    }
    
    // Generar orden de trabajo correctiva automáticamente
    try {
      const { data: workOrderData, error: workOrderError } = await supabase.rpc('generate_corrective_work_order_enhanced', {
        p_completed_checklist_id: completedData.id
      })
      
      if (workOrderError) {
        console.error('Error generando orden de trabajo:', workOrderError)
      } else {
        console.log('Orden de trabajo generada:', workOrderData)
      }
    } catch (workOrderError) {
      console.error('Error llamando función de orden de trabajo:', workOrderError)
    }
    
    // Crear incidentes automáticamente para cada issue
    try {
      const { data: issues } = await supabase
        .from('checklist_issues')
        .select('id')
        .eq('checklist_id', completedData.id)
      
      for (const issue of issues || []) {
        try {
          await supabase.rpc('create_incident_from_checklist_issue', {
            p_checklist_issue_id: issue.id
          })
        } catch (incidentError) {
          console.error('Error creando incidente:', incidentError)
        }
      }
    } catch (incidentError) {
      console.error('Error en creación de incidentes:', incidentError)
    }
  }
  
  // 8. Actualizar fecha de último mantenimiento del activo
  const { error: assetError } = await supabase
    .from('assets')
    .update({ 
      last_maintenance_date: new Date().toISOString()
    })
    .eq('id', assetUuid)
  
  if (assetError) throw assetError
  
  return NextResponse.json({ 
    success: true, 
    data: { 
      completed_id: completedData.id,
      has_issues: hasIssues,
      asset_uuid: assetUuid
    }
  })
} 