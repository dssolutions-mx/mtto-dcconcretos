import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

    // Get user profile to verify they are an operator
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only allow OPERADOR and DOSIFICADOR roles
    if (!['OPERADOR', 'DOSIFICADOR'].includes(profile.role)) {
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

    // Extract asset IDs from assignments
    const assignedAssetIds = assignedAssets.map(assignment => assignment.asset_id)

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
          equipment_models (name, manufacturer)
        ),
        assets (
          id,
          name,
          asset_id,
          location,
          status
        )
      `)
      .in('asset_id', assignedAssetIds)

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

    // Filter by type/frequency if specified
    let filteredSchedules = schedules || []
    if (type && filteredSchedules.length > 0) {
      filteredSchedules = filteredSchedules.filter(schedule => 
        schedule.checklists?.frequency === type
      )
    }

    // Add assignment type information to each schedule
    const schedulesWithAssignmentInfo = filteredSchedules.map(schedule => {
      const assignment = assignedAssets.find(a => a.asset_id === schedule.asset_id)
      return {
        ...schedule,
        assignment_type: assignment?.assignment_type || 'unknown',
        assigned_asset: assignment?.assets
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