import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    const assetId = url.searchParams.get('assetId')
    const cleanup = url.searchParams.get('cleanup')
    
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

    if (cleanup === 'true') {
      try {
        const { data: duplicates, error: duplicatesError } = await supabase
          .from('checklist_schedules')
          .select('id, template_id, asset_id, scheduled_date, created_at')
          .eq('status', 'pendiente')
          .order('template_id, asset_id, scheduled_date, created_at')
        
        if (duplicatesError) throw duplicatesError
        
        const groups = new Map()
        let deletedCount = 0
        
        for (const schedule of duplicates || []) {
          const date = new Date(schedule.scheduled_date).toISOString().split('T')[0]
          const key = `${schedule.template_id}-${schedule.asset_id}-${date}`
          
          if (!groups.has(key)) {
            groups.set(key, [])
          }
          groups.get(key).push(schedule)
        }
        
        for (const [key, schedules] of groups) {
          if (schedules.length > 1) {
            schedules.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            const toDelete = schedules.slice(1)
            
            for (const schedule of toDelete) {
              const { error: deleteError } = await supabase
                .from('checklist_schedules')
                .delete()
                .eq('id', schedule.id)
              
              if (!deleteError) {
                deletedCount++
              }
            }
          }
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Se eliminaron ${deletedCount} programaciones duplicadas` 
        })
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError)
        return NextResponse.json(
          { error: 'Error durante la limpieza de duplicados' },
          { status: 500 }
        )
      }
    }

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

    if (status) {
      query = query.eq('status', status)
    }

    if (assetId) {
      query = query.eq('asset_id', assetId)
    }

    // Order by scheduled_day for pending, by updated_at for completed
    if (status === 'completado') {
      query = query.order('updated_at', { ascending: false })
    } else {
      query = query.order('scheduled_day', { ascending: true })
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter by type/frequency on the server side after getting the data
    let filteredData = data || []
    if (type && filteredData.length > 0) {
      filteredData = filteredData.filter(schedule => 
        schedule.checklists?.frequency === type
      )
    }

    // Ensure scheduled_day is present for clients relying on date-only logic
    filteredData = filteredData.map((s: any) => ({
      ...s,
      scheduled_day: s.scheduled_day || (s.scheduled_date ? s.scheduled_date.split('T')[0] : null),
    }))

    // Fetch profile information for assigned users
    if (filteredData.length > 0) {
      const userIds = [...new Set(filteredData.map(schedule => schedule.assigned_to).filter(Boolean))]
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nombre, apellido')
          .in('id', userIds)
        
        if (!profilesError && profiles) {
          // Add profile data to schedules
          filteredData = filteredData.map(schedule => ({
            ...schedule,
            profiles: profiles.find(profile => profile.id === schedule.assigned_to) || null
          }))
        }
      }
    }

    return NextResponse.json({ data: filteredData })
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