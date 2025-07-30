import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET - Fetch authorization summary
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('user_id')
    const businessUnitId = searchParams.get('business_unit_id')
    const plantId = searchParams.get('plant_id')
    const includeSubordinates = searchParams.get('include_subordinates') === 'true'

    // Enhanced mobile session handling with retry logic
    let user = null
    let userError = null
    
    // First attempt to get user
    const firstAttempt = await supabase.auth.getUser()
    if (firstAttempt.data.user) {
      user = firstAttempt.data.user
    } else if (firstAttempt.error?.message?.includes('Auth session missing')) {
      console.log('🔄 Mobile session recovery: First attempt failed, trying session refresh')
      
      // Try to refresh session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (session?.user && !sessionError) {
        console.log('✅ Mobile session recovery: Session refresh successful')
        user = session.user
      } else {
        console.log('❌ Mobile session recovery: Session refresh failed')
        userError = sessionError || firstAttempt.error
      }
    } else {
      userError = firstAttempt.error
    }

    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Session not found or invalid. Please try logging in again.',
        mobileSessionIssue: true
      }, { status: 401 })
    }

    console.log('Current authenticated user ID:', user.id)

    const { data: currentUserProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*, business_units(name), plants(name)')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      return NextResponse.json({ error: `User profile not found: ${profileError.message}` }, { status: 404 })
    }

    if (!currentUserProfile) {
      console.error('No profile data returned for user:', user.id)
      return NextResponse.json({ error: 'User profile not found - no data returned' }, { status: 404 })
    }

    // If user_id is provided, get specific user summary
    if (userId) {
      const { data: userSummary, error: userError } = await supabase
        .from('user_authorization_summary')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (userError) {
        console.error('Error fetching user summary:', userError)
        return NextResponse.json({ error: userError.message }, { status: 500 })
      }

      // Get effective authorization for specific scopes
      const scopes = []
      
      // Global scope
      const { data: globalAuth, error: globalError } = await supabase
        .rpc('get_user_effective_authorization', { p_user_id: userId })

      if (!globalError) {
        scopes.push({
          scope_type: 'global',
          effective_authorization: globalAuth,
          available_delegation: await getAvailableDelegation(supabase, userId)
        })
      }

      // Business unit scope (if user belongs to one)
      if (userSummary.business_unit_id) {
        const { data: buAuth, error: buError } = await supabase
          .rpc('get_user_effective_authorization', { 
            p_user_id: userId,
            p_business_unit_id: userSummary.business_unit_id
          })

        if (!buError) {
          scopes.push({
            scope_type: 'business_unit',
            business_unit_id: userSummary.business_unit_id,
            business_unit_name: userSummary.business_unit_name,
            effective_authorization: buAuth,
            available_delegation: await getAvailableDelegation(supabase, userId, userSummary.business_unit_id)
          })
        }
      }

      // Plant scope (if user belongs to one)
      if (userSummary.plant_id) {
        const { data: plantAuth, error: plantError } = await supabase
          .rpc('get_user_effective_authorization', { 
            p_user_id: userId,
            p_business_unit_id: userSummary.business_unit_id,
            p_plant_id: userSummary.plant_id
          })

        if (!plantError) {
          scopes.push({
            scope_type: 'plant',
            plant_id: userSummary.plant_id,
            plant_name: userSummary.plant_name,
            business_unit_id: userSummary.business_unit_id,
            business_unit_name: userSummary.business_unit_name,
            effective_authorization: plantAuth,
            available_delegation: await getAvailableDelegation(supabase, userId, userSummary.business_unit_id, userSummary.plant_id)
          })
        }
      }

      return NextResponse.json({
        user_summary: userSummary,
        authorization_scopes: scopes
      })
    }

    // Otherwise, get organizational summary
    let query = supabase
      .from('user_authorization_summary')
      .select('*')
      .order('business_unit_name', { ascending: true })
      .order('plant_name', { ascending: true })
      .order('effective_global_authorization', { ascending: false })

    // Apply scope-based filtering based on current user's role
    console.log('Authorization summary - Current user profile:', {
      role: currentUserProfile.role,
      business_unit_id: currentUserProfile.business_unit_id,
      plant_id: currentUserProfile.plant_id,
      business_unit_name: currentUserProfile.business_units?.name
    })

    if (currentUserProfile.role === 'JEFE_UNIDAD_NEGOCIO' && currentUserProfile.business_unit_id) {
      // JEFE_UNIDAD_NEGOCIO can only see users from their business unit
      console.log('Applying JEFE_UNIDAD_NEGOCIO filter for business unit:', currentUserProfile.business_unit_id)
      query = query.eq('business_unit_id', currentUserProfile.business_unit_id)
    } else if (currentUserProfile.role === 'JEFE_PLANTA' && currentUserProfile.plant_id) {
      // JEFE_PLANTA can only see users from their plant
      console.log('Applying JEFE_PLANTA filter for plant:', currentUserProfile.plant_id)
      query = query.eq('plant_id', currentUserProfile.plant_id)
    } else {
      console.log('No scope filtering applied - user can see all users')
    }
    // GERENCIA_GENERAL and AREA_ADMINISTRATIVA can see all users (no additional filters)

    // Apply additional filters from query parameters
    if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId)
    }
    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    const { data: organizationSummary, error: orgError } = await query

    if (orgError) {
      console.error('Error fetching organization summary:', orgError)
      return NextResponse.json({ error: orgError.message }, { status: 500 })
    }

    console.log('Authorization summary - Fetched users:', {
      total_users: organizationSummary?.length || 0,
      business_units: [...new Set(organizationSummary?.map(u => u.business_unit_name))],
      sample_users: organizationSummary?.slice(0, 3).map(u => ({
        name: `${u.nombre} ${u.apellido}`,
        business_unit: u.business_unit_name,
        role: u.role
      }))
    })

    // Group by business unit and plant for hierarchical view
    const groupedSummary = groupByHierarchy(organizationSummary || [])

    return NextResponse.json({
      organization_summary: groupedSummary,
      total_users: organizationSummary?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/authorization/summary:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to get available delegation amount
async function getAvailableDelegation(
  supabase: any, 
  userId: string, 
  businessUnitId?: string, 
  plantId?: string
): Promise<number> {
  const { data, error } = await supabase
    .rpc('get_user_delegatable_amount', {
      p_user_id: userId,
      p_business_unit_id: businessUnitId || null,
      p_plant_id: plantId || null
    })

  if (error) {
    console.error('Error getting delegatable amount:', error)
    return 0
  }
  
  return data || 0
}

// Helper function to group users by hierarchy
function groupByHierarchy(users: any[]) {
  const businessUnits: { [key: string]: any } = {}

  users.forEach(user => {
    const buId = user.business_unit_id || 'unassigned'
    const buName = user.business_unit_name || 'Sin Unidad de Negocio'

    if (!businessUnits[buId]) {
      businessUnits[buId] = {
        business_unit_id: buId,
        business_unit_name: buName,
        plants: {},
        total_users: 0,
        total_authorization: 0
      }
    }

    const plantId = user.plant_id || 'unassigned'
    const plantName = user.plant_name || 'Sin Planta'

    if (!businessUnits[buId].plants[plantId]) {
      businessUnits[buId].plants[plantId] = {
        plant_id: plantId,
        plant_name: plantName,
        users: [],
        total_users: 0,
        total_authorization: 0
      }
    }

    businessUnits[buId].plants[plantId].users.push(user)
    businessUnits[buId].plants[plantId].total_users++
    businessUnits[buId].plants[plantId].total_authorization += parseFloat(user.effective_global_authorization || 0)

    businessUnits[buId].total_users++
    businessUnits[buId].total_authorization += parseFloat(user.effective_global_authorization || 0)
  })

  // Convert to arrays and sort
  return Object.values(businessUnits).map(bu => ({
    ...bu,
    plants: Object.values(bu.plants).sort((a: any, b: any) => 
      a.plant_name.localeCompare(b.plant_name)
    )
  })).sort((a, b) => a.business_unit_name.localeCompare(b.business_unit_name))
} 