import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

    // Get current schedule stats
    const { data: beforeStats, error: beforeError } = await supabase
      .from('checklist_schedules')
      .select('id, scheduled_date, status, created_at, maintenance_plan_id')
      .eq('status', 'pendiente')
    
    if (beforeError) {
      return NextResponse.json({ error: beforeError.message }, { status: 500 })
    }

    const today = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(today.getDate() + 3)
    
    // Count schedules by category
    const totalBefore = beforeStats?.length || 0
    const todayAndNext3Days = beforeStats?.filter(s => 
      new Date(s.scheduled_date) <= threeDaysFromNow
    ).length || 0
    const futureSchedules = beforeStats?.filter(s => 
      new Date(s.scheduled_date) > threeDaysFromNow
    ).length || 0
    const withMaintenancePlan = beforeStats?.filter(s => 
      s.maintenance_plan_id !== null
    ).length || 0

    // Delete future schedules (more than 3 days) that were auto-generated
    // Keep schedules that are:
    // 1. For today or next 3 days
    // 2. Associated with specific maintenance plans
    // 3. Older than 7 days (probably manually created)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)

    const { data: deletedSchedules, error: deleteError } = await supabase
      .from('checklist_schedules')
      .delete()
      .eq('status', 'pendiente')
      .gt('scheduled_date', threeDaysFromNow.toISOString())
      .is('maintenance_plan_id', null)
      .gt('created_at', sevenDaysAgo.toISOString())
      .select('id')

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Get updated stats
    const { data: afterStats, error: afterError } = await supabase
      .from('checklist_schedules')
      .select('id, scheduled_date, status')
      .eq('status', 'pendiente')
    
    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 })
    }

    const totalAfter = afterStats?.length || 0
    const deletedCount = deletedSchedules?.length || 0

    return NextResponse.json({
      success: true,
      message: 'Limpieza de schedules completada',
      stats: {
        before: {
          total: totalBefore,
          todayAndNext3Days,
          futureSchedules,
          withMaintenancePlan
        },
        after: {
          total: totalAfter,
          deleted: deletedCount
        },
        summary: `Se eliminaron ${deletedCount} schedules automáticos futuros. Schedules restantes: ${totalAfter}`
      }
    })

  } catch (error: any) {
    console.error('Error cleaning up schedules:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
} 