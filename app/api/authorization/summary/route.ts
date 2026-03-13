import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { loadActorContext, canUpdateUserAuthorization } from '@/lib/auth/server-authorization'

// GET - Fetch authorization summary
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('user_id')
    const businessUnitId = searchParams.get('business_unit_id')
    const plantId = searchParams.get('plant_id')
    const includeSubordinates = searchParams.get('include_subordinates') === 'true'
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Use getUser() only — getSession() is not reliable for server-side verification (ASVS V2)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('Auth error:', userError)
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Session not found or invalid. Please try logging in again.',
        mobileSessionIssue: true
      }, { status: 401 })
    }

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

    const actor = await loadActorContext(supabase, user.id)
    const canManageAuthorization = canUpdateUserAuthorization(actor)
    const effectiveUserId = canManageAuthorization ? userId : user.id

    // If user_id is provided, get specific user summary
    if (effectiveUserId) {
      const { data: userSummary, error: userError } = await supabase
        .from('user_authorization_summary')
        .select('*')
.eq('user_id', effectiveUserId)
        .single()

      if (userError) {
        console.error('Error fetching user summary:', userError)
        return NextResponse.json({ error: userError.message }, { status: 500 })
      }

      // Get effective authorization for specific scopes
      const scopes = []
      
      // Global scope
      const { data: globalAuth, error: globalError } = await supabase
.rpc('get_user_effective_authorization', { p_user_id: effectiveUserId })

      if (!globalError) {
        scopes.push({
          scope_type: 'global',
          effective_authorization: globalAuth,
          available_delegation: await getAvailableDelegation(supabase, effectiveUserId)
        })
      }

      // Business unit scope (if user belongs to one)
      if (userSummary.business_unit_id) {
        const { data: buAuth, error: buError } = await supabase
          .rpc('get_user_effective_authorization', { 
            p_user_id: effectiveUserId,
            p_business_unit_id: userSummary.business_unit_id
          })

        if (!buError) {
          scopes.push({
            scope_type: 'business_unit',
            business_unit_id: userSummary.business_unit_id,
            business_unit_name: userSummary.business_unit_name,
            effective_authorization: buAuth,
            available_delegation: await getAvailableDelegation(supabase, effectiveUserId, userSummary.business_unit_id)
          })
        }
      }

      // Plant scope (if user belongs to one)
      if (userSummary.plant_id) {
        const { data: plantAuth, error: plantError } = await supabase
          .rpc('get_user_effective_authorization', { 
            p_user_id: effectiveUserId,
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
            available_delegation: await getAvailableDelegation(supabase, effectiveUserId, userSummary.business_unit_id, userSummary.plant_id)
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
    if (currentUserProfile.role === 'JEFE_UNIDAD_NEGOCIO' && currentUserProfile.business_unit_id) {
      query = query.eq('business_unit_id', currentUserProfile.business_unit_id)
    } else if (currentUserProfile.role === 'JEFE_PLANTA' && currentUserProfile.plant_id) {
      query = query.eq('plant_id', currentUserProfile.plant_id)
    }
    // GERENCIA_GENERAL, AREA_ADMINISTRATIVA, GERENTE_MANTENIMIENTO: global scope, no filter

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

    // Normalize active users to include is_active: true for downstream logic
    let combined = (organizationSummary || []).map((u: any) => ({ ...u, is_active: true }))

    // Optionally include inactive users (who won't appear in the summary view)
    if (includeInactive) {
      let inactiveQuery = supabase
        .from('profiles')
        .select(`
          id,
          nombre,
          apellido,
          email,
          role,
          business_role,
          business_unit_id,
          plant_id,
          is_active,
          business_units:business_unit_id(id, name),
          plants:plant_id(id, name)
        `)
        .eq('is_active', false)

      if (currentUserProfile.role === 'JEFE_UNIDAD_NEGOCIO' && currentUserProfile.business_unit_id) {
        inactiveQuery = inactiveQuery.eq('business_unit_id', currentUserProfile.business_unit_id)
      } else if (currentUserProfile.role === 'JEFE_PLANTA' && currentUserProfile.plant_id) {
        inactiveQuery = inactiveQuery.eq('plant_id', currentUserProfile.plant_id)
      }

      const { data: inactiveProfiles, error: inactiveError } = await inactiveQuery
      if (!inactiveError && Array.isArray(inactiveProfiles)) {
        const mappedInactive = inactiveProfiles.map((p: any) => ({
          user_id: p.id,
          nombre: p.nombre,
          apellido: p.apellido,
          email: p.email,
          role: p.role,
          business_unit_id: p.business_unit_id,
          business_unit_name: p.business_units?.name || null,
          plant_id: p.plant_id,
          plant_name: p.plants?.name || null,
          effective_global_authorization: 0,
          individual_limit: 0,
          business_unit_max_limit: null,
          is_active: false,
        }))
        combined = [...combined, ...mappedInactive]
      }
    }

    // Deduplicate by user_id, prefer inactive entries when duplicates exist
    const uniqueByUser: Record<string, any> = {}
    for (const u of combined) {
      const key = u.user_id
      const existing = uniqueByUser[key]
      if (!existing) {
        uniqueByUser[key] = u
      } else {
        if (existing.is_active !== false && u.is_active === false) {
          uniqueByUser[key] = u
        }
      }
    }

    let deduped = Object.values(uniqueByUser)

    const profileIds = [...new Set(deduped.map((u: any) => u.user_id || u.id).filter(Boolean))]
    if (profileIds.length > 0) {
      const { data: compatibilityProfiles } = await supabase
        .from('profiles')
        .select('id, business_role, role_scope')
        .in('id', profileIds)

      const compatibilityById = new Map((compatibilityProfiles || []).map((p: any) => [p.id, p]))
      deduped = deduped.map((user: any) => {
        const profile = compatibilityById.get(user.user_id || user.id)
        return profile
          ? { ...user, business_role: profile.business_role ?? null, role_scope: profile.role_scope ?? null }
          : user
      })
    }

    // Group by business unit and plant for hierarchical view
    const groupedSummary = groupByHierarchy(deduped)

    return NextResponse.json({
      organization_summary: groupedSummary,
      total_users: organizationSummary?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/authorization/summary:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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