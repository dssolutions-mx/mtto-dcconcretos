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

    // Use the optimized view we created
    let query = supabase
      .from('asset_operators_full')
      .select('*')
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
      
      // Fallback to basic query if view fails
      let fallbackQuery = supabase
        .from('asset_operators')
        .select(`
          id,
          asset_id,
          operator_id,
          assignment_type,
          start_date,
          end_date,
          status,
          notes,
          assigned_by,
          created_at,
          updated_at,
          created_by,
          updated_by
        `)
        .eq('status', status)

      if (assetId) {
        fallbackQuery = fallbackQuery.eq('asset_id', assetId)
      }

      if (operatorId) {
        fallbackQuery = fallbackQuery.eq('operator_id', operatorId)
      }

      const { data: fallbackAssignments, error: fallbackError } = await fallbackQuery.order('created_at', { ascending: false })

      if (fallbackError) {
        console.error('Fallback query also failed:', fallbackError)
        return NextResponse.json({ error: 'Error fetching assignments' }, { status: 500 })
      }

      return NextResponse.json(fallbackAssignments || [])
    }

    return NextResponse.json(assignments || [])
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
      .select()
      .single()

    if (error) {
      console.error('Error creating asset operator assignment:', error)
      return NextResponse.json({ error: 'Error creating assignment' }, { status: 500 })
    }

    // If this is a primary operator assignment, update the asset status to 'active'
    if (assignment_type === 'primary') {
      const { error: assetUpdateError } = await supabase
        .from('assets')
        .update({ 
          status: 'active',
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', asset_id)

      if (assetUpdateError) {
        console.error('Error updating asset status:', assetUpdateError)
        // Don't fail the assignment creation, just log the error
      }
    }

    // Fetch the complete assignment with related data
    const { data: completeAssignment, error: fetchError } = await supabase
      .from('asset_operators_full')
      .select('*')
      .eq('id', assignment.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete assignment:', fetchError)
      return NextResponse.json(assignment, { status: 201 })
    }

    return NextResponse.json(completeAssignment, { status: 201 })
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
      .select()
      .single()

    if (error) {
      console.error('Error updating asset operator assignment:', error)
      return NextResponse.json({ error: 'Error updating assignment' }, { status: 500 })
    }

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Fetch the complete assignment with related data
    const { data: completeAssignment, error: fetchError } = await supabase
      .from('asset_operators_full')
      .select('*')
      .eq('id', assignment.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete assignment:', fetchError)
      return NextResponse.json(assignment)
    }

    return NextResponse.json(completeAssignment)
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

    // First, get the assignment details before deleting
    const { data: assignmentToDelete, error: fetchError } = await supabase
      .from('asset_operators')
      .select('asset_id, assignment_type')
      .eq('id', id)
      .single()

    if (fetchError || !assignmentToDelete) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // Soft delete by setting status to 'inactive' and end_date
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

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
    }

    // If we deleted a primary operator, check if there are any remaining primary operators
    if (assignmentToDelete.assignment_type === 'primary') {
      const { data: remainingPrimary } = await supabase
        .from('asset_operators')
        .select('id')
        .eq('asset_id', assignmentToDelete.asset_id)
        .eq('assignment_type', 'primary')
        .eq('status', 'active')
        .single()

      // If no primary operators remain, set asset status to 'inactive'
      if (!remainingPrimary) {
        const { error: assetUpdateError } = await supabase
          .from('assets')
          .update({ 
            status: 'inactive',
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', assignmentToDelete.asset_id)

        if (assetUpdateError) {
          console.error('Error updating asset status:', assetUpdateError)
          // Don't fail the deletion, just log the error
        }
      }
    }

    return NextResponse.json({ message: 'Assignment deleted successfully' })
  } catch (error) {
    console.error('Error in asset-operators DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 