import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { checkOperatorAssetConflicts } from '@/lib/utils/conflict-detection'
import {
  loadActorContext,
  canUpdateOperators,
  canUpdateOperatorPlacement,
  canViewOperatorsList,
  checkRHOwnershipAuthority,
  checkScopeOverBusinessUnit,
  managedPlantIdsForProfile,
} from '@/lib/auth/server-authorization'
import {
  operatorRowVisibleToJun,
  operatorRowVisibleToJp,
  validateJunJpPatchPlacement,
} from '@/lib/auth/operator-scope'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const fullUpdate = canUpdateOperators(actor)
    const placementOnly = canUpdateOperatorPlacement(actor) && !fullUpdate
    if (!fullUpdate && !placementOnly) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { id: operatorId } = await params
    const updateData = await request.json()

    const { resolve_conflicts, ...rawFields } = updateData

    // Role, authorization, lifecycle, and audit changes must go through dedicated endpoints.
    const allowedKeys = placementOnly
      ? (['plant_id', 'business_unit_id'] as const)
      : ([
          'nombre',
          'apellido',
          'email',
          'telefono',
          'phone_secondary',
          'employee_code',
          'position',
          'shift',
          'hire_date',
          'plant_id',
          'business_unit_id',
          'notas_rh',
        ] as const)

    const allowed = new Set<string>(allowedKeys as unknown as string[])
    const fieldsToUpdate = Object.fromEntries(
      Object.entries(rawFields).filter(([key]) => allowed.has(key))
    )

    const currentOperator = await supabase
      .from('profiles')
      .select('plant_id, business_unit_id, role')
      .eq('id', operatorId)
      .single()

    if (placementOnly && currentOperator.data) {
      const row = currentOperator.data
      const scopeActor = {
        userId: actor.userId,
        profile: {
          role: actor.profile.role,
          business_unit_id: actor.profile.business_unit_id,
          plant_id: actor.profile.plant_id,
          managed_plant_ids: actor.profile.managed_plant_ids,
        },
      }
      if (actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' && actor.profile.business_unit_id) {
        const { data: buPlants } = await supabase
          .from('plants')
          .select('id')
          .eq('business_unit_id', actor.profile.business_unit_id)
        const plantIdsInBu = (buPlants ?? []).map((p) => p.id)
        if (
          !operatorRowVisibleToJun(
            { plant_id: row.plant_id, business_unit_id: row.business_unit_id },
            actor.profile.business_unit_id,
            plantIdsInBu
          )
        ) {
          return NextResponse.json({ error: 'No puedes editar este perfil' }, { status: 403 })
        }
      } else if (actor.profile.role === 'JEFE_PLANTA') {
        const jpPlants = managedPlantIdsForProfile(actor.profile)
        if (
          jpPlants.length === 0 ||
          !operatorRowVisibleToJp(
            { plant_id: row.plant_id, business_unit_id: row.business_unit_id },
            jpPlants
          )
        ) {
          return NextResponse.json({ error: 'No puedes editar este perfil' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const cur = currentOperator.data
    const mergedPlant =
      'plant_id' in fieldsToUpdate ? (fieldsToUpdate.plant_id as string | null) : cur?.plant_id ?? null
    const mergedBu =
      'business_unit_id' in fieldsToUpdate
        ? (fieldsToUpdate.business_unit_id as string | null)
        : cur?.business_unit_id ?? null

    let plantBuForMerged: string | null = null
    if (mergedPlant) {
      const { data: plRow } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', mergedPlant)
        .single()
      plantBuForMerged = plRow?.business_unit_id ?? null
    }

    if (placementOnly) {
      const validated = validateJunJpPatchPlacement(
        {
          userId: actor.userId,
          profile: {
            role: actor.profile.role,
            business_unit_id: actor.profile.business_unit_id,
            plant_id: actor.profile.plant_id,
            managed_plant_ids: actor.profile.managed_plant_ids,
          },
        },
        mergedPlant,
        mergedBu,
        plantBuForMerged
      )
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 })
      }
      Object.assign(fieldsToUpdate, {
        plant_id: validated.plant_id,
        business_unit_id: validated.business_unit_id,
      })
    }

    // Check for conflicts if plant_id is being changed
    const newPlantId = fieldsToUpdate.plant_id as string | null | undefined

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
            const canMove = checkScopeOverBusinessUnit(
              actor,
              asset.business_unit_id ?? null
            )

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

    if (Object.keys(fieldsToUpdate).length === 0) {
      return NextResponse.json({ error: 'No updatable fields were provided' }, { status: 400 })
    }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const actor = await loadActorContext(supabase, user.id)
    if (!actor) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (!canViewOperatorsList(actor)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
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

    const rhOrGg =
      checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
    if (!rhOrGg && operator) {
      if (actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' && actor.profile.business_unit_id) {
        const { data: buPlants } = await supabase
          .from('plants')
          .select('id')
          .eq('business_unit_id', actor.profile.business_unit_id)
        const plantIdsInBu = (buPlants ?? []).map((p) => p.id)
        if (
          !operatorRowVisibleToJun(
            {
              plant_id: operator.plant_id,
              business_unit_id: operator.business_unit_id,
            },
            actor.profile.business_unit_id,
            plantIdsInBu
          )
        ) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
      } else if (actor.profile.role === 'JEFE_PLANTA') {
        const jpPlants = managedPlantIdsForProfile(actor.profile)
        if (
          jpPlants.length === 0 ||
          !operatorRowVisibleToJp(
            {
              plant_id: operator.plant_id,
              business_unit_id: operator.business_unit_id,
            },
            jpPlants
          )
        ) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
      } else if (actor.profile.role === 'DOSIFICADOR' && actor.profile.plant_id) {
        if (
          !operatorRowVisibleToJp(
            {
              plant_id: operator.plant_id,
              business_unit_id: operator.business_unit_id,
            },
            [actor.profile.plant_id]
          )
        ) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
      }
    }

    return NextResponse.json(operator)

  } catch (error) {
    console.error('Error in operators GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 