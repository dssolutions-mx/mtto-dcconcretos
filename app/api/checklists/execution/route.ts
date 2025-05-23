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
  const { schedule_id, completed_items, technician, notes, signature } = await request.json()
  
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
      
      // Temporalmente deshabilitar RLS para pruebas
      try {
        await supabase.rpc('set_config', {
          setting_name: 'row_security',
          setting_value: 'off',
          is_local: true
        })
      } catch {
        console.log('No se pudo deshabilitar RLS temporalmente')
      }
      
      return await processChecklistCompletion(supabase, schedule_id, completed_items, technician, notes, signature)
    } else {
      console.log('Usando cliente de servicio con service_role_key')
      const supabase = createServiceClient()
      return await processChecklistCompletion(supabase, schedule_id, completed_items, technician, notes, signature)
    }
    
  } catch (error: any) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
  
  // 2. Verificar si hay ítems con problemas
  const hasIssues = completed_items.some((item: any) => 
    item.status === 'flag' || item.status === 'fail'
  )
  
  // 3. Get technician name - use the provided value or default
  let technicianName = 'Técnico'
  
  // If technician parameter was provided, use it
  if (technician && typeof technician === 'string' && technician.length > 0) {
    technicianName = technician
  }

  // 4. Crear el registro de checklist completado
  const { data: completedData, error: completedError } = await supabase
    .from('completed_checklists')
    .insert({
      checklist_id: scheduleData.template_id,
      asset_id: scheduleData.asset_id,
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
  
  // 5. Actualizar el estado de la programación a completado
  const { error: updateError } = await supabase
    .from('checklist_schedules')
    .update({ 
      status: 'completado',
      updated_at: new Date().toISOString()
    })
    .eq('id', schedule_id)
  
  if (updateError) throw updateError
  
  // 6. Si hay problemas, registrarlos
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
  }
  
  // 7. Actualizar fecha de último mantenimiento del activo
  const { error: assetError } = await supabase
    .from('assets')
    .update({ 
      last_maintenance_date: new Date().toISOString()
    })
    .eq('id', scheduleData.asset_id)
  
  if (assetError) throw assetError
  
  return NextResponse.json({ 
    success: true, 
    data: { 
      completed_id: completedData.id,
      has_issues: hasIssues
    }
  })
} 