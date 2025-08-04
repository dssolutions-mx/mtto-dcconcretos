import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { categorizeSchedulesByDate } from '@/lib/utils/date-utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to verify they are an operator
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, plant_id, nombre, apellido')
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
          operator: profile,
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

    // Extract asset IDs from assignments
    const assignedAssetIds = assignedAssets.map(assignment => assignment.asset_id)

    // Get all checklist schedules for assigned assets
    const { data: allSchedules, error: schedulesError } = await supabase
      .from('checklist_schedules')
      .select(`
        *,
        checklists (
          id,
          name,
          description,
          frequency
        ),
        assets (
          id,
          name,
          asset_id,
          location
        )
      `)
      .in('asset_id', assignedAssetIds)
      .eq('status', 'pendiente')
      .order('scheduled_date', { ascending: true })

    if (schedulesError) {
      console.error('Error fetching operator schedules:', schedulesError)
      return NextResponse.json({ error: 'Error fetching schedules' }, { status: 500 })
    }

    // Process schedules by date categories using UTC-based date comparison
    // This ensures consistency with the asset detail pages
    const categorizedSchedules = categorizeSchedulesByDate(allSchedules || [])
    
    const todayChecklists = categorizedSchedules.today
    const overdueChecklists = categorizedSchedules.overdue  
    const upcomingChecklists = [...categorizedSchedules.upcoming, ...categorizedSchedules.future]

    // Add assignment information to each schedule
    const addAssignmentInfo = (schedules: any[]) => {
      return schedules.map(schedule => {
        const assignment = assignedAssets.find(a => a.asset_id === schedule.asset_id)
        return {
          ...schedule,
          assignment_type: assignment?.assignment_type || 'unknown',
          assignment_start_date: assignment?.start_date
        }
      })
    }

    const processedData = {
      operator: {
        id: profile.id,
        nombre: profile.nombre,
        apellido: profile.apellido,
        role: profile.role,
        plant_id: profile.plant_id
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
        total_checklists: allSchedules?.length || 0
      }
    }

    return NextResponse.json({ data: processedData })

  } catch (error) {
    console.error('Error in operator-dashboard GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 