import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { categorizeSchedulesByDate } from '@/lib/utils/date-utils'
import { expandAssetIdsForOperatorChecklists } from '@/lib/composite-operator-scope'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: assetId } = await params

    const { data: asset, error: assetError } = await supabase
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
        is_composite,
        component_assets,
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
      .single()

    if (assetError) {
      console.error('Error fetching asset:', assetError)
      return NextResponse.json({ error: assetError.message }, { status: 500 })
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const scheduleAssetIds = await expandAssetIdsForOperatorChecklists(supabase, [assetId])
    const filterIds = scheduleAssetIds.length > 0 ? scheduleAssetIds : [assetId]

    const [pendingResult, completedChecklistsResult] = await Promise.all([
      supabase
        .from('checklist_schedules')
        .select(`
          *,
          checklists(
            id,
            name,
            description,
            frequency
          ),
          assets (
            id,
            name,
            asset_id
          )
        `)
        .in('asset_id', filterIds)
        .eq('status', 'pendiente')
        .order('scheduled_day', { ascending: true }),

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
          ),
          assets (
            id,
            name,
            asset_id
          )
        `)
        .in('asset_id', filterIds)
        .order('completion_date', { ascending: false })
        .limit(80),
    ])

    if (pendingResult.error) {
      console.error('Error fetching pending schedules:', pendingResult.error)
      return NextResponse.json({ error: pendingResult.error.message }, { status: 500 })
    }

    if (completedChecklistsResult.error) {
      console.error('Error fetching completed checklists:', completedChecklistsResult.error)
      return NextResponse.json({ error: completedChecklistsResult.error.message }, { status: 500 })
    }

    const normalizeChecklists = (row: any) =>
      Array.isArray(row?.checklists) ? row.checklists[0] : row?.checklists
    const normalizeAssets = (row: any) =>
      Array.isArray(row?.assets) ? row.assets[0] : row?.assets

    const pendingSchedules = (pendingResult.data || []).map((row: any) => ({
      ...row,
      checklists: normalizeChecklists(row),
      assets: normalizeAssets(row),
    }))
    const completedChecklists = (completedChecklistsResult.data || []).map((row: any) => ({
      ...row,
      checklists: normalizeChecklists(row),
      assets: normalizeAssets(row),
    }))

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
    const categorizedSchedules = categorizeSchedulesByDate(pendingSchedules as any)

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