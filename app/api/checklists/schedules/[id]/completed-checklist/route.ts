import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for Authorization header first (for offline service requests)
    const authHeader = request.headers.get('authorization')
    let supabase
    
    if (authHeader?.startsWith('Bearer ')) {
      // Create client with the provided token
      const token = authHeader.replace('Bearer ', '')
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          },
          cookies: {
            getAll: () => [],
            setAll: () => {}
          }
        }
      )
    } else {
      // Use normal cookie-based auth
      supabase = await createClient()
    }
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error in completed-checklist API:', userError)
      return NextResponse.json(
        { 
          error: 'Usuario no autenticado',
          details: userError?.message || 'No user session found'
        },
        { status: 401 }
      )
    }

    const { id: scheduleId } = await params
    
    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID es requerido' },
        { status: 400 }
      )
    }

    console.log(`🔍 Looking up completed checklist for schedule: ${scheduleId}`)

    // First, get the schedule to find the template_id and asset_id
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('checklist_schedules')
      .select('template_id, asset_id, scheduled_date')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !scheduleData) {
      console.error('Error fetching schedule:', scheduleError)
      return NextResponse.json(
        { error: 'Schedule no encontrado' },
        { status: 404 }
      )
    }

    // Now look for completed checklists that match this template and asset
    // Get the most recent one - prioritize those completed after scheduled date, but fall back to any recent completion
    let completedChecklist = null
    
    try {
      const { data, error } = await supabase
        .from('completed_checklists')
        .select('id, completion_date, technician')
        .eq('checklist_id', scheduleData.template_id)
        .eq('asset_id', scheduleData.asset_id)
        .gte('completion_date', scheduleData.scheduled_date)
        .order('completion_date', { ascending: false })
        .limit(1) // Add explicit limit as precaution
      
      if (error) {
        console.error('Error querying completed checklists after scheduled date:', error)
        return NextResponse.json(
          { error: 'Error al buscar checklist completado' },
          { status: 500 }
        )
      }
      
      // Get the first result if there are any
      completedChecklist = data && data.length > 0 ? data[0] : null
      console.log(`🔍 Primary completion lookup result:`, completedChecklist ? 'Found after scheduled date' : 'Not found after scheduled date')
      
    } catch (primaryError) {
      console.error('Error in primary completed checklist query:', primaryError)
      return NextResponse.json(
        { error: 'Error al buscar checklist completado' },
        { status: 500 }
      )
    }

    // If no completed checklist found after scheduled date, look for any recent completion
    if (!completedChecklist) {
      console.log(`🔍 No completion found after scheduled date, looking for any recent completion`)
      
      try {
        const { data: anyRecentCompletion, error: anyError } = await supabase
          .from('completed_checklists')
          .select('id, completion_date, technician')
          .eq('checklist_id', scheduleData.template_id)
          .eq('asset_id', scheduleData.asset_id)
          .order('completion_date', { ascending: false })
          .limit(1) // Add explicit limit to prevent multiple rows error
        
        if (anyError) {
          console.error('Error querying any completed checklists:', anyError)
          return NextResponse.json(
            { error: 'Error al buscar checklist completado' },
            { status: 500 }
          )
        }
        
        // Get the first result if there are any
        completedChecklist = anyRecentCompletion && anyRecentCompletion.length > 0 ? anyRecentCompletion[0] : null
        console.log(`🔍 Recent completion lookup result:`, completedChecklist ? 'Found' : 'Not found')
        
      } catch (fallbackError) {
        console.error('Error in fallback completed checklist query:', fallbackError)
        return NextResponse.json(
          { error: 'Error al buscar checklist completado' },
          { status: 500 }
        )
      }
    }

    // Note: We don't check for error here anymore since we handle errors within each query block

    if (!completedChecklist) {
      return NextResponse.json(
        { 
          completed_checklist_id: null,
          message: 'No se encontró checklist completado para este schedule'
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      completed_checklist_id: completedChecklist.id,
      completion_date: completedChecklist.completion_date,
      technician: completedChecklist.technician,
      schedule_id: scheduleId
    })

  } catch (error) {
    console.error('Error in completed checklist lookup:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 