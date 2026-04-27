import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { checkAssetOperatorConflicts } from '@/lib/utils/conflict-detection'
import { bundleAssetIdsFromRow } from '@/lib/composite-asset-bundle'
import { syncAssignedOperatorProfilesToPlant } from '@/lib/assets/align-operator-profile-with-asset-plant'

export { shouldUpdateOperatorProfileForPlantTransfer } from '@/lib/assets/should-update-operator-profile-for-plant-transfer'

/** Matches SSR server client schema generic (differs from plain `createClient<Database>`). */
export type DbClient = SupabaseClient<Database, 'public', any>

export type PlantReassignmentActor = {
  role: string
  plant_id: string | null
  business_unit_id: string | null
  managed_plant_ids?: string[]
}

function actorManagedPlants(actor: PlantReassignmentActor): string[] {
  if (actor.managed_plant_ids && actor.managed_plant_ids.length > 0) {
    return actor.managed_plant_ids
  }
  return actor.plant_id ? [actor.plant_id] : []
}

type CurrentAssetRow = {
  id: string
  name: string
  asset_id: string
  plant_id: string | null
  is_composite: boolean | null
  component_assets: string[] | null
  plants:
    | { id: string; name: string; business_unit_id: string | null }
    | { id: string; name: string; business_unit_id: string | null }[]
    | null
}

export type ResolveConflictsStrategy =
  | 'cancel'
  | 'unassign'
  | 'transfer_operators'
  | 'keep'
  | undefined

export type ExecuteAssetPlantReassignmentParams = {
  supabase: DbClient
  adminClient: DbClient
  userId: string
  actor: PlantReassignmentActor
  assetId: string
  plantId: string | null
  notes: string | null
  resolveConflicts: ResolveConflictsStrategy
  /** When true, conflict response is omitted and operators are transferred automatically if allowed (bulk/API parity with drag-drop retry). */
  autoTransferOperatorsWhenPossible?: boolean
}

export type PlantReassignmentResult =
  | { ok: true; asset: Record<string, unknown> }
  | { ok: false; status: number; body: Record<string, unknown> }

const ALLOWED_ROLES = new Set([
  'GERENCIA_GENERAL',
  'JEFE_UNIDAD_NEGOCIO',
  'JEFE_PLANTA',
  'COORDINADOR_MANTENIMIENTO',
  'GERENTE_MANTENIMIENTO',
])

function unwrapPlant(
  raw: CurrentAssetRow['plants']
): { business_unit_id: string | null } | null {
  if (raw == null) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

async function rolePlantScopeError(
  supabase: DbClient,
  actor: PlantReassignmentActor,
  currentAsset: CurrentAssetRow,
  plantId: string | null
): Promise<PlantReassignmentResult | null> {
  if (actor.role === 'JEFE_PLANTA') {
    const m = actorManagedPlants(actor)
    const currentIn = currentAsset.plant_id != null && m.includes(currentAsset.plant_id)
    const targetIn = plantId != null && m.includes(plantId)
    if (!currentIn && !targetIn) {
      return {
        ok: false,
        status: 403,
        body: {
          error:
            'Como Jefe de Planta, solo puedes asignar activos a una de tus plantas o mover activos ya asignados a una de tus plantas',
        },
      }
    }
  } else if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.business_unit_id) {
    if (plantId) {
      const { data: targetPlant } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', plantId)
        .single()

      if (targetPlant?.business_unit_id !== actor.business_unit_id) {
        return {
          ok: false,
          status: 403,
          body: {
            error:
              'Como Coordinador de Mantenimiento, solo puedes asignar activos a plantas dentro de tu unidad de negocio',
          },
        }
      }
    }

    const assetPlant = unwrapPlant(currentAsset.plants)
    if (assetPlant?.business_unit_id && assetPlant.business_unit_id !== actor.business_unit_id) {
      return {
        ok: false,
        status: 403,
        body: { error: 'No puedes modificar activos de otras unidades de negocio' },
      }
    }
  } else if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.plant_id) {
    if (currentAsset.plant_id !== actor.plant_id && plantId !== actor.plant_id) {
      return {
        ok: false,
        status: 403,
        body: {
          error:
            'Como Coordinador de Mantenimiento, solo puedes asignar activos a tu planta o mover activos ya asignados a tu planta',
        },
      }
    }
  } else if (actor.role === 'JEFE_UNIDAD_NEGOCIO') {
    if (plantId) {
      const { data: targetPlant } = await supabase
        .from('plants')
        .select('business_unit_id')
        .eq('id', plantId)
        .single()

      if (targetPlant?.business_unit_id !== actor.business_unit_id) {
        return {
          ok: false,
          status: 403,
          body: {
            error:
              'Como Jefe de Unidad de Negocio, solo puedes asignar activos a plantas dentro de tu unidad de negocio',
          },
        }
      }
    }

    const assetPlant = unwrapPlant(currentAsset.plants)
    if (assetPlant?.business_unit_id && assetPlant.business_unit_id !== actor.business_unit_id) {
      return {
        ok: false,
        status: 403,
        body: { error: 'No puedes modificar activos de otras unidades de negocio' },
      }
    }
  }
  return null
}

/**
 * Single entry point for changing an asset's plant with operator conflict handling,
 * composite component sync, and assignment history — used by plant-assignment API and fleet bulk.
 */
