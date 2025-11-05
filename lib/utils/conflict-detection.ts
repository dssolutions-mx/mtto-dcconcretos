import { createClient } from '@/lib/supabase-server'

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

  // Get active assignments for this asset
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
    .eq('asset_id', assetId)
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

  // If asset is being unassigned (newPlantId is null), all operators need to be handled
  if (!newPlantId) {
    return {
      conflicts: true,
      affected_operators: assignments.map(a => ({
        id: a.operators?.id || '',
        nombre: a.operators?.nombre || '',
        apellido: a.operators?.apellido || '',
        employee_code: a.operators?.employee_code || undefined,
        plant_id: a.operators?.plant_id || null,
        business_unit_id: a.operators?.business_unit_id || null,
        assignment_type: a.assignment_type as 'primary' | 'secondary'
      })),
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
    const operator = assignment.operators as any
    if (!operator) continue

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

  return {
    conflicts: affectedOperators.length > 0,
    affected_operators: affectedOperators,
    canTransfer,
    requiresUnassign,
    resolution_required: affectedOperators.length > 0
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
    const allAssets = assignments.map(a => {
      const asset = a.assets as any
      const plant = asset?.plants as any
      return {
        id: asset?.id || '',
        asset_id: asset?.asset_id || '',
        name: asset?.name || '',
        plant_id: asset?.plant_id || null,
        business_unit_id: plant?.business_unit_id || null
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

  // Get the new plant's business unit
  const { data: newPlant } = await supabase
    .from('plants')
    .select('business_unit_id')
    .eq('id', newPlantId)
    .single()

  const newBusinessUnitId = newPlant?.business_unit_id || null

  const affectedAssets: AssetConflict[] = []
  const assetsInNewPlant: AssetConflict[] = []
  const assetsInOtherPlants: AssetConflict[] = []

  for (const assignment of assignments) {
    const asset = assignment.assets as any
    if (!asset) continue

    const assetPlantId = asset.plant_id
    const plant = asset.plants as any
    const assetBusinessUnitId = plant?.business_unit_id || null

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

