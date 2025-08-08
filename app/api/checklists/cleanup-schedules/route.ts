import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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
      .select('id, scheduled_date, scheduled_day, status, created_at, maintenance_plan_id, template_id, asset_id')
      .eq('status', 'pendiente')
    
    if (beforeError) {
      return NextResponse.json({ error: beforeError.message }, { status: 500 })
    }

    const today = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(today.getDate() + 3)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(today.getDate() + 7)
    
    // Count schedules by category
    const totalBefore = beforeStats?.length || 0
    const todayAndNext3Days = beforeStats?.filter(s => 
      new Date((s as any).scheduled_day || s.scheduled_date) <= threeDaysFromNow
    ).length || 0
    const futureSchedules = beforeStats?.filter(s => 
      new Date((s as any).scheduled_day || s.scheduled_date) > threeDaysFromNow
    ).length || 0
    const withMaintenancePlan = beforeStats?.filter(s => 
      s.maintenance_plan_id !== null
    ).length || 0

    // Identify excessive schedules (more than 5 schedules for same template+asset combination)
    const scheduleGroups = new Map<string, any[]>()
    beforeStats?.forEach(schedule => {
      const key = `${schedule.template_id}-${schedule.asset_id}`
      if (!scheduleGroups.has(key)) {
        scheduleGroups.set(key, [])
      }
      scheduleGroups.get(key)!.push(schedule)
    })

    const excessiveSchedulesToDelete: string[] = []
    scheduleGroups.forEach((schedules, key) => {
      if (schedules.length > 5) {
        // Keep only the first 5 schedules (closest dates), mark others for deletion
        const sortedSchedules = schedules.sort((a: any, b: any) => 
          new Date((a as any).scheduled_day || a.scheduled_date).getTime() - new Date((b as any).scheduled_day || b.scheduled_date).getTime()
        )
        
        // Keep first 3 schedules, delete the rest if they're more than 7 days away
        const toDelete = sortedSchedules.slice(3).filter((s: any) => 
          new Date((s as any).scheduled_day || s.scheduled_date) > sevenDaysFromNow && 
          !s.maintenance_plan_id // Don't delete maintenance plan schedules
        )
        
        excessiveSchedulesToDelete.push(...toDelete.map((s: any) => s.id))
      }
    })

    // Delete excessive schedules
    let deletedExcessive = 0
    if (excessiveSchedulesToDelete.length > 0) {
      const { data: deletedExcessiveData, error: deleteExcessiveError } = await supabase
        .from('checklist_schedules')
        .delete()
        .in('id', excessiveSchedulesToDelete)
        .select('id')

      if (!deleteExcessiveError) {
        deletedExcessive = deletedExcessiveData?.length || 0
      }
    }

    // Delete future schedules (more than 7 days) that were auto-generated
    // Keep schedules that are:
    // 1. For today or next 7 days
    // 2. Associated with specific maintenance plans
    // 3. Older than 7 days (probably manually created)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)

    const { data: deletedSchedules, error: deleteError } = await supabase
      .from('checklist_schedules')
      .delete()
      .eq('status', 'pendiente')
      .gt('scheduled_date', sevenDaysFromNow.toISOString())
      .is('maintenance_plan_id', null)
      .gt('created_at', sevenDaysAgo.toISOString())
      .select('id')

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // Get updated stats
    const { data: afterStats, error: afterError } = await supabase
      .from('checklist_schedules')
      .select('id, scheduled_date, scheduled_day, status')
      .eq('status', 'pendiente')
    
    if (afterError) {
      return NextResponse.json({ error: afterError.message }, { status: 500 })
    }

    const totalAfter = afterStats?.length || 0
    const deletedCount = (deletedSchedules?.length || 0) + deletedExcessive

    // Also clean up any orphaned checklist issues
    const { data: orphanedIssues, error: orphanedError } = await supabase
      .from('checklist_issues')
      .delete()
      .is('work_order_id', null)
      .is('incident_id', null)
      .eq('resolved', false)
      .lt('created_at', sevenDaysAgo.toISOString())
      .select('id')

    const orphanedCount = orphanedIssues?.length || 0

    // Find duplicate checklist schedules (same template_id, asset_id, and scheduled_date)
    const { data: duplicateSchedules, error: findError } = await supabase
      .from('checklist_schedules')
      .select('id, template_id, asset_id, scheduled_date, scheduled_day, status, created_at')
      .order('created_at', { ascending: true })

    if (findError) {
      console.error('Error finding duplicate schedules:', findError)
      return NextResponse.json({ error: findError.message }, { status: 500 })
    }

    // Group schedules by template_id, asset_id, and date
    const groupedSchedules: { [key: string]: typeof duplicateSchedules } = {}
    const schedulesByDay: { [key: string]: typeof duplicateSchedules } = {}

    duplicateSchedules?.forEach(schedule => {
      const key = `${schedule.template_id}-${schedule.asset_id}-${(schedule as any).scheduled_day || schedule.scheduled_date?.split('T')[0]}`
      if (!groupedSchedules[key]) {
        groupedSchedules[key] = []
      }
      groupedSchedules[key].push(schedule)

      // Also group by day to check for same-day schedules
      const dayKey = `${schedule.asset_id}-${(schedule as any).scheduled_day || schedule.scheduled_date?.split('T')[0]}`
      if (!schedulesByDay[dayKey]) {
        schedulesByDay[dayKey] = []
      }
      schedulesByDay[dayKey].push(schedule)
    })

    const duplicatesToDelete: string[] = []
    let duplicateCount = 0

    // Find exact duplicates (same template, asset, and date)
    Object.values(groupedSchedules).forEach(group => {
      if (group.length > 1) {
        // Keep the oldest one (first created), delete the rest
        const sortedGroup = group.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        
        // Skip the first one (keep it), delete the rest
        sortedGroup.slice(1).forEach(schedule => {
          // Only delete if not completed
          if (schedule.status !== 'completado') {
            duplicatesToDelete.push(schedule.id)
            duplicateCount++
          }
        })
      }
    })

    // Find same-day schedules for same asset (potential duplicates from different sources)
    Object.values(schedulesByDay).forEach(group => {
      if (group.length > 1) {
        // Group by template_id to handle multiple different checklists on same day
        const byTemplate: { [key: string]: typeof group } = {}
        group.forEach(schedule => {
          if (!byTemplate[schedule.template_id]) {
            byTemplate[schedule.template_id] = []
          }
          byTemplate[schedule.template_id].push(schedule)
        })

        // For each template, if there are multiple schedules on same day, keep only the oldest
        Object.values(byTemplate).forEach(templateGroup => {
          if (templateGroup.length > 1) {
            const sortedTemplateGroup = templateGroup.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            
            // Skip the first one (keep it), delete the rest if not already marked and not completed
            sortedTemplateGroup.slice(1).forEach(schedule => {
              if (schedule.status !== 'completado' && !duplicatesToDelete.includes(schedule.id)) {
                duplicatesToDelete.push(schedule.id)
                duplicateCount++
              }
            })
          }
        })
      }
    })

    // Delete the duplicate schedules
    if (duplicatesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('checklist_schedules')
        .delete()
        .in('id', duplicatesToDelete)

      if (deleteError) {
        console.error('Error deleting duplicate schedules:', deleteError)
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Limpieza de schedules completada',
      stats: {
        before: {
          total: totalBefore,
          todayAndNext3Days,
          futureSchedules,
          withMaintenancePlan,
          excessiveGroups: Array.from(scheduleGroups.entries())
            .filter(([_, schedules]) => schedules.length > 5).length
        },
        after: {
          total: totalAfter,
          deleted: deletedCount,
          deletedExcessive,
          deletedFuture: deletedSchedules?.length || 0,
          orphanedIssuesDeleted: orphanedCount
        },
        summary: `Se eliminaron ${deletedCount} schedules automáticos (${deletedExcessive} excesivos, ${deletedSchedules?.length || 0} futuros). ${orphanedCount} problemas huérfanos eliminados. Schedules restantes: ${totalAfter}`
      },
      duplicateCount: duplicateCount,
      deletedIds: duplicatesToDelete
    })

  } catch (error: any) {
    console.error('Error cleaning up schedules:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
} 