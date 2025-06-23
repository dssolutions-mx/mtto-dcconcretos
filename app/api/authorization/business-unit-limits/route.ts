import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get business unit limits with business unit info
    const { data: businessUnitLimits, error: limitsError } = await supabase
      .from('business_unit_limits')
      .select(`
        business_unit_id,
        max_authorization_limit,
        notes,
        created_at,
        updated_at,
        business_units!inner (
          id,
          name,
          status
        )
      `)
      .eq('business_units.status', 'active')

    if (limitsError) {
      console.error('Error fetching business unit limits:', limitsError)
      return NextResponse.json({ error: limitsError.message }, { status: 500 })
    }

    // Sort by business unit name
    const sortedLimits = (businessUnitLimits || []).sort((a, b) => {
      const businessUnitA = Array.isArray(a.business_units) ? a.business_units[0] : a.business_units
      const businessUnitB = Array.isArray(b.business_units) ? b.business_units[0] : b.business_units
      const nameA = businessUnitA?.name || ''
      const nameB = businessUnitB?.name || ''
      return nameA.localeCompare(nameB)
    })

    // For each business unit limit, get user count and calculate statistics
    const limitsWithStats = await Promise.all(
      sortedLimits.map(async (limit) => {
        // Get all users in this business unit
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, can_authorize_up_to, role, nombre, apellido')
          .eq('business_unit_id', limit.business_unit_id)

        if (usersError) {
          console.error('Error fetching users for business unit:', usersError)
        }

        const userCount = users?.length || 0
        const maxLimit = parseFloat(limit.max_authorization_limit) || 0
        
        // Calculate how many users are at or near the max limit
        const usersAtMaxLimit = users?.filter(u => 
          (u.can_authorize_up_to || 0) >= maxLimit * 0.8 // 80% or more of max limit
        ).length || 0

        const businessUnit = Array.isArray(limit.business_units) ? limit.business_units[0] : limit.business_units

        return {
          business_unit_id: limit.business_unit_id,
          business_unit_name: businessUnit?.name || 'Unknown',
          max_authorization_limit: maxLimit,
          notes: limit.notes || '',
          last_updated: limit.updated_at || limit.created_at
        }
      })
    )

    return NextResponse.json({ limits: limitsWithStats })

  } catch (error) {
    console.error('Unexpected error in GET /api/authorization/business-unit-limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { business_unit_id, assigned_limit, notes } = body

    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user profile to check permissions
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only GERENCIA_GENERAL can set business unit limits
    if (currentProfile.role !== 'GERENCIA_GENERAL') {
      return NextResponse.json({ 
        error: 'Solo Gerencia General puede configurar límites de unidades de negocio' 
      }, { status: 403 })
    }

    // Validate the limit amount
    if (!assigned_limit || assigned_limit <= 0) {
      return NextResponse.json({ 
        error: 'El límite debe ser mayor a cero' 
      }, { status: 400 })
    }

    // Check if business unit exists
    const { data: businessUnit, error: buError } = await supabase
      .from('business_units')
      .select('id, name')
      .eq('id', business_unit_id)
      .single()

    if (buError || !businessUnit) {
      return NextResponse.json({ error: 'Unidad de negocio no encontrada' }, { status: 404 })
    }

    // Insert or update the business unit limit
    const { data: limitRecord, error: limitError } = await supabase
      .from('business_unit_limits')
      .upsert({
        business_unit_id,
        max_authorization_limit: assigned_limit,
        notes: notes || `Límite máximo de autorización para ${businessUnit.name}`,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
        created_by: user.id // Will be ignored on update due to upsert
      }, {
        onConflict: 'business_unit_id'
      })
      .select('*')
      .single()

    if (limitError) {
      console.error('Error setting business unit limit:', limitError)
      return NextResponse.json({ error: limitError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      limit: limitRecord,
      message: `Límite máximo de $${assigned_limit.toLocaleString('es-MX')} MXN configurado para ${businessUnit.name}` 
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/authorization/business-unit-limits:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 