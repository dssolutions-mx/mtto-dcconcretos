import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { categorizeSchedulesByDate } from '@/lib/utils/date-utils'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: assetId } = await params
    
    // Get all data for the asset in parallel
    const [assetResult, pendingResult, completedChecklistsResult] = await Promise.all([
      // Get asset details
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
          model_id,
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
        .eq('id', assetId)
        .single(),
      
      // Get pending schedules for this asset
      supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(
            id,
            name,
            description
          )
        `)
        .eq('asset_id', assetId)
        .eq('status', 'pendiente')
        .order('scheduled_date', { ascending: true }),
      
      // Get completed checklists directly from completed_checklists table
      supabase
        .from('completed_checklists')
        .select(`
          id,
          checklist_id,
          asset_id,
          completed_items,
          technician,
          completion_date,
          created_at,
          status,
          notes,
          checklists(
            id,
            name,
            frequency,
            description
          )
        `)
        .eq('asset_id', assetId)
        .order('completion_date', { ascending: false })
        .limit(10)
    ])

    if (assetResult.error) {
      console.error('Error fetching asset:', assetResult.error)
      return NextResponse.json({ error: assetResult.error.message }, { status: 500 })
    }

    if (!assetResult.data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (pendingResult.error) {
      console.error('Error fetching pending schedules:', pendingResult.error)
      return NextResponse.json({ error: pendingResult.error.message }, { status: 500 })
    }

    if (completedChecklistsResult.error) {
      console.error('Error fetching completed checklists:', completedChecklistsResult.error)
      return NextResponse.json({ error: completedChecklistsResult.error.message }, { status: 500 })
    }

    const asset = assetResult.data
    const pendingSchedules = pendingResult.data || []
    const completedChecklists = completedChecklistsResult.data || []

    // Process completed checklists to enhance with template info
    const enhancedCompletedChecklists = completedChecklists.map(completed => {
      // Calculate summary from completed_items
      let passCount = 0
      let failCount = 0
      let flagCount = 0
      
      if (completed.completed_items && Array.isArray(completed.completed_items)) {
        completed.completed_items.forEach((item: any) => {
          if (item.status === 'pass' || item.pass === true) {
            passCount++
          } else if (item.status === 'fail' || item.pass === false) {
            failCount++
          } else if (item.status === 'flag' || item.flagged === true) {
            flagCount++
          }
        })
      }

      return {
        ...completed,
        summary: {
          total: completed.completed_items?.length || 0,
          pass: passCount,
          fail: failCount,
          flag: flagCount
        }
      }
    })

    // Categorize pending schedules using UTC-based date comparison
    const categorizedSchedules = categorizeSchedulesByDate(pendingSchedules)

    return NextResponse.json({ 
      data: {
        asset,
        pending_schedules: {
          overdue: categorizedSchedules.overdue,
          due_today: categorizedSchedules.today,
          upcoming: categorizedSchedules.upcoming,
          future: categorizedSchedules.future,
          all: pendingSchedules
        },
        completed_checklists: enhancedCompletedChecklists
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