import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
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
        assets (name, asset_id, location)
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
  } catch (error) {
    console.error('Error in GET schedules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const body = await request.json()
    
    // Handle schedule creation from maintenance interval
    if (body.fromMaintenance) {
      const { assetId, modelId, templateIds, assignedTo, maintenancePlanId, scheduledDate } = body
      
      if (!assetId || !templateIds?.length) {
        return NextResponse.json({ 
          error: 'Se requiere ID del activo y al menos una plantilla de checklist' 
        }, { status: 400 })
      }
      
      const createdSchedules = []
      
      // Create a checklist schedule for each template
      for (const templateId of templateIds) {
        const { data, error } = await supabase
          .from('checklist_schedules')
          .insert({
            template_id: templateId,
            asset_id: assetId,
            scheduled_date: scheduledDate || new Date().toISOString(),
            status: 'pendiente',
            assigned_to: assignedTo,
            maintenance_plan_id: maintenancePlanId
          })
          .select('*')
          .single()
        
        if (error) {
          console.error('Error creating checklist schedule:', error)
          continue
        }
        
        createdSchedules.push(data)
      }
      
      return NextResponse.json({ 
        success: true, 
        count: createdSchedules.length,
        data: createdSchedules 
      })
    }
    
    // Handle regular schedule creation
    const { schedule } = body
    
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
  } catch (error) {
    console.error('Error in POST schedules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 