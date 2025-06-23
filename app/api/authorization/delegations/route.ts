import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { DelegationRequest } from '@/types/authorization'

// GET - Fetch delegations (granted and received)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') // 'granted' or 'received' or 'all'

    let query = supabase
      .from('authorization_delegations')
      .select(`
        *,
        grantor:profiles!grantor_user_id(id, nombre, apellido, role),
        grantee:profiles!grantee_user_id(id, nombre, apellido, role),
        business_unit:business_units(id, name),
        plant:plants(id, name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply user filter
    if (userId) {
      if (type === 'granted') {
        query = query.eq('grantor_user_id', userId)
      } else if (type === 'received') {
        query = query.eq('grantee_user_id', userId)
      } else {
        // Default: show both granted and received
        query = query.or(`grantor_user_id.eq.${userId},grantee_user_id.eq.${userId}`)
      }
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    })

  } catch (error) {
    console.error('Error fetching delegations:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch delegations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new delegation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body: DelegationRequest = await request.json()
    
    if (!body.grantee_user_id || !body.delegated_amount || body.delegated_amount <= 0) {
      return NextResponse.json({ 
        error: 'grantee_user_id and valid delegated_amount are required' 
      }, { status: 400 })
    }

    // Check if user is trying to delegate to themselves
    if (body.grantee_user_id === user.id) {
      return NextResponse.json({ 
        error: 'Cannot delegate authorization to yourself' 
      }, { status: 400 })
    }

    // Get grantor's authorization limit and available delegation amount
    const { data: availableDelegation } = await supabase
      .rpc('get_available_delegation_amount', {
        p_user_id: user.id,
        p_business_unit_id: body.business_unit_id,
        p_plant_id: body.plant_id
      })

    if (!availableDelegation || parseFloat(availableDelegation) < body.delegated_amount) {
      return NextResponse.json({ 
        error: `Insufficient delegation capacity. Available: ${availableDelegation || 0}, Requested: ${body.delegated_amount}` 
      }, { status: 400 })
    }

    // Get the grantor's authorization limit ID
    const { data: authLimit } = await supabase
      .from('authorization_limits')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!authLimit) {
      return NextResponse.json({ 
        error: 'No active authorization limit found for grantor' 
      }, { status: 400 })
    }

    // Check if delegation to this user already exists
    const { data: existingDelegation } = await supabase
      .from('authorization_delegations')
      .select('id, delegated_amount')
      .eq('grantor_user_id', user.id)
      .eq('grantee_user_id', body.grantee_user_id)
      .eq('is_active', true)
      .maybeSingle()

    let result
    if (existingDelegation) {
      // Update existing delegation
      const { data, error } = await supabase
        .from('authorization_delegations')
        .update({
          delegated_amount: body.delegated_amount,
          business_unit_id: body.business_unit_id,
          plant_id: body.plant_id,
          notes: body.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDelegation.id)
        .select(`
          *,
          grantor:profiles!grantor_user_id(id, nombre, apellido),
          grantee:profiles!grantee_user_id(id, nombre, apellido)
        `)

      if (error) throw error
      result = data
    } else {
      // Create new delegation
      const { data, error } = await supabase
        .from('authorization_delegations')
        .insert({
          grantor_user_id: user.id,
          grantee_user_id: body.grantee_user_id,
          original_limit_id: authLimit.id,
          delegated_amount: body.delegated_amount,
          business_unit_id: body.business_unit_id,
          plant_id: body.plant_id,
          notes: body.notes,
          is_active: true
        })
        .select(`
          *,
          grantor:profiles!grantor_user_id(id, nombre, apellido),
          grantee:profiles!grantee_user_id(id, nombre, apellido)
        `)

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      success: true,
      message: existingDelegation ? 'Delegation updated successfully' : 'Delegation created successfully',
      data: result
    })

  } catch (error) {
    console.error('Error creating delegation:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create delegation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Revoke delegation
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const delegationId = searchParams.get('delegation_id')
    const granteeUserId = searchParams.get('grantee_user_id')
    
    if (!delegationId && !granteeUserId) {
      return NextResponse.json({ 
        error: 'delegation_id or grantee_user_id is required' 
      }, { status: 400 })
    }

    let query = supabase
      .from('authorization_delegations')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('grantor_user_id', user.id) // Only allow revoking own delegations
      .eq('is_active', true)

    if (delegationId) {
      query = query.eq('id', delegationId)
    } else if (granteeUserId) {
      query = query.eq('grantee_user_id', granteeUserId)
    }

    const { data, error } = await query.select()

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json({ 
        error: 'Delegation not found or already revoked' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Delegation revoked successfully',
      data: data
    })

  } catch (error) {
    console.error('Error revoking delegation:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to revoke delegation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 