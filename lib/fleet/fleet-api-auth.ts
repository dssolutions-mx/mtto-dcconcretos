/**
 * RBAC helpers for fleet flota APIs (align with app/api/assets/[id]/plant-assignment patterns).
 */

export const FLEET_READ_ROLES: string[] = [] // all authenticated

export const FLEET_EDIT_ROLES = [
  'GERENCIA_GENERAL',
  'JEFE_UNIDAD_NEGOCIO',
  'JEFE_PLANTA',
  'COORDINADOR_MANTENIMIENTO',
  'GERENTE_MANTENIMIENTO',
] as const

export const FLEET_VERIFY_ROLES = FLEET_EDIT_ROLES

export type FleetActor = {
  id: string
  role: string
  business_unit_id: string | null
  plant_id: string | null
  /** Union of primary + `profile_managed_plants` for Jefe de Planta (optional on client). */
  managed_plant_ids?: string[]
}

function fleetManagedPlantIds(actor: FleetActor): string[] {
  if (actor.managed_plant_ids && actor.managed_plant_ids.length > 0) {
    return actor.managed_plant_ids
  }
  return actor.plant_id ? [actor.plant_id] : []
}

export function canFleetEdit(actor: FleetActor | null): boolean {
  if (!actor?.role) return false
  return (FLEET_EDIT_ROLES as readonly string[]).includes(actor.role)
}

export function canFleetVerify(actor: FleetActor | null): boolean {
  return canFleetEdit(actor)
}

/** Returns true if actor may modify an asset at the given plant (and optional BU of that plant). */
export function canEditAssetAtPlant(
  actor: FleetActor,
  assetPlantId: string | null,
  plantBusinessUnitId: string | null
): boolean {
  if (!canFleetEdit(actor)) return false
  if (actor.role === 'GERENCIA_GENERAL') return true
  if (actor.role === 'JEFE_UNIDAD_NEGOCIO') {
    return (
      !!plantBusinessUnitId &&
      plantBusinessUnitId === actor.business_unit_id
    )
  }
  // Coordinador with BU on profile: BU-wide (matches executeAssetPlantReassignment before plant-only branch)
  if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.business_unit_id) {
    return plantBusinessUnitId === actor.business_unit_id
  }
  if (actor.role === 'JEFE_PLANTA') {
    return !!assetPlantId && fleetManagedPlantIds(actor).includes(assetPlantId)
  }
  if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.plant_id) {
    return !!assetPlantId && assetPlantId === actor.plant_id
  }
  if (actor.role === 'GERENTE_MANTENIMIENTO') {
    if (actor.plant_id) {
      return assetPlantId === actor.plant_id
    }
    if (actor.business_unit_id && plantBusinessUnitId) {
      return plantBusinessUnitId === actor.business_unit_id
    }
    return true
  }
  return false
}

/**
 * Whether fleet bulk may set an asset's plant to `toPlantId`, given its current plant.
 * Destination-only checks using canEditAssetAtPlant fail for JP / plant-only Coordinador when moving
 * off their plant within policy; this matches plant reassignment scope (at least one side is "my" plant for plant-scoped roles).
 */
export function canFleetBulkAssignAssetToPlant(
  actor: FleetActor,
  fromPlantId: string | null,
  _fromPlantBuId: string | null,
  toPlantId: string,
  toPlantBuId: string | null
): boolean {
  if (!canFleetEdit(actor)) return false
  if (actor.role === 'GERENCIA_GENERAL') return true
  if (actor.role === 'JEFE_UNIDAD_NEGOCIO') {
    return !!toPlantBuId && toPlantBuId === actor.business_unit_id
  }
  if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.business_unit_id) {
    return toPlantBuId === actor.business_unit_id
  }
  if (actor.role === 'GERENTE_MANTENIMIENTO') {
    if (actor.plant_id) {
      return toPlantId === actor.plant_id || fromPlantId === actor.plant_id
    }
    if (actor.business_unit_id && toPlantBuId) {
      return toPlantBuId === actor.business_unit_id
    }
    return true
  }
  if (actor.role === 'JEFE_PLANTA') {
    const m = fleetManagedPlantIds(actor)
    return (
      (!!toPlantId && m.includes(toPlantId)) || (!!fromPlantId && m.includes(fromPlantId))
    )
  }
  if (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.plant_id) {
    return toPlantId === actor.plant_id || fromPlantId === actor.plant_id
  }
  return false
}
