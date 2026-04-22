import { effectiveRoleForPermissions } from '@/lib/auth/role-model'
import { checkScopeOverPlant, type ActorContext } from '@/lib/auth/server-authorization'

/** Raw DB role that maps to coordinador for workflow (deprecated enum). */
const LEGACY_COORDINATOR_ROLE = 'ENCARGADO_MANTENIMIENTO'

/**
 * True when the actor is subject to pre-viability quotation rules: Coordinador (incl.
 * Encargado deprecado) or Ejecutivo. Global-scoped Executives pass plant checks via
 * {@link checkScopeOverPlant}.
 */
export function isQuotationViabilityGatedRole(
  actor: ActorContext | null | undefined
): boolean {
  if (!actor?.profile) return false
  const perm =
    effectiveRoleForPermissions({
      role: actor.profile.role,
      business_role: actor.profile.business_role,
    }) ?? actor.profile.role
  if (perm === 'COORDINADOR_MANTENIMIENTO' || perm === 'EJECUTIVO') return true
  if (actor.profile.role === LEGACY_COORDINATOR_ROLE) return true
  if (actor.profile.role === 'EJECUTIVO') return true
  return false
}

/** @deprecated Use {@link isQuotationViabilityGatedRole} */
export function isCoordinatorActor(actor: ActorContext | null | undefined): boolean {
  return isQuotationViabilityGatedRole(actor)
}

export function isViabilityFinalized(
  viabilityState: string | null | undefined
): boolean {
  return viabilityState === 'viable' || viabilityState === 'not_viable'
}

export interface PoForCoordinatorQuotationCheck {
  plant_id?: string | null
  viability_state?: string | null
  status?: string | null
}

/**
 * For Coordinador / Ejecutivo: plant scope + not after viability. Others: always "ok".
 * Returns a result suitable for API 403 responses.
 */
export function coordinatorQuotationMutationAllowed(
  actor: ActorContext | null | undefined,
  po: PoForCoordinatorQuotationCheck
): { ok: true } | { ok: false; message: string } {
  if (!isQuotationViabilityGatedRole(actor)) {
    return { ok: true }
  }
  if (isViabilityFinalized(po.viability_state)) {
    return {
      ok: false,
      message:
        'No se pueden modificar cotizaciones después de la viabilidad administrativa.',
    }
  }
  if (po.status === 'validated' || po.status === 'rejected') {
    return {
      ok: false,
      message: 'No se pueden modificar cotizaciones en este estado de la orden.',
    }
  }
  if (!checkScopeOverPlant(actor, po.plant_id ?? null)) {
    return {
      ok: false,
      message: 'No autorizado: la orden no pertenece a su planta o alcance.',
    }
  }
  return { ok: true }
}

/**
 * UI state for the same pre-viability gate (Coordinador o Ejecutivo).
 * `isViewerCoordinator` means "viewer is subject to the gate" (kept for prop stability).
 */
export function computeCoordinatorQuotationUiState(
  actor: ActorContext | null | undefined,
  po: PoForCoordinatorQuotationCheck
): { isViewerCoordinator: boolean; coordinatorQuotationUnlocked: boolean } {
  if (!actor || !isQuotationViabilityGatedRole(actor)) {
    return { isViewerCoordinator: false, coordinatorQuotationUnlocked: true }
  }
  const gate = coordinatorQuotationMutationAllowed(actor, po)
  return {
    isViewerCoordinator: true,
    coordinatorQuotationUnlocked: gate.ok,
  }
}
