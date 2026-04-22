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
  if (
    actor.role === 'JEFE_PLANTA' ||
    (actor.role === 'COORDINADOR_MANTENIMIENTO' && actor.plant_id)
  ) {
    return !!assetPlantId && assetPlantId === actor.plant_id
  }
  if (
    actor.role === 'COORDINADOR_MANTENIMIENTO' &&
    actor.business_unit_id &&
    !actor.plant_id
  ) {
    return plantBusinessUnitId === actor.business_unit_id
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