export async function executeAssetPlantReassignment(
  params: ExecuteAssetPlantReassignmentParams
): Promise<PlantReassignmentResult> {
  const {
    supabase,
    adminClient,
    userId,
    actor,
    assetId,
    plantId,
    notes,
    resolveConflicts,
    autoTransferOperatorsWhenPossible,
  } = params

  if (!ALLOWED_ROLES.has(actor.role)) {
    return { ok: false, status: 403, body: { error: 'Insufficient permissions to modify asset assignments' } }
  }

  const { data: currentAsset, error: assetError } = await supabase
    .from('assets')
    .select(
      `
        id,
        name,
        asset_id,
        plant_id,
        is_composite,
        component_assets,
        plants:plant_id(id, name, business_unit_id)
      `
    )
    .eq('id', assetId)
    .single()

  if (assetError || !currentAsset) {
    console.error('executeAssetPlantReassignment: asset fetch', assetError)
    return { ok: false, status: 404, body: { error: 'Asset not found' } }
  }

  const row = currentAsset as unknown as CurrentAssetRow

  const scopeErr = await rolePlantScopeError(supabase, actor, row, plantId)
  if (scopeErr) return scopeErr

  const bundleAssetIds = bundleAssetIdsFromRow(row)

  let effectiveResolve = resolveConflicts
  const conflictCheck = await checkAssetOperatorConflicts(assetId, plantId)

  if (
    autoTransferOperatorsWhenPossible &&
    conflictCheck.conflicts &&
    conflictCheck.canTransfer &&
    !conflictCheck.requiresUnassign &&
    plantId
  ) {
    effectiveResolve = 'transfer_operators'
  }

  if (conflictCheck.conflicts && !effectiveResolve) {
    return {
      ok: false,
      status: 409,
      body: {
        conflicts: true,
        resolution_required: true,
        affected_operators: conflictCheck.affected_operators,
        canTransfer: conflictCheck.canTransfer,
        requiresUnassign: conflictCheck.requiresUnassign,
        message:
          'Asset has assigned operators that may be affected by this move. Please provide a resolution strategy.',
      },
    }
  }

  if (conflictCheck.conflicts && effectiveResolve) {
    if (effectiveResolve === 'cancel') {
      return {
        ok: false,
        status: 400,
        body: { error: 'Move cancelled by user', conflicts: true },
      }
    }

    if (effectiveResolve === 'unassign') {
      const { error: unassignError } = await supabase
        .from('asset_operators')
        .update({
          status: 'inactive',
          end_date: new Date().toISOString().split('T')[0],
          updated_by: userId,
          updated_at: new Date().toISOString(),
          notes: `Unassigned due to asset move to ${plantId ? 'new plant' : 'unassigned'}`,
        })
        .in('asset_id', bundleAssetIds)
        .eq('status', 'active')

      if (unassignError) {
        console.error('executeAssetPlantReassignment: unassign', unassignError)
        return {
          ok: false,
          status: 500,
          body: { error: 'Failed to unassign operators', details: unassignError.message },
        }
      }
    } else if (effectiveResolve === 'transfer_operators' && plantId) {
      if (!conflictCheck.canTransfer) {
        return {
          ok: false,
          status: 400,
          body: {
            error: 'Cannot transfer operators - some operators are in different business units',
            conflicts: true,
            requiresUnassign: true,
          },
        }
      }
    } else if (effectiveResolve === 'keep') {
      console.warn(
        `Asset ${assetId} moved to plant ${plantId} with operators that may lose access`
      )
    }
  }

  if (plantId) {
    const syncProfiles = await syncAssignedOperatorProfilesToPlant(supabase, adminClient, {
      bundleAssetIds,
      targetPlantId: plantId,
    })
    if (!syncProfiles.ok) {
      return {
        ok: false,
        status: syncProfiles.status,
        body: { error: syncProfiles.error },
      }
    }
  }

  const { data: updatedAsset, error: updateError } = await adminClient
    .from('assets')
    .update({
      plant_id: plantId || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)
    .select(
      `
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
      `
    )
    .single()

  if (updateError) {
    console.error('executeAssetPlantReassignment: asset update', updateError)
    return { ok: false, status: 500, body: { error: 'Error updating asset assignment' } }
  }

  const componentOnlyIds = Array.isArray(row.component_assets)
    ? row.component_assets.filter((cid: string) => cid && cid !== row.id)
    : []
  if (row.is_composite && componentOnlyIds.length > 0) {
    const { error: componentUpdateError } = await adminClient
      .from('assets')
      .update({
        plant_id: plantId || null,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .in('id', componentOnlyIds)

    if (componentUpdateError) {
      console.error('executeAssetPlantReassignment: components', componentUpdateError)
      return {
        ok: false,
        status: 500,
        body: { error: 'No se pudieron actualizar las plantas de los componentes del activo compuesto' },
      }
    }
  }

  const { error: logError } = await supabase.from('asset_assignment_history').insert({
    asset_id: assetId,
    previous_plant_id: row.plant_id,
    new_plant_id: plantId,
    changed_by: userId,
    change_reason: notes || 'Plant assignment updated',
    created_at: new Date().toISOString(),
  })

  if (logError) {
    console.warn('executeAssetPlantReassignment: history log', logError)
  }

  return { ok: true, asset: updatedAsset as Record<string, unknown> }
}
