import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    console.log('📊 Fetching asset checklist dashboard data...')
    
    const supabase = await createClient()
    
    // Test connection with a simple query first
    const connectionTest = await supabase.from('assets').select('count').limit(1).single()
    
    if (connectionTest.error) {
      // Check if this is a network/connectivity error
      const isNetworkError = 
        connectionTest.error.message?.includes('fetch') ||
        connectionTest.error.message?.includes('network') ||
        connectionTest.error.message?.includes('timeout') ||
        connectionTest.error.code === 'ENOTFOUND' ||
        connectionTest.error.code === 'ECONNREFUSED'
      
      if (isNetworkError) {
        console.log('🌐 Network connectivity issue detected in API')
        return NextResponse.json({ 
          error: 'NETWORK_ERROR',
          message: 'No network connectivity',
          offline: true,
          hint: 'Switch to offline mode'
        }, { status: 503 }) // Service Unavailable
      }
    }

    // Proceed with normal queries if connection is good
    const [assetsResult, pendingResult, completedResult] = await Promise.all([
      // Get all assets with organizational structure
      supabase
        .from('assets')
        .select(`
          id,
          name,
          asset_id,
          location,
          department,
          status,
          current_hours,
          plant_id,
          department_id,
          plants (
            id,
            name,
            code
          ),
          departments (
            id,
            name,
            code
          )
        `)
        .in('status', ['operational', 'maintenance']),
      
      // Get all pending schedules
      supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(name, description)
        `)
        .eq('status', 'pendiente'),
      
      // Get completed schedules for context (last 30 days)
      supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(name, description)
        `)
        .eq('status', 'completado')
        .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ])

    if (assetsResult.error) {
      console.error('Error fetching assets:', assetsResult.error)
      return NextResponse.json({ error: assetsResult.error.message }, { status: 500 })
    }

    if (pendingResult.error) {
      console.error('Error fetching pending schedules:', pendingResult.error)
      return NextResponse.json({ error: pendingResult.error.message }, { status: 500 })
    }

    if (completedResult.error) {
      console.error('Error fetching completed schedules:', completedResult.error)
      return NextResponse.json({ error: completedResult.error.message }, { status: 500 })
    }

    const assets = assetsResult.data || []
    const pendingSchedules = pendingResult.data || []
    const completedSchedules = completedResult.data || []

    // Process data to create asset summaries
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const assetSummaries = assets.map(asset => {
      // Get schedules for this asset
      const assetPendingSchedules = pendingSchedules.filter(schedule => schedule.asset_id === asset.id)
      const assetCompletedSchedules = completedSchedules.filter(schedule => schedule.asset_id === asset.id)

      // Calculate overdue and due soon tasks
      const overdueTasks = assetPendingSchedules.filter(schedule => 
        new Date(schedule.scheduled_date) < today
      )
      const dueTodayTasks = assetPendingSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.scheduled_date)
        scheduleDate.setHours(0, 0, 0, 0)
        return scheduleDate.getTime() === today.getTime()
      })
      const dueSoonTasks = assetPendingSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.scheduled_date)
        const weekFromNow = new Date(today)
        weekFromNow.setDate(weekFromNow.getDate() + 7)
        return scheduleDate > today && scheduleDate <= weekFromNow
      })

      // Determine status
      let checklistStatus = 'ok'
      if (overdueTasks.length > 0) {
        checklistStatus = 'overdue'
      } else if (dueTodayTasks.length > 0 || dueSoonTasks.length > 0) {
        checklistStatus = 'due_soon'
      } else if (assetPendingSchedules.length === 0 && assetCompletedSchedules.length === 0) {
        checklistStatus = 'no_schedule'
      }

      // Get the most recent checklist info
      const lastCompleted = assetCompletedSchedules.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0]
      const nextPending = assetPendingSchedules.sort((a, b) => 
        new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
      )[0]

      return {
        asset: {
          ...asset,
          pending_checklists: assetPendingSchedules.length,
          overdue_checklists: overdueTasks.length,
          last_checklist_date: lastCompleted?.updated_at || null,
          last_checklist_status: lastCompleted ? 'completed' : null,
          next_checklist_date: nextPending?.scheduled_date || null,
          checklist_status: checklistStatus
        },
        pending_schedules: assetPendingSchedules,
        completed_recent: assetCompletedSchedules.slice(0, 3)
      }
    })

    // Sort assets by asset_id (CR-XX format) numerically
    const sortedAssetSummaries = assetSummaries.sort((a, b) => {
      const idA = a.asset.asset_id
      const idB = b.asset.asset_id
      
      // Extract prefix and number for IDs like CR-26, CR-09, etc.
      const matchA = idA.match(/^([A-Z]+)-(\d+)$/)
      const matchB = idB.match(/^([A-Z]+)-(\d+)$/)
      
      if (matchA && matchB) {
        // Both have the CR-XX format
        const prefixA = matchA[1]
        const prefixB = matchB[1]
        const numberA = parseInt(matchA[2], 10)
        const numberB = parseInt(matchB[2], 10)
        
        // First compare prefix (CR vs other prefixes)
        if (prefixA !== prefixB) {
          return prefixA.localeCompare(prefixB)
        }
        
        // Then compare numbers numerically (16 < 21 < 24 < 26)
        return numberA - numberB
      }
      
      // Fallback to string comparison for non-standard formats
      return idA.localeCompare(idB)
    })

    // Get unique departments for filtering from organizational structure
    const departments = [...new Set(
      assets
        .map(asset => (asset as any).departments?.name || asset.department)
        .filter(Boolean)
    )]

    return NextResponse.json({ 
      data: {
        assets: sortedAssetSummaries,
        departments,
        stats: {
          total_assets: assets.length,
          total_pending: pendingSchedules.length,
          total_completed_recent: completedSchedules.length
        }
      }
    })
  } catch (error: any) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 