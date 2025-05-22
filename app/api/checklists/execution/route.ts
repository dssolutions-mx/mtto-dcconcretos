import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  const { schedule_id, completed_items, technician, notes, signature } = await request.json()
  
  if (!schedule_id || !completed_items || !technician) {
    return NextResponse.json({ 
      error: 'Faltan campos requeridos (schedule_id, completed_items, technician)' 
    }, { status: 400 })
  }
  
  try {
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
    
    // 3. Crear el registro de checklist completado
    const { data: completedData, error: completedError } = await supabase
      .from('completed_checklists')
      .insert({
        checklist_id: scheduleData.template_id,
        asset_id: scheduleData.asset_id,
        completed_items: completed_items,
        technician: technician,
        completion_date: new Date().toISOString(),
        notes: notes,
        signature_data: signature,
        status: hasIssues ? 'Con Problemas' : 'Completado'
      })
      .select('id')
      .single()
    
    if (completedError) throw completedError
    
    // 4. Actualizar el estado de la programación a completado
    const { error: updateError } = await supabase
      .from('checklist_schedules')
      .update({ 
        status: 'completado',
        updated_at: new Date().toISOString()
      })
      .eq('id', schedule_id)
    
    if (updateError) throw updateError
    
    // 5. Si hay problemas, registrarlos
    if (hasIssues) {
      for (const item of completed_items) {
        if (item.status === 'flag' || item.status === 'fail') {
          const { error: issueError } = await supabase
            .from('checklist_issues')
            .insert({
              checklist_id: completedData.id,
              item_id: item.item_id,
              status: item.status,
              description: 'Problema detectado durante el checklist',
              notes: item.notes,
              photo_url: item.photo_url,
              resolved: false
            })
          
          if (issueError) throw issueError
        }
      }
    }
    
    // 6. Actualizar fecha de último mantenimiento del activo
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
    
  } catch (error: any) {
    console.error('Error completing checklist:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
} 