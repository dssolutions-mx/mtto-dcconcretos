import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import {
  filterSchedulesForActor,
  loadOperatorExpandedAssignedAssetIds,
  type ScheduleVisibilityAsset,
} from '@/lib/checklist/schedule-visibility'
import { categorizeSchedulesByDate } from '@/lib/utils/date-utils'
import {
  expandPerAssignmentAssetScopes,
  findAssignmentForScheduleAsset,
} from '@/lib/composite-operator-scope'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!['OPERADOR', 'DOSIFICADOR'].includes(actor.profile.role)) {
      return NextResponse.json({ error: 'Access denied. Only operators can use this endpoint.' }, { status: 403 })
    }

    const { data: profileDetails } = await supabase
      .from('profiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    // Get assets assigned to this operator
    const { data: assignedAssets, error: assignmentsError } = await supabase
      .from('asset_operators')
      .select(`
        asset_id,
        assignment_type,
        start_date,
        assets (
          id,
          name,
          asset_id,
          location,
          status,
          current_hours,
          plants (
            id,
            name,
            code
          )
        )
      `)
      .eq('operator_id', user.id)
      .eq('status', 'active')

    if (assignmentsError) {
      console.error('Error fetching operator assignments:', assignmentsError)
      return NextResponse.json({ error: 'Error fetching assignments' }, { status: 500 })
    }

    if (!assignedAssets || assignedAssets.length === 0) {
      return NextResponse.json({ 
        data: {
          operator: {
            id: actor.profile.id,
            nombre: profileDetails?.nombre ?? null,
            apellido: profileDetails?.apellido ?? null,
            role: actor.profile.role,
            plant_id: actor.profile.plant_id,
          },
          assigned_assets: [],
          today_checklists: [],
          overdue_checklists: [],
          upcoming_checklists: [],
          stats: {
            total_assets: 0,
            today_checklists: 0,
            overdue_checklists: 0,
            upcoming_checklists: 0
          }
        },
        message: 'No assets assigned to this operator'
      })
    }

    // Extract asset IDs from assignments (expand composite → components for schedules)
    const assignedAssetIds = assignedAssets.map(assignment => assignment.asset_id)
    const assignmentScopes = await expandPerAssignmentAssetScopes(supabase, assignedAssetIds)
    const scheduleAssetIds = [
      ...new Set([].concat(...[...assignmentScopes.values()])),
    ]
    const scheduleAssetFilter =
      scheduleAssetIds.length > 0 ? scheduleAssetIds : assignedAssetIds

    // Get all checklist schedules for assigned assets
    const { data: allSchedules, error: schedulesError } = await supabase
      .from('checklist_schedules')
      .select(`
        *,
        checklists (
          id,
          name,
          description,
          frequency,
          executor_roles
        ),
        assets (
          id,
          name,
          asset_id,
          location,
          plant_id,
          model_id,
          equipment_models ( maintenance_unit )
        )
      `)
      .in('asset_id', scheduleAssetFilter)
      .eq('status', 'pendiente')
      .order('scheduled_day', { ascending: true })

    if (schedulesError) {
      console.error('Error fetching operator schedules:', schedulesError)
      return NextResponse.json({ error: 'Error fetching schedules' }, { status: 500 })
    }

    const assignedAssetIdSet = await loadOperatorExpandedAssignedAssetIds(supabase, user.id)

    const assetById = new Map<string, ScheduleVisibilityAsset>()
    for (const row of allSchedules ?? []) {
      const asset = row.assets as ScheduleVisibilityAsset | null
      if (asset?.id) assetById.set(row.asset_id, asset)
    }

    const visibleSchedules = filterSchedulesForActor(
      allSchedules || [],
      actor,
      assetById,
      assignedAssetIdSet
    )

    // Process schedules by date categories using UTC-based date comparison
    const categorizedSchedules = categorizeSchedulesByDate(visibleSchedules)
    
    const todayChecklists = categorizedSchedules.today
    const overdueChecklists = categorizedSchedules.overdue  
    const upcomingChecklists = [...categorizedSchedules.upcoming, ...categorizedSchedules.future]

    const normalizeNestedAsset = (row: unknown) => {
      if (!row || typeof row !== 'object') return null
      const a = row as { id?: string; name?: string | null; asset_id?: string | null }
      return a.id ? a : null
    }

    // Match component schedules to composite assignment; expose part (schedule.assets) vs unit (assignment.assets)
    const addAssignmentInfo = (schedules: any[]) => {
      return schedules.map((schedule) => {
        const assignment = findAssignmentForScheduleAsset(
          schedule.asset_id,
          assignedAssets,
          assignmentScopes
        )
        const rawAssets = schedule.assets
        const partAsset = normalizeNestedAsset(
          Array.isArray(rawAssets) ? rawAssets[0] : rawAssets
        )
        const rawAssigned = assignment?.assets
        const unitAsset = normalizeNestedAsset(
          Array.isArray(rawAssigned) ? rawAssigned[0] : rawAssigned
        )
        return {
          ...schedule,
          assets: partAsset ?? schedule.assets,
          assigned_asset: unitAsset ?? undefined,
          assignment_type: assignment?.assignment_type || 'unknown',
          assignment_start_date: assignment?.start_date,
        }
      })
    }

    const processedData = {
      operator: {
        id: actor.profile.id,
        nombre: profileDetails?.nombre ?? null,
        apellido: profileDetails?.apellido ?? null,
        role: actor.profile.role,
        plant_id: actor.profile.plant_id,
      },
      assigned_assets: assignedAssets.map(a => ({
        ...a.assets,
        assignment_type: a.assignment_type,
        assignment_start_date: a.start_date
      })),
      today_checklists: addAssignmentInfo(todayChecklists),
      overdue_checklists: addAssignmentInfo(overdueChecklists),
      upcoming_checklists: addAssignmentInfo(upcomingChecklists),
      stats: {
        total_assets: assignedAssets.length,
        today_checklists: todayChecklists.length,
        overdue_checklists: overdueChecklists.length,
        upcoming_checklists: upcomingChecklists.length,
        total_checklists: visibleSchedules.length
      }
    }

    return NextResponse.json({ data: processedData })

  } catch (error) {
    console.error('Error in operator-dashboard GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 