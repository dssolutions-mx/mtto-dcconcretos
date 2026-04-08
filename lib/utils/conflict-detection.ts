import { createClient } from '@/lib/supabase-server'
import { getCompositeBundleAssetIds } from '@/lib/composite-asset-bundle'

/** Supabase FK embed may return one object or a single-element array depending on schema/version. */
function unwrapJoinedProfile<T extends { id?: string }>(
  raw: T | T[] | null | undefined
): T | null {
  if (raw == null) return null
  const row = Array.isArray(raw) ? raw[0] : raw
  return row && typeof row === 'object' ? row : null
}

export interface OperatorConflict {
  id: string
  nombre: string
  apellido: string
  employee_code?: string
  plant_id: string | null
  business_unit_id: string | null
  assignment_type: 'primary' | 'secondary'
}

export interface AssetConflict {
  id: string
  asset_id: string
  name: string
  plant_id: string | null
  business_unit_id: string | null
}

export interface AssetOperatorConflictResult {
  conflicts: boolean
  affected_operators: OperatorConflict[]
  canTransfer: boolean
  requiresUnassign: boolean
  resolution_required: boolean
}

export interface OperatorAssetConflictResult {
  conflicts: boolean
  affected_assets: AssetConflict[]
  assets_in_new_plant: AssetConflict[]
  assets_in_other_plants: AssetConflict[]
  resolution_required: boolean
}

/**
 * Check for conflicts when moving an asset to a new plant
 * Returns information about operators currently assigned to the asset
 */
export async function checkAssetOperatorConflicts(
  assetId: string,
  newPlantId: string | null
): Promise<AssetOperatorConflictResult> {
  const supabase = await createClient()

  const bundleAssetIds = await getCompositeBundleAssetIds(supabase, assetId)

  // Active assignments on the composite and any of its components (same logical unit)
  const { data: assignments, error } = await supabase
    .from('asset_operators')
    .select(`
      id,
      operator_id,
      assignment_type,
      operators:operator_id(
        id,
        nombre,
        apellido,
        employee_code,
        plant_id,
        business_unit_id
      )
    `)
    .in('asset_id', bundleAssetIds)
    .eq('status', 'active')

  if (error) {
    console.error('Error checking asset operator conflicts:', error)
    return {
      conflicts: false,
      affected_operators: [],
      canTransfer: false,
      requiresUnassign: false,
      resolution_required: false
    }
  }

  if (!assignments || assignments.length === 0) {
    return {
      conflicts: false,
      affected_operators: [],
      canTransfer: false,
      requiresUnassign: false,
      resolution_required: false
    }
  }

  const dedupeOperators = (ops: OperatorConflict[]): OperatorConflict[] => {
    const byId = new Map<string, OperatorConflict>()
    for (const o of ops) {
      if (!o.id) continue
      const prev = byId.get(o.id)
      if (!prev) {
        byId.set(o.id, o)
        continue
      }
      const rank = (t: string) => (t === 'primary' ? 0 : 1)
      if (rank(o.assignment_type) < rank(prev.assignment_type)) {
        byId.set(o.id, o)
      }
    }
    return [...byId.values()]
  }

  // If asset is being unassigned (newPlantId is null), all operators need to be handled
  if (!newPlantId) {
    return {
      conflicts: true,
      affected_operators: dedupeOperators(
        assignments.map((a) => {
          const op = unwrapJoinedProfile(a.operators as { id: string } | null)
          return {
            id: op?.id || '',
            nombre: (op as { nombre?: string })?.nombre || '',
            apellido: (op as { apellido?: string })?.apellido || '',
            employee_code: (op as { employee_code?: string })?.employee_code || undefined,
            plant_id: (op as { plant_id?: string | null })?.plant_id ?? null,
            business_unit_id: (op as { business_unit_id?: string | null })?.business_unit_id ?? null,
            assignment_type: a.assignment_type as 'primary' | 'secondary',
          }
        })
      ),
      canTransfer: false,
      requiresUnassign: true,
      resolution_required: true
    }
  }

  // Get the new plant's business unit
  const { data: newPlant } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', newPlantId)
    .single()

  const newBusinessUnitId = newPlant?.business_unit_id || null

  // Check which operators are in the new plant or same business unit
  const affectedOperators: OperatorConflict[] = []
  let canTransfer = true
  let requiresUnassign = false

  for (const assignment of assignments) {
    const operator = unwrapJoinedProfile(assignment.operators as { id: string; plant_id?: string | null; business_unit_id?: string | null; nombre?: string; apellido?: string; employee_code?: string } | null)
    if (!operator?.id) continue

    const operatorPlantId = operator.plant_id
    const operatorBusinessUnitId = operator.business_unit_id

    // Operator is in the new plant - no conflict
    if (operatorPlantId === newPlantId) {
      continue
    }

    // Operator is unassigned or in different plant - conflict
    affectedOperators.push({
      id: operator.id,
      nombre: operator.nombre || '',
      apellido: operator.apellido || '',
      employee_code: operator.employee_code,
      plant_id: operatorPlantId,
      business_unit_id: operatorBusinessUnitId,
      assignment_type: assignment.assignment_type as 'primary' | 'secondary'
    })

    // Check if operator can be transferred (same business unit or unassigned)
    if (operatorBusinessUnitId !== newBusinessUnitId && operatorBusinessUnitId !== null) {
      canTransfer = false
      requiresUnassign = true
    }
  }

  const merged = dedupeOperators(affectedOperators)

  return {
    conflicts: merged.length > 0,
    affected_operators: merged,
    canTransfer,
    requiresUnassign,
    resolution_required: merged.length > 0
  }
}

/**
 * Check for conflicts when moving an operator to a new plant
 * Returns information about assets currently assigned to the operator
 */
export async function checkOperatorAssetConflicts(
  operatorId: string,
  newPlantId: string | null
): Promise<OperatorAssetConflictResult> {
  const supabase = await createClient()

  // Get active assignments for this operator
  const { data: assignments, error } = await supabase
    .from('asset_operators')
    .select(`
      id,
      asset_id,
      assignment_type,
      assets:asset_id(
        id,
        asset_id,
        name,
        plant_id,
        plants:plant_id(
          business_unit_id
        )
      )
    `)
    .eq('operator_id', operatorId)
    .eq('status', 'active')

  if (error) {
    console.error('Error checking operator asset conflicts:', error)
    return {
      conflicts: false,
      affected_assets: [],
      assets_in_new_plant: [],
      assets_in_other_plants: [],
      resolution_required: false
    }
  }

  if (!assignments || assignments.length === 0) {
    return {
      conflicts: false,
      affected_assets: [],
      assets_in_new_plant: [],
      assets_in_other_plants: [],
      resolution_required: false
    }
  }

  // If operator is being unassigned (newPlantId is null), all assets need to be handled
  if (!newPlantId) {
    const allAssets = assignments.map((a) => {
      const asset = unwrapJoinedProfile(
        a.assets as {
          id: string
          asset_id?: string
          name?: string
          plant_id?: string | null
          plants?: { business_unit_id?: string | null } | { business_unit_id?: string | null }[] | null
        } | null
      )
      const plantEmbed = asset?.plants
      const plant = Array.isArray(plantEmbed) ? plantEmbed[0] : plantEmbed
      return {
        id: asset?.id || '',
        asset_id: asset?.asset_id || '',
        name: asset?.name || '',
        plant_id: asset?.plant_id ?? null,
        business_unit_id: plant?.business_unit_id ?? null,
      }
    })

    return {
      conflicts: true,
      affected_assets: allAssets,
      assets_in_new_plant: [],
      assets_in_other_plants: allAssets,
      resolution_required: true
    }
  }

  const affectedAssets: AssetConflict[] = []
  const assetsInNewPlant: AssetConflict[] = []
  const assetsInOtherPlants: AssetConflict[] = []

  for (const assignment of assignments) {
    const asset = unwrapJoinedProfile(
      assignment.assets as {
        id: string
        asset_id?: string
        name?: string
        plant_id?: string | null
        plants?: { business_unit_id?: string | null } | { business_unit_id?: string | null }[] | null
      } | null
    )
    if (!asset?.id) continue

    const assetPlantId = asset.plant_id ?? null
    const plantEmbed = asset.plants
    const plant = Array.isArray(plantEmbed) ? plantEmbed[0] : plantEmbed
    const assetBusinessUnitId = plant?.business_unit_id ?? null

    const assetConflict: AssetConflict = {
      id: asset.id,
      asset_id: asset.asset_id || '',
      name: asset.name || '',
      plant_id: assetPlantId,
      business_unit_id: assetBusinessUnitId
    }

    affectedAssets.push(assetConflict)

    // Categorize assets
    if (assetPlantId === newPlantId) {
      assetsInNewPlant.push(assetConflict)
    } else {
      assetsInOtherPlants.push(assetConflict)
    }
  }

  return {
    conflicts: assetsInOtherPlants.length > 0,
    affected_assets: affectedAssets,
    assets_in_new_plant: assetsInNewPlant,
    assets_in_other_plants: assetsInOtherPlants,
    resolution_required: assetsInOtherPlants.length > 0
  }
}

