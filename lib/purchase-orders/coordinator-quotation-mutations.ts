import type { UserProfile } from '@/types/auth-store'
import { effectiveRoleForPermissions } from '@/lib/auth/role-model'
import {
  buildActorContextFromProfile,
  checkScopeOverPlant,
  type ActorContext,
  type ActorProfile,
} from '@/lib/auth/server-authorization'

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
 * Plant scope for quotation mutations (Coordinador / legacy Encargado / Ejecutivo gate).
 * Aligns with `useUserPlant` (@/hooks/use-user-plant): when `profiles.plant_id` is null, the client
 * treats the user as having access to all plants (`user_authorization_summary`); the server
 * must not deny quotation writes solely because a WO-resolved PO has a concrete `plant_id`.
 */
function quotationMutationPlantScopeOk(
  actor: ActorContext | null | undefined,
  plantId: string | null
): boolean {
  if (checkScopeOverPlant(actor, plantId)) {
    return true
  }
  if (!actor || !isQuotationViabilityGatedRole(actor)) {
    return false
  }
  if (actor.scope !== 'plant') {
    return false
  }
  const own = actor.profile.plant_id
  if (own != null && String(own).trim() !== '') {
    return false
  }
  return true
}

export function userProfileToActorProfile(profile: UserProfile): ActorProfile {
  return {
    id: profile.id,
    role: profile.role,
    business_role: profile.business_role ?? null,
    role_scope: profile.role_scope ?? null,
    business_unit_id: profile.business_unit_id ?? null,
    plant_id: profile.plant_id ?? null,
    can_authorize_up_to: profile.can_authorize_up_to ?? 0,
  }
}

/**
 * Client-side preflight: same rules as the quotations API gate, using the session profile.
 */
export function computeCoordinatorQuotationPreflightFromUserProfile(
  userId: string,
  profile: UserProfile,
  po: PoForCoordinatorQuotationCheck
): {
  isViewerCoordinator: boolean
  coordinatorQuotationUnlocked: boolean
  blockerMessage: string | null
} {
  const actor = buildActorContextFromProfile(userId, userProfileToActorProfile(profile))
  const gate = coordinatorQuotationMutationAllowed(actor, po)
  const gated = isQuotationViabilityGatedRole(actor)
  return {
    isViewerCoordinator: gated,
    coordinatorQuotationUnlocked: gate.ok,
    blockerMessage: gate.ok ? null : gate.message,
  }
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
  if (!quotationMutationPlantScopeOk(actor, po.plant_id ?? null)) {
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
