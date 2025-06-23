import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// GET - Check if user can authorize a specific purchase order amount
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const amount = parseFloat(searchParams.get('amount') || '0')
    const businessUnitId = searchParams.get('business_unit_id')
    const plantId = searchParams.get('plant_id')
    const getUserId = searchParams.get('user_id')

    // Get current user if no specific user requested
    let targetUserId = getUserId
    if (!targetUserId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      targetUserId = user.id
    }

    // Check if user can authorize the amount
    const { data: canAuthorize, error: authError } = await supabase
      .rpc('can_user_authorize_purchase_order', {
        p_user_id: targetUserId,
        p_amount: amount,
        p_business_unit_id: businessUnitId,
        p_plant_id: plantId
      })

    if (authError) {
      console.error('Authorization check error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Get user's effective authorization amount
    const { data: effectiveAuth, error: effectiveError } = await supabase
      .rpc('get_user_effective_authorization', {
        p_user_id: targetUserId,
        p_business_unit_id: businessUnitId,
        p_plant_id: plantId
      })

    if (effectiveError) {
      console.error('Effective authorization error:', effectiveError)
      return NextResponse.json({ error: effectiveError.message }, { status: 500 })
    }

    // Get available delegation amount
    const { data: availableDelegation, error: delegationError } = await supabase
      .rpc('get_user_delegatable_amount', {
        p_user_id: targetUserId,
        p_business_unit_id: businessUnitId,
        p_plant_id: plantId
      })

    if (delegationError) {
      console.error('Delegation amount error:', delegationError)
    }

    return NextResponse.json({
      can_authorize: canAuthorize,
      effective_authorization: effectiveAuth || 0,
      available_delegation: availableDelegation || 0,
      amount_requested: amount
    })

  } catch (error) {
    console.error('Unexpected error in GET /api/authorization/purchase-order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Get list of users who can authorize a specific amount
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { amount, business_unit_id, plant_id } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    // Get users who can authorize this amount
    const { data: authorizers, error: authorizersError } = await supabase
      .rpc('get_purchase_order_authorizers', {
        p_amount: amount,
        p_business_unit_id: business_unit_id,
        p_plant_id: plant_id
      })

    if (authorizersError) {
      console.error('Error getting authorizers:', authorizersError)
      return NextResponse.json({ error: authorizersError.message }, { status: 500 })
    }

    // Get suggested approver (lowest authorization that can handle this amount)
    const { data: suggestedApprover, error: approverError } = await supabase
      .rpc('get_purchase_order_approver', {
        p_amount: amount,
        p_business_unit_id: business_unit_id,
        p_plant_id: plant_id
      })

    if (approverError) {
      console.error('Error getting suggested approver:', approverError)
    }

    return NextResponse.json({
      amount,
      authorizers: authorizers || [],
      suggested_approver_id: suggestedApprover,
      total_authorizers: (authorizers || []).length
    })

  } catch (error) {
    console.error('Unexpected error in POST /api/authorization/purchase-order:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 