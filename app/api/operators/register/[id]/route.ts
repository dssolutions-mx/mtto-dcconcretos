import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { checkOperatorAssetConflicts } from '@/lib/utils/conflict-detection'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update operators
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can update operators
    const allowedRoles = ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'ENCARGADO_MANTENIMIENTO']
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: operatorId } = await params
    const updateData = await request.json()

    // Remove fields that shouldn't be updated directly
    const { id, created_at, created_by, updated_by, updated_at, resolve_conflicts, ...allowedFields } = updateData

    // Check for conflicts if plant_id is being changed
    const newPlantId = allowedFields.plant_id
    const currentOperator = await supabase
      .from('profiles')
      .select('plant_id')
      .eq('id', operatorId)
      .single()

    if (newPlantId !== undefined && currentOperator.data?.plant_id !== newPlantId) {
      const conflictCheck = await checkOperatorAssetConflicts(operatorId, newPlantId || null)
      
      // If conflicts exist and no resolution strategy provided, return conflict information
      if (conflictCheck.conflicts && !resolve_conflicts) {
        return NextResponse.json({
          conflicts: true,
          resolution_required: true,
          affected_assets: conflictCheck.affected_assets,
          assets_in_new_plant: conflictCheck.assets_in_new_plant,
          assets_in_other_plants: conflictCheck.assets_in_other_plants,
          message: 'Operator has assigned assets that may be affected by this move. Please provide a resolution strategy.'
        }, { status: 409 }) // 409 Conflict
      }

      // Handle conflict resolution if provided
      if (conflictCheck.conflicts && resolve_conflicts) {
        if (resolve_conflicts === 'cancel') {
          return NextResponse.json({
            error: 'Move cancelled by user',
            conflicts: true
          }, { status: 400 })
        }

        if (resolve_conflicts === 'unassign') {
          // Unassign operator from all assets
          const { error: unassignError } = await supabase
            .from('asset_operators')
            .update({
              status: 'inactive',
              end_date: new Date().toISOString().split('T')[0],
              updated_by: user.id,
              updated_at: new Date().toISOString(),
              notes: `Unassigned due to operator move to ${newPlantId ? 'new plant' : 'unassigned'}`
            })
            .eq('operator_id', operatorId)
            .eq('status', 'active')

          if (unassignError) {
            console.error('Error unassigning operator from assets:', unassignError)
            return NextResponse.json({
              error: 'Failed to unassign operator from assets',
              details: unassignError.message
            }, { status: 500 })
          }
        } else if (resolve_conflicts === 'transfer_assets' && newPlantId) {
          // Transfer assets to new plant if possible
          // Get new plant's business unit
          const { data: newPlant } = await supabase
            .from('plants')
            .select('business_unit_id')
            .eq('id', newPlantId)
            .single()

          if (!newPlant) {
            return NextResponse.json({
              error: 'Target plant not found'
            }, { status: 404 })
          }

          // Move assets that can be moved (check permissions)
          for (const asset of conflictCheck.assets_in_other_plants) {
            // Check if user has permission to move this asset
            const canMove = currentProfile.role === 'GERENCIA_GENERAL' || 
                           (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO' && 
                            asset.business_unit_id === currentProfile.business_unit_id)

            if (canMove) {
              const { error: moveAssetError } = await supabase
                .from('assets')
                .update({
                  plant_id: newPlantId,
                  updated_by: user.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', asset.id)

              if (moveAssetError) {
                console.error(`Error moving asset ${asset.id}:`, moveAssetError)
              }
            }
          }
        }
      }
    }

    // Use only the allowed fields
    const fieldsToUpdate = allowedFields

    // Update the operator
    const { data: operator, error } = await supabase
      .from('profiles')
      .update(fieldsToUpdate)
      .eq('id', operatorId)
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .single()

    if (error) {
      console.error('Error updating operator:', error)
      return NextResponse.json({ error: 'Error updating operator' }, { status: 500 })
    }

    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json(operator)

  } catch (error) {
    console.error('Error in operators PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: operatorId } = await params

    const { data: operator, error } = await supabase
      .from('profiles')
      .select(`
        id,
        nombre,
        apellido,
        email,
        telefono,
        phone_secondary,
        role,
        employee_code,
        position,
        shift,
        hire_date,
        status,
        can_authorize_up_to,
        plant_id,
        business_unit_id,
        plants:plant_id(id, name, code),
        business_units:business_unit_id(id, name)
      `)
      .eq('id', operatorId)
      .single()

    if (error) {
      console.error('Error fetching operator:', error)
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 })
    }

    return NextResponse.json(operator)

  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 