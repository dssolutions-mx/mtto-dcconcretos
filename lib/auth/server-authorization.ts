/**
 * Server-side authorization helpers.
 * Does NOT rely on RLS for profiles; explicitly queries profiles using the SSR authenticated client.
 * Use these helpers in API routes and server components.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveBusinessRole,
  isTechnicalApproverRole,
  isViabilityReviewerRole,
  isGMEscalatorRole,
  isRHOwnerRole,
  type FutureBusinessRole,
  type RoleScope,
} from '@/lib/auth/role-model'
import { getAuthorizationLimit } from '@/lib/auth/role-permissions'

export interface ActorProfile {
  id: string
  role: string
  business_role?: string | null
  role_scope?: string | null
  business_unit_id: string | null
  plant_id: string | null
  can_authorize_up_to: number | null
}

export interface ActorContext {
  userId: string
  profile: ActorProfile
  effectiveBusinessRole: FutureBusinessRole | null
  scope: RoleScope
  authorizationLimit: number
}

const PROFILE_SELECT = 'id, role, business_role, role_scope, business_unit_id, plant_id, can_authorize_up_to'

/**
 * Load the current actor's profile from profiles table.
 * Uses explicit query via SSR client; does NOT rely on profiles RLS.
 */
export async function loadActorProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ActorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    role: data.role ?? '',
    business_role: (data as { business_role?: string | null }).business_role ?? null,
    role_scope: (data as { role_scope?: string | null }).role_scope ?? null,
    business_unit_id: data.business_unit_id ?? null,
    plant_id: data.plant_id ?? null,
    can_authorize_up_to:
      typeof data.can_authorize_up_to === 'number'
        ? data.can_authorize_up_to
        : Number(data.can_authorize_up_to) || 0,
  }
}

/**
 * Resolve the effective future business role for a profile.
 */
export function resolveEffectiveBusinessRole(
  profile: ActorProfile | null
): FutureBusinessRole | null {
  if (profile?.business_role) {
    return resolveBusinessRole(profile.business_role)
  }
  if (!profile?.role) {
    return null
  }
  return resolveBusinessRole(profile.role)
}

/**
 * Build full actor context for authorization decisions.
 */
export async function loadActorContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ActorContext | null> {
  const profile = await loadActorProfile(supabase, userId)
  if (!profile) {
    return null
  }

  const effectiveBusinessRole = resolveEffectiveBusinessRole(profile)
  const roleScope = effectiveBusinessRole
    ? getRoleScopeFromBusinessRole(effectiveBusinessRole)
    : 'plant'
  const authorizationLimit =
    (profile.can_authorize_up_to ?? 0) > 0
      ? (profile.can_authorize_up_to ?? 0)
      : getAuthorizationLimit(profile.business_role ?? profile.role)

  return {
    userId,
    profile,
    effectiveBusinessRole,
    scope: roleScope,
    authorizationLimit,
  }
}

function getRoleScopeFromBusinessRole(
  role: FutureBusinessRole
): RoleScope {
  const scopeMap: Record<FutureBusinessRole, RoleScope> = {
    GERENCIA_GENERAL: 'global',
    GERENTE_MANTENIMIENTO: 'business_unit',
    COORDINADOR_MANTENIMIENTO: 'plant',
    AREA_ADMINISTRATIVA: 'global',
    AUXILIAR_COMPRAS: 'global',
    OPERADOR: 'plant',
    VISUALIZADOR: 'global',
    EJECUTIVO: 'global',
    RECURSOS_HUMANOS: 'global',
    MECANICO: 'plant',
  }
  return scopeMap[role] ?? 'plant'
}

/**
 * Check if actor has scope over the given business unit.
 * GM (global scope) always has authority. When BU cannot be resolved, only global scope passes.
 */
export function checkScopeOverBusinessUnit(
  actor: ActorContext | null,
  businessUnitId: string | null
): boolean {
  if (!actor) {
    return false
  }
  if (actor.scope === 'global') {
    return true
  }
  if (!businessUnitId) {
    return false
  }
  return actor.profile.business_unit_id === businessUnitId
}

/**
 * Check if actor has scope over the given plant.
 */
export function checkScopeOverPlant(
  actor: ActorContext | null,
  plantId: string | null
): boolean {
  if (!actor) {
    return false
  }
  if (actor.scope === 'global') {
    return true
  }
  if (actor.scope === 'business_unit') {
    return true
  }
  if (!plantId) {
    return true
  }
  return actor.profile.plant_id === plantId || actor.profile.business_unit_id != null
}

/**
 * Check if actor has RH (Recursos Humanos) ownership authority.
 * RH owns: profile creation, role changes, operator reassignment governance.
 */
export function checkRHOwnershipAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return isRHOwnerRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor has technical approval authority for purchase orders.
 * Technical approver = GERENTE_MANTENIMIENTO (maps from JEFE_UNIDAD_NEGOCIO).
 */
export function checkTechnicalApprovalAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return isTechnicalApproverRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor has viability review authority (Administration).
 */
export function checkViabilityReviewAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return isViabilityReviewerRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor has GM escalation authority (final approval).
 */
export function checkGMEscalationAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return isGMEscalatorRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor can update user authorization (role, limits, scope).
 * Uses shared rule: GERENCIA_GENERAL, JEFE_UNIDAD_NEGOCIO, AREA_ADMINISTRATIVA.
 * Task 7 will add RECURSOS_HUMANOS; for Task 3 we keep legacy roles.
 */
export function canUpdateUserAuthorization(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can view the operators list (filtered by scope).
 */
export function canViewOperatorsList(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can create operators (register new users).
 */
export function canCreateOperators(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can update operators.
 */
export function canUpdateOperators(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can deactivate users.
 */
export function canDeactivateUsers(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can delete users (permanent deletion).
 */
export function canDeleteUsers(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return actor.profile.role === 'GERENCIA_GENERAL'
}

/**
 * Check if actor can validate receipts (Administration viability-style action).
 */
export function canValidateReceipts(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  const canValidate =
    checkGMEscalationAuthority(actor) || checkViabilityReviewAuthority(actor)
  if (!canValidate) {
    return false
  }
  const limit = actor.authorizationLimit
  return limit > 0
}

export function canManageAssetOperators(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

export function canReviewComplianceDispute(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

export function canManageComplianceSanctions(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}

export function canAccessRHReporting(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  return checkRHOwnershipAuthority(actor) || actor.profile.role === 'GERENCIA_GENERAL'
}
