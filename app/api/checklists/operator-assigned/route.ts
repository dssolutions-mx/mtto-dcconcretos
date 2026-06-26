import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext } from '@/lib/auth/server-authorization'
import {
  filterSchedulesForActor,
  loadOperatorExpandedAssignedAssetIds,
  type ScheduleVisibilityAsset,
} from '@/lib/checklist/schedule-visibility'
import {
  expandPerAssignmentAssetScopes,
  findAssignmentForScheduleAsset,
} from '@/lib/composite-operator-scope'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pendiente'
    const type = searchParams.get('type') // daily, weekly, monthly, etc.

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

    // Get assets assigned to this operator
    const { data: assignedAssets, error: assignmentsError } = await supabase
      .from('asset_operators')
      .select(`
        asset_id,
        assignment_type,
        assets (
          id,
          name,
          asset_id,
          location,
          status
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
        data: [],
        message: 'No assets assigned to this operator',
        assigned_assets: []
      })
    }

    // Extract asset IDs from assignments (expand composite → all parts)
    const assignedAssetIds = assignedAssets.map(assignment => assignment.asset_id)
    const assignmentScopes = await expandPerAssignmentAssetScopes(supabase, assignedAssetIds)
    const scheduleAssetIds = [
      ...new Set([].concat(...[...assignmentScopes.values()])),
    ]
    const scheduleAssetFilter =
      scheduleAssetIds.length > 0 ? scheduleAssetIds : assignedAssetIds

    // Get checklists for assigned assets only
    let query = supabase
      .from('checklist_schedules')
      .select(`
        *,
        checklists (
          id,
          name,
          description,
          frequency,
          executor_roles,
          equipment_models (name, manufacturer)
        ),
        assets (
          id,
          name,
          asset_id,
          location,
          status,
          plant_id,
          model_id,
          equipment_models ( maintenance_unit )
        )
      `)
      .in('asset_id', scheduleAssetFilter)

    if (status) {
      query = query.eq('status', status)
    }

    // Order by scheduled_day for pending, by updated_at for completed
    if (status === 'completado') {
      query = query.order('updated_at', { ascending: false })
    } else {
      query = query.order('scheduled_day', { ascending: true })
    }

    const { data: schedules, error: schedulesError } = await query

    if (schedulesError) {
      console.error('Error fetching operator checklists:', schedulesError)
      return NextResponse.json({ error: 'Error fetching checklists' }, { status: 500 })
    }

    const assignedAssetIdSet = await loadOperatorExpandedAssignedAssetIds(supabase, user.id)

    const assetById = new Map<string, ScheduleVisibilityAsset>()
    for (const row of schedules ?? []) {
      const asset = row.assets as ScheduleVisibilityAsset | null
      if (asset?.id) assetById.set(row.asset_id, asset)
    }

    let filteredSchedules = filterSchedulesForActor(
      schedules || [],
      actor,
      assetById,
      assignedAssetIdSet
    )
    if (type && filteredSchedules.length > 0) {
      filteredSchedules = filteredSchedules.filter(schedule => 
        schedule.checklists?.frequency === type
      )
    }

    const normalizeNestedAsset = (row: unknown) => {
      if (!row || typeof row !== 'object') return null
      const a = row as { id?: string; name?: string | null; asset_id?: string | null }
      return a.id ? a : null
    }

    const schedulesWithAssignmentInfo = filteredSchedules.map((schedule) => {
      const assignment = findAssignmentForScheduleAsset(
        schedule.asset_id,
        assignedAssets,
        assignmentScopes
      )
      const rawAssets = (schedule as { assets?: unknown }).assets
      const partAsset = normalizeNestedAsset(
        Array.isArray(rawAssets) ? rawAssets[0] : rawAssets
      )
      const rawAssigned = assignment?.assets
      const unitAsset = normalizeNestedAsset(
        Array.isArray(rawAssigned) ? rawAssigned[0] : rawAssigned
      )
      return {
        ...schedule,
        assets: partAsset ?? (schedule as { assets?: unknown }).assets,
        assignment_type: assignment?.assignment_type || 'unknown',
        assigned_asset: unitAsset ?? undefined,
      }
    })

    return NextResponse.json({
      data: schedulesWithAssignmentInfo,
      assigned_assets: assignedAssets.map(a => a.assets),
      total_assigned_assets: assignedAssets.length,
      total_checklists: schedulesWithAssignmentInfo.length
    })

  } catch (error) {
    console.error('Error in operator-assigned checklists GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 