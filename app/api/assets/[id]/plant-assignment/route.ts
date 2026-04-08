import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { checkAssetOperatorConflicts } from '@/lib/utils/conflict-detection'
import { bundleAssetIdsFromRow } from '@/lib/composite-asset-bundle'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get current user and verify permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update asset assignments
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role, plant_id, business_unit_id')
      .eq('id', user.id)
      .single()

    if (profileError || !currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only certain roles can update asset plant assignments
    const allowedRoles = [
      'GERENCIA_GENERAL',
      'JEFE_UNIDAD_NEGOCIO',
      'JEFE_PLANTA',
      'COORDINADOR_MANTENIMIENTO',
      'GERENTE_MANTENIMIENTO',
    ]
    if (!allowedRoles.includes(currentProfile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions to modify asset assignments' }, { status: 403 })
    }

    // Await params before accessing its properties
    const resolvedParams = await params
    const assetId = resolvedParams.id
    const { plant_id, notes, resolve_conflicts } = await request.json()

    // Get current asset to verify it exists and check current assignment
    const { data: currentAsset, error: assetError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        plant_id,
        is_composite,
        component_assets,
        plants:plant_id(id, name, business_unit_id)
      `)
      .eq('id', assetId)
      .single()

    if (assetError) {
      console.error('Error fetching asset:', assetError)
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Apply role-based restrictions
    if (currentProfile.role === 'JEFE_PLANTA') {
      // JEFE_PLANTA can only move assets within their plant or assign to their plant
      if (currentAsset.plant_id !== currentProfile.plant_id && plant_id !== currentProfile.plant_id) {
        return NextResponse.json({ 
          error: 'Como Jefe de Planta, solo puedes asignar activos a tu planta o mover activos ya asignados a tu planta' 
        }, { status: 403 })
      }
    } else if (
      currentProfile.role === 'COORDINADOR_MANTENIMIENTO' &&
      currentProfile.business_unit_id
    ) {
      // BU-wide reassignment (same rules as Jefe de Unidad de Negocio for this action)
      if (plant_id) {
        const { data: targetPlant } = await supabase
          .from('plants')
          .select('business_unit_id')
          .eq('id', plant_id)
          .single()

        if (targetPlant?.business_unit_id !== currentProfile.business_unit_id) {
          return NextResponse.json({
            error:
              'Como Coordinador de Mantenimiento, solo puedes asignar activos a plantas dentro de tu unidad de negocio',
          }, { status: 403 })
        }
      }

      const assetPlant = Array.isArray(currentAsset.plants) ? currentAsset.plants[0] : currentAsset.plants
      if (assetPlant?.business_unit_id && assetPlant.business_unit_id !== currentProfile.business_unit_id) {
        return NextResponse.json({
          error: 'No puedes modificar activos de otras unidades de negocio',
        }, { status: 403 })
      }
    } else if (
      currentProfile.role === 'COORDINADOR_MANTENIMIENTO' &&
      currentProfile.plant_id
    ) {
      if (currentAsset.plant_id !== currentProfile.plant_id && plant_id !== currentProfile.plant_id) {
        return NextResponse.json({
          error:
            'Como Coordinador de Mantenimiento, solo puedes asignar activos a tu planta o mover activos ya asignados a tu planta',
        }, { status: 403 })
      }
    } else if (currentProfile.role === 'JEFE_UNIDAD_NEGOCIO') {
      // JEFE_UNIDAD_NEGOCIO can only move assets within their business unit
      if (plant_id) {
        const { data: targetPlant } = await supabase
          .from('plants')
          .select('business_unit_id')
          .eq('id', plant_id)
          .single()

        if (targetPlant?.business_unit_id !== currentProfile.business_unit_id) {
          return NextResponse.json({ 
            error: 'Como Jefe de Unidad de Negocio, solo puedes asignar activos a plantas dentro de tu unidad de negocio' 
          }, { status: 403 })
        }
      }

      // Check if current asset is in their business unit
      const assetPlant = Array.isArray(currentAsset.plants) ? currentAsset.plants[0] : currentAsset.plants
      if (assetPlant?.business_unit_id && assetPlant.business_unit_id !== currentProfile.business_unit_id) {
        return NextResponse.json({ 
          error: 'No puedes modificar activos de otras unidades de negocio' 
        }, { status: 403 })
      }
    }

    const bundleAssetIds = bundleAssetIdsFromRow(currentAsset)

    // Check for conflicts with assigned operators (composite + components)
    const conflictCheck = await checkAssetOperatorConflicts(assetId, plant_id || null)
    
    // If conflicts exist and no resolution strategy provided, return conflict information
    if (conflictCheck.conflicts && !resolve_conflicts) {
      return NextResponse.json({
        conflicts: true,
        resolution_required: true,
        affected_operators: conflictCheck.affected_operators,
        canTransfer: conflictCheck.canTransfer,
        requiresUnassign: conflictCheck.requiresUnassign,
        message: 'Asset has assigned operators that may be affected by this move. Please provide a resolution strategy.'
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
        // Unassign all operators from this asset (and from composite components if applicable)
        const { error: unassignError } = await supabase
          .from('asset_operators')
          .update({
            status: 'inactive',
            end_date: new Date().toISOString().split('T')[0],
            updated_by: user.id,
            updated_at: new Date().toISOString(),
            notes: `Unassigned due to asset move to ${plant_id ? 'new plant' : 'unassigned'}`
          })
          .in('asset_id', bundleAssetIds)
          .eq('status', 'active')

        if (unassignError) {
          console.error('Error unassigning operators:', unassignError)
          return NextResponse.json({
            error: 'Failed to unassign operators',
            details: unassignError.message
          }, { status: 500 })
        }
      } else if (resolve_conflicts === 'transfer_operators' && plant_id) {
        // Transfer operators to new plant if possible
        if (!conflictCheck.canTransfer) {
          return NextResponse.json({
            error: 'Cannot transfer operators - some operators are in different business units',
            conflicts: true,
            requiresUnassign: true
          }, { status: 400 })
        }

        // Get new plant's business unit
        const { data: newPlant } = await supabase
          .from('plants')
          .select('business_unit_id')
          .eq('id', plant_id)
          .single()

        if (!newPlant) {
          return NextResponse.json({
            error: 'Target plant not found'
          }, { status: 404 })
        }

        const adminForProfiles = createAdminClient()
        const transferErrors: { operator_id: string; message: string }[] = []

        for (const operator of conflictCheck.affected_operators) {
          if (!operator.plant_id || operator.business_unit_id === newPlant.business_unit_id) {
            const { error: updateOpError } = await adminForProfiles
              .from('profiles')
              .update({
                plant_id: plant_id,
                business_unit_id: newPlant.business_unit_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', operator.id)

            if (updateOpError) {
              console.error(`Error transferring operator ${operator.id}:`, updateOpError)
              transferErrors.push({
                operator_id: operator.id,
                message: updateOpError.message,
              })
            }
          }
        }

        if (transferErrors.length > 0) {
          return NextResponse.json(
            {
              error:
                'No se pudieron actualizar uno o más operadores al mover el activo. Revisa permisos o datos del operador.',
              transfer_errors: transferErrors,
            },
            { status: 500 }
          )
        }
      } else if (resolve_conflicts === 'keep') {
        // Keep assignments but log warning
        console.warn(`Asset ${assetId} moved to plant ${plant_id} with operators that may lose access`)
      }
    }

    // Update the asset's plant assignment using admin client to bypass RLS
    // All permission checks have already been performed above
    const adminClient = createAdminClient()
    const { data: updatedAsset, error: updateError } = await adminClient
      .from('assets')
      .update({
        plant_id: plant_id || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)
      .select(`
        id,
        name,
        asset_id,
        status,
        plant_id,
        plants:plant_id(
          id,
          name,
          code,
          business_unit_id,
          business_units:business_unit_id(id, name, code)
        ),
        equipment_models (
          id,
          name,
          manufacturer
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating asset plant assignment:', updateError)
      return NextResponse.json({ error: 'Error updating asset assignment' }, { status: 500 })
    }

    // Keep component rows in sync when moving a composite (single logical unit)
    const componentOnlyIds = Array.isArray(currentAsset.component_assets)
      ? currentAsset.component_assets.filter((cid: string) => cid && cid !== currentAsset.id)
      : []
    if (currentAsset.is_composite && componentOnlyIds.length > 0) {
      const { error: componentUpdateError } = await adminClient
        .from('assets')
        .update({
          plant_id: plant_id || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .in('id', componentOnlyIds)

      if (componentUpdateError) {
        console.error('Error updating composite component plant assignments:', componentUpdateError)
        return NextResponse.json(
          { error: 'No se pudieron actualizar las plantas de los componentes del activo compuesto' },
          { status: 500 }
        )
      }
    }

    // Log the assignment change for audit trail
    const { error: logError } = await supabase
      .from('asset_assignment_history')
      .insert({
        asset_id: assetId,
        previous_plant_id: currentAsset.plant_id,
        new_plant_id: plant_id,
        changed_by: user.id,
        change_reason: notes || 'Plant assignment updated via drag & drop',
        created_at: new Date().toISOString()
      })

    if (logError) {
      console.warn('Warning: Could not log assignment change:', logError)
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      message: 'Asset plant assignment updated successfully',
      asset: updatedAsset
    })

  } catch (error) {
    console.error('Error in asset plant assignment PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 