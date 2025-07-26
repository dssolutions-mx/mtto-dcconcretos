import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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
      operator_id,
      from_asset_id,
      to_asset_id,
      assignment_type = 'primary',
      transfer_reason,
      force_transfer = false
    } = body

    // Validate required fields
    if (!operator_id || !to_asset_id) {
      return NextResponse.json({ 
        error: 'Operator ID and target Asset ID are required' 
      }, { status: 400 })
    }

    // Check if operator exists and is active
    const { data: operator, error: operatorError } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, status')
      .eq('id', operator_id)
      .eq('status', 'active')
      .single()

    if (operatorError || !operator) {
      return NextResponse.json({ 
        error: 'Operator not found or inactive' 
      }, { status: 404 })
    }

    // Check if target asset exists
    const { data: targetAsset, error: assetError } = await supabase
      .from('assets')
      .select('id, name, asset_id, status')
      .eq('id', to_asset_id)
      .single()

    if (assetError || !targetAsset) {
      return NextResponse.json({ 
        error: 'Target asset not found' 
      }, { status: 404 })
    }

    // Find current active assignments for the operator
    const { data: currentAssignments, error: currentAssignmentError } = await supabase
      .from('asset_operators')
      .select(`
        id,
        asset_id,
        assignment_type,
        assets:asset_id(id, name, asset_id)
      `)
      .eq('operator_id', operator_id)
      .eq('status', 'active')

    if (currentAssignmentError) {
      console.error('Error fetching current assignments:', currentAssignmentError)
      return NextResponse.json({ 
        error: 'Error checking current assignments' 
      }, { status: 500 })
    }

    // Check if operator is already assigned to target asset
    const existingTargetAssignment = currentAssignments?.find(a => a.asset_id === to_asset_id)
    if (existingTargetAssignment) {
      return NextResponse.json({ 
        error: 'Operator is already assigned to this asset',
        current_assignment: existingTargetAssignment
      }, { status: 400 })
    }

    // Check if target asset already has a primary operator (if trying to assign as primary)
    if (assignment_type === 'primary') {
      const { data: existingPrimary, error: primaryError } = await supabase
        .from('asset_operators')
        .select(`
          id,
          operator_id,
          profiles:operator_id(nombre, apellido)
        `)
        .eq('asset_id', to_asset_id)
        .eq('assignment_type', 'primary')
        .eq('status', 'active')
        .single()

      if (primaryError && primaryError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking existing primary operator:', primaryError)
        return NextResponse.json({ 
          error: 'Error checking existing assignments' 
        }, { status: 500 })
      }

      if (existingPrimary && !force_transfer) {
        return NextResponse.json({ 
          error: 'Asset already has a primary operator assigned',
          existing_operator: existingPrimary,
          suggestion: 'Use force_transfer=true to replace, or assign as secondary'
        }, { status: 409 })
      }

      // If force_transfer is true and there's an existing primary, we'll handle it in the transaction
    }

    // Start atomic transaction for the transfer
    const { data: transferResult, error: transferError } = await supabase.rpc('transfer_operator_assignment', {
      p_operator_id: operator_id,
      p_to_asset_id: to_asset_id,
      p_user_id: user.id,
      p_from_asset_id: from_asset_id || null,
      p_assignment_type: assignment_type,
      p_transfer_reason: transfer_reason || 'Transfer via drag and drop',
      p_force_transfer: force_transfer
    })

    if (transferError) {
      console.error('Error in transfer operation:', transferError)
      
      // Handle specific database errors
      if (transferError.message?.includes('already assigned')) {
        return NextResponse.json({ 
          error: 'Operator is already assigned to this asset' 
        }, { status: 400 })
      }
      
      if (transferError.message?.includes('primary operator exists')) {
        return NextResponse.json({ 
          error: 'Asset already has a primary operator. Use force_transfer to replace.' 
        }, { status: 409 })
      }

      return NextResponse.json({ 
        error: 'Error during transfer operation',
        details: transferError.message 
      }, { status: 500 })
    }

    // If we reach here, the transfer was successful
    const result = transferResult || {}

    return NextResponse.json({
      message: 'Operator transfer completed successfully',
      operator: {
        id: operator.id,
        name: `${operator.nombre} ${operator.apellido}`
      },
      target_asset: {
        id: targetAsset.id,
        name: targetAsset.name,
        asset_id: targetAsset.asset_id
      },
      assignment_type,
      assignments_removed: result.removed_assignments || 0,
      assignments_created: result.created_assignments || 0,
      transfer_id: result.transfer_id
    }, { status: 200 })

  } catch (error) {
    console.error('Error in asset-operators transfer:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 