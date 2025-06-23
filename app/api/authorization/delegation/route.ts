import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET - Fetch delegations (with filtering options)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('user_id')
    const type = searchParams.get('type') // 'granted', 'received', 'all'
    const businessUnitId = searchParams.get('business_unit_id')
    const plantId = searchParams.get('plant_id')
    const isActive = searchParams.get('is_active') !== 'false'

    let query = supabase
      .from('delegation_details')
      .select('*')
      .eq('is_active', isActive)
      .order('created_at', { ascending: false })

    // Apply filters based on type
    if (userId && type) {
      if (type === 'granted') {
        query = query.eq('grantor_id', userId)
      } else if (type === 'received') {
        query = query.eq('grantee_id', userId)
      } else if (type === 'all') {
        query = query.or(`grantor_id.eq.${userId},grantee_id.eq.${userId}`)
      }
    }

    // Additional scope filters
    if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId)
    }
    if (plantId) {
      query = query.eq('plant_id', plantId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching delegations:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ delegations: data || [] })

  } catch (error) {
    console.error('Unexpected error in GET /api/authorization/delegation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new delegation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      grantee_user_id,
      delegated_amount,
      business_unit_id,
      plant_id,
      scope_type = 'global',
      notes
    } = body

    // Get current user (grantor)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Convert empty strings to null for UUID fields
    const businessUnitId = business_unit_id && business_unit_id.trim() !== '' && business_unit_id !== 'unassigned' ? business_unit_id : null
    const plantId = plant_id && plant_id.trim() !== '' && plant_id !== 'unassigned' ? plant_id : null

    // Validate delegation using our database function
    const { data: validationResult, error: validationError } = await supabase
      .rpc('can_user_delegate', {
        p_grantor_id: user.id,
        p_grantee_id: grantee_user_id,
        p_amount: delegated_amount,
        p_business_unit_id: businessUnitId,
        p_plant_id: plantId
      })

    if (validationError) {
      console.error('Validation error:', validationError)
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }

    if (!validationResult) {
      return NextResponse.json({ 
        error: 'Cannot delegate this amount. Check available delegation capacity.' 
      }, { status: 400 })
    }

    // Create the delegation
    const { data: delegation, error: createError } = await supabase
      .from('authorization_delegations')
      .insert({
        grantor_user_id: user.id,
        grantee_user_id,
        delegated_amount,
        business_unit_id: businessUnitId,
        plant_id: plantId,
        scope_type,
        notes
      })
      .select('*')
      .single()

    if (createError) {
      console.error('Error creating delegation:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Log the delegation in history
    await supabase
      .from('authorization_delegation_history')
      .insert({
        delegation_id: delegation.id,
        action: 'created',
        new_amount: delegated_amount,
        changed_by_user_id: user.id,
        change_reason: 'Initial delegation'
      })

    return NextResponse.json({ 
      success: true, 
      delegation,
      message: 'Delegation created successfully' 
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/authorization/delegation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update existing delegation
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      delegation_id,
      delegated_amount,
      notes,
      is_active
    } = body

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get existing delegation to verify ownership
    const { data: existingDelegation, error: fetchError } = await supabase
      .from('authorization_delegations')
      .select('*')
      .eq('id', delegation_id)
      .eq('grantor_user_id', user.id) // Only grantor can modify
      .single()

    if (fetchError || !existingDelegation) {
      return NextResponse.json({ 
        error: 'Delegation not found or access denied' 
      }, { status: 404 })
    }

    // If changing amount, validate new amount
    if (delegated_amount && delegated_amount !== existingDelegation.delegated_amount) {
      const { data: validationResult, error: validationError } = await supabase
        .rpc('can_user_delegate', {
          p_grantor_id: user.id,
          p_grantee_id: existingDelegation.grantee_user_id,
          p_amount: delegated_amount,
          p_business_unit_id: existingDelegation.business_unit_id,
          p_plant_id: existingDelegation.plant_id
        })

      if (validationError || !validationResult) {
        return NextResponse.json({ 
          error: 'Cannot update to this amount. Check available delegation capacity.' 
        }, { status: 400 })
      }
    }

    // Update the delegation
    const updateData: any = { updated_at: new Date().toISOString() }
    if (delegated_amount !== undefined) updateData.delegated_amount = delegated_amount
    if (notes !== undefined) updateData.notes = notes
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: updatedDelegation, error: updateError } = await supabase
      .from('authorization_delegations')
      .update(updateData)
      .eq('id', delegation_id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating delegation:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Log the change
    const action = is_active === false ? 'revoked' : 'modified'
    await supabase
      .from('authorization_delegation_history')
      .insert({
        delegation_id: delegation_id,
        action,
        previous_amount: existingDelegation.delegated_amount,
        new_amount: delegated_amount || existingDelegation.delegated_amount,
        changed_by_user_id: user.id,
        change_reason: notes || `Delegation ${action}`
      })

    return NextResponse.json({ 
      success: true, 
      delegation: updatedDelegation,
      message: `Delegation ${action} successfully` 
    })

  } catch (error) {
    console.error('Unexpected error in PATCH /api/authorization/delegation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 