import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('asset_id')
    const operatorId = searchParams.get('operator_id')
    const status = searchParams.get('status') || 'active'

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('asset_operators')
      .select(`
        *,
        assets (
          id,
          name,
          model,
          plant_id,
          status,
          plants (
            id,
            name,
            code
          )
        ),
        operators:profiles!asset_operators_operator_id_fkey (
          id,
          nombre,
          apellido,
          role,
          employee_code,
          shift,
          status,
          plants (
            id,
            name,
            code
          )
        )
      `)
      .eq('status', status)

    if (assetId) {
      query = query.eq('asset_id', assetId)
    }

    if (operatorId) {
      query = query.eq('operator_id', operatorId)
    }

    const { data: assignments, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching asset operators:', error)
      return NextResponse.json({ error: 'Error fetching assignments' }, { status: 500 })
    }

    return NextResponse.json(assignments)
  } catch (error) {
    console.error('Error in asset-operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      asset_id,
      operator_id,
      assignment_type = 'primary',
      start_date,
      notes
    } = body

    // Validate required fields
    if (!asset_id || !operator_id) {
      return NextResponse.json({ 
        error: 'Asset ID and Operator ID are required' 
      }, { status: 400 })
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('asset_operators')
      .select('id')
      .eq('asset_id', asset_id)
      .eq('operator_id', operator_id)
      .eq('status', 'active')
      .single()

    if (existingAssignment) {
      return NextResponse.json({ 
        error: 'Operator is already assigned to this asset' 
      }, { status: 400 })
    }

    // If assigning as primary, check if there's already a primary operator
    if (assignment_type === 'primary') {
      const { data: existingPrimary } = await supabase
        .from('asset_operators')
        .select('id')
        .eq('asset_id', asset_id)
        .eq('assignment_type', 'primary')
        .eq('status', 'active')
        .single()

      if (existingPrimary) {
        return NextResponse.json({ 
          error: 'Asset already has a primary operator assigned' 
        }, { status: 400 })
      }
    }

    // Create the assignment
    const { data: assignment, error } = await supabase
      .from('asset_operators')
      .insert({
        asset_id,
        operator_id,
        assignment_type,
        start_date: start_date || new Date().toISOString().split('T')[0],
        notes,
        status: 'active',
        assigned_by: user.id,
        created_by: user.id,
        updated_by: user.id
      })
      .select(`
        *,
        assets (
          id,
          name,
          model,
          plant_id,
          status
        ),
        operators:profiles!asset_operators_operator_id_fkey (
          id,
          nombre,
          apellido,
          role,
          employee_code,
          shift,
          status
        )
      `)
      .single()

    if (error) {
      console.error('Error creating asset operator assignment:', error)
      return NextResponse.json({ error: 'Error creating assignment' }, { status: 500 })
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error in asset-operators POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      id,
      assignment_type,
      end_date,
      notes,
      status
    } = body

    if (!id) {
      return NextResponse.json({ 
        error: 'Assignment ID is required' 
      }, { status: 400 })
    }

    // Update the assignment
    const { data: assignment, error } = await supabase
      .from('asset_operators')
      .update({
        assignment_type,
        end_date,
        notes,
        status,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        assets (
          id,
          name,
          model,
          plant_id,
          status
        ),
        operators:profiles!asset_operators_operator_id_fkey (
          id,
          nombre,
          apellido,
          role,
          employee_code,
          shift,
          status
        )
      `)
      .single()

    if (error) {
      console.error('Error updating asset operator assignment:', error)
      return NextResponse.json({ error: 'Error updating assignment' }, { status: 500 })
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error in asset-operators PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json({ 
        error: 'Assignment ID is required' 
      }, { status: 400 })
    }

    // Soft delete by setting status to inactive and end_date
    const { data: assignment, error } = await supabase
      .from('asset_operators')
      .update({
        status: 'inactive',
        end_date: new Date().toISOString().split('T')[0],
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deleting asset operator assignment:', error)
      return NextResponse.json({ error: 'Error deleting assignment' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Assignment deleted successfully' })
  } catch (error) {
    console.error('Error in asset-operators DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 