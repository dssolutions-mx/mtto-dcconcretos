/**
 * Scoped operator (personnel) registration and placement for line managers vs RH/GG.
 * Aligns with POL-OPE-001 "Alta en plataforma: RRHH a solicitud de JUN o JP" — JUN/JP act as scoped requestors.
 */

export interface ActorForOperatorScope {
  userId: string
  profile: {
    role: string
    business_unit_id: string | null
    plant_id: string | null
    /** When set (e.g. server {@link loadActorContext}), union of primary + junction plants for JEFE_PLANTA. */
    managed_plant_ids?: string[]
  }
}

export function managedPlantIdsForOperatorActor(actor: ActorForOperatorScope): string[] {
  const m = actor.profile.managed_plant_ids
  if (m && m.length > 0) {
    return m
  }
  return actor.profile.plant_id ? [actor.profile.plant_id] : []
}

/** Roles JUN/JP may register (line / field staff only). */
export const JUN_JP_REGISTERABLE_LEGACY_ROLES = [
  'OPERADOR',
  'DOSIFICADOR',
  'MECANICO',
] as const

export type JunJpRegisterableLegacyRole = (typeof JUN_JP_REGISTERABLE_LEGACY_ROLES)[number]

export function isJunJpRegisterableLegacyRole(role: string): role is JunJpRegisterableLegacyRole {
  return (JUN_JP_REGISTERABLE_LEGACY_ROLES as readonly string[]).includes(role)
}

export function isJefeUnidadNegocioActor(actor: ActorForOperatorScope): boolean {
  return actor.profile.role === 'JEFE_UNIDAD_NEGOCIO'
}

export function isJefePlantaActor(actor: ActorForOperatorScope): boolean {
  return actor.profile.role === 'JEFE_PLANTA'
}

export function isJunOrJefePlantaActor(actor: ActorForOperatorScope): boolean {
  return isJefeUnidadNegocioActor(actor) || isJefePlantaActor(actor)
}

export function junJpRegistrationAuditNote(actor: ActorForOperatorScope): string {
  const who = isJefePlantaActor(actor) ? 'JP' : 'JUN'
  return `[Alta ${who} ${actor.userId} ${new Date().toISOString()}]`
}

export interface OperatorPlacementRow {
  plant_id: string | null
  business_unit_id: string | null
}

/** JUN sees BU members, anyone on a plant in the BU, and fully unassigned rows. */
export function operatorRowVisibleToJun(
  op: OperatorPlacementRow,
  junBusinessUnitId: string,
  plantIdsInBusinessUnit: string[]
): boolean {
  if (!op.plant_id && !op.business_unit_id) {
    return true
  }
  if (op.business_unit_id === junBusinessUnitId) {
    return true
  }
  if (op.plant_id && plantIdsInBusinessUnit.includes(op.plant_id)) {
    return true
  }
  return false
}

export function operatorRowVisibleToJp(
  op: OperatorPlacementRow,
  jpManagedPlantIds: string[]
): boolean {
  if (!op.plant_id) {
    return false
  }
  return jpManagedPlantIds.includes(op.plant_id)
}

/**
 * Validates plant_id / business_unit_id for a JUN/JP-created profile (before insert).
 */
export function validateJunJpCreatePlacement(
  actor: ActorForOperatorScope,
  validatedPlantId: string | null,
  validatedBusinessUnitId: string | null,
  plantBusinessUnitId: string | null // when plant is set, its BU
):
  | { ok: true }
  | { ok: false; error: string } {
  if (isJefePlantaActor(actor)) {
    const managed = managedPlantIdsForOperatorActor(actor)
    if (managed.length === 0) {
      return { ok: false, error: 'Tu perfil no tiene planta asignada' }
    }
    if (validatedPlantId == null || !managed.includes(validatedPlantId)) {
      return { ok: false, error: 'La planta debe ser una de tus plantas asignadas' }
    }
    if (plantBusinessUnitId && validatedBusinessUnitId && plantBusinessUnitId !== validatedBusinessUnitId) {
      return { ok: false, error: 'La unidad de negocio no coincide con la planta' }
    }
    return { ok: true }
  }
  if (isJefeUnidadNegocioActor(actor)) {
    if (!actor.profile.business_unit_id) {
      return { ok: false, error: 'Tu perfil no tiene unidad de negocio asignada' }
    }
    if (validatedBusinessUnitId !== actor.profile.business_unit_id) {
      return { ok: false, error: 'La unidad de negocio debe ser la tuya' }
    }
    if (validatedPlantId) {
      if (!plantBusinessUnitId || plantBusinessUnitId !== actor.profile.business_unit_id) {
        return { ok: false, error: 'La planta debe pertenecer a tu unidad de negocio' }
      }
    }
    return { ok: true }
  }
  return { ok: true }
}

/**
 * Validates merged target placement for a JUN/JP PATCH (final plant_id / business_unit_id).
 * `plantBusinessUnitForNewPlant` = plants.business_unit_id when plant_id is set, else null.
 */
export function validateJunJpPatchPlacement(
  actor: ActorForOperatorScope,
  plant_id: string | null,
  business_unit_id: string | null,
  plantBusinessUnitForNewPlant: string | null
):
  | { ok: true; plant_id: string | null; business_unit_id: string | null }
  | { ok: false; error: string } {
  if (isJefePlantaActor(actor)) {
    const managed = managedPlantIdsForOperatorActor(actor)
    if (managed.length === 0) {
      return { ok: false, error: 'Tu perfil no tiene planta asignada' }
    }
    if (plant_id === null && business_unit_id === null) {
      return { ok: true, plant_id: null, business_unit_id: null }
    }
    if (plant_id && managed.includes(plant_id)) {
      const bu = plantBusinessUnitForNewPlant
      if (!bu) {
        return { ok: false, error: 'Planta no encontrada' }
      }
      return { ok: true, plant_id, business_unit_id: bu }
    }
    return { ok: false, error: 'Solo puedes asignar a una de tus plantas o dejar sin asignar' }
  }

  if (isJefeUnidadNegocioActor(actor)) {
    if (!actor.profile.business_unit_id) {
      return { ok: false, error: 'Tu perfil no tiene unidad de negocio asignada' }
    }
    const bu = actor.profile.business_unit_id
    if (plant_id === null && business_unit_id === null) {
      return { ok: true, plant_id: null, business_unit_id: null }
    }
    if (plant_id) {
      if (!plantBusinessUnitForNewPlant || plantBusinessUnitForNewPlant !== bu) {
        return { ok: false, error: 'La planta debe pertenecer a tu unidad de negocio' }
      }
      return { ok: true, plant_id, business_unit_id: plantBusinessUnitForNewPlant }
    }
    if (business_unit_id === bu) {
      return { ok: true, plant_id: null, business_unit_id: bu }
    }
    return { ok: false, error: 'La unidad de negocio debe ser la tuya' }
  }

  return { ok: false, error: 'Ubicación no permitida' }
}
