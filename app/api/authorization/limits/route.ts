import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { AuthorizationConfigUpdate } from '@/types/authorization'

// GET - Fetch all authorization limits (with hierarchy view)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const businessUnitId = searchParams.get('business_unit_id')
    const plantId = searchParams.get('plant_id')

    let query = supabase
      .from('user_authorization_summary')
      .select('*')
      .order('hierarchy_level', { ascending: true })
      .order('user_name', { ascending: true })

    // Apply filters if provided
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    if (businessUnitId) {
      query = query.eq('business_unit_id', businessUnitId)
    }
    
    if (plantId) {
      query = query.eq('plant_id', plantId)
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
    console.error('Error fetching authorization limits:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch authorization limits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create or update authorization limit
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only GERENCIA_GENERAL and AREA_ADMINISTRATIVA can create/update limits
    if (!profile?.role || !['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to manage authorization limits' 
      }, { status: 403 })
    }

    const body: AuthorizationConfigUpdate = await request.json()
    
    if (!body.user_id || !body.new_limit || body.new_limit < 0) {
      return NextResponse.json({ 
        error: 'user_id and valid new_limit are required' 
      }, { status: 400 })
    }

    // Check if limit already exists
    const { data: existingLimit } = await supabase
      .from('authorization_limits')
      .select('id')
      .eq('user_id', body.user_id)
      .eq('is_active', true)
      .maybeSingle()

    let result
    if (existingLimit) {
      // Update existing limit
      const { data, error } = await supabase
        .from('authorization_limits')
        .update({
          max_amount: body.new_limit,
          delegatable_amount: body.new_limit, // Can delegate up to their limit
          business_unit_id: body.business_unit_id,
          plant_id: body.plant_id,
          notes: body.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLimit.id)
        .select()

      if (error) throw error
      result = data
    } else {
      // Create new limit
      const { data, error } = await supabase
        .from('authorization_limits')
        .insert({
          user_id: body.user_id,
          granted_by_user_id: user.id,
          max_amount: body.new_limit,
          delegatable_amount: body.new_limit, // Can delegate up to their limit
          business_unit_id: body.business_unit_id,
          plant_id: body.plant_id,
          notes: body.notes,
          is_active: true
        })
        .select()

      if (error) throw error
      result = data
    }

    return NextResponse.json({
      success: true,
      message: existingLimit ? 'Authorization limit updated successfully' : 'Authorization limit created successfully',
      data: result
    })

  } catch (error) {
    console.error('Error managing authorization limit:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to manage authorization limit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Remove authorization limit
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only GERENCIA_GENERAL and AREA_ADMINISTRATIVA can delete limits
    if (!profile?.role || !['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA'].includes(profile.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to delete authorization limits' 
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'user_id is required' 
      }, { status: 400 })
    }

    // Deactivate the authorization limit instead of hard delete to maintain audit trail
    const { data, error } = await supabase
      .from('authorization_limits')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true)
      .select()

    if (error) throw error

    // Also deactivate any delegations granted by this user
    await supabase
      .from('authorization_delegations')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('grantor_user_id', userId)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      message: 'Authorization limit removed successfully',
      data: data
    })

  } catch (error) {
    console.error('Error removing authorization limit:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to remove authorization limit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 