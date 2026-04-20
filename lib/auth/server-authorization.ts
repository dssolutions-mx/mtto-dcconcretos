/**
 * Server-side authorization helpers.
 * Does NOT rely on RLS for profiles; explicitly queries profiles using the SSR authenticated client.
 * Use these helpers in API routes and server components.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  resolveBusinessRole,
  isViabilityReviewerRole,
  isGMEscalatorRole,
  isRHOwnerRole,
  effectiveRoleForPermissions,
  type FutureBusinessRole,
  type RoleScope,
} from '@/lib/auth/role-model'
import { getAuthorizationLimit } from '@/lib/auth/role-permissions'
import {
  isJefePlantaActor,
  isJefeUnidadNegocioActor,
  isJunOrJefePlantaActor,
  operatorRowVisibleToJun,
  type ActorForOperatorScope,
  type OperatorPlacementRow,
} from '@/lib/auth/operator-scope'

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
 * When profile.role is GERENTE_MANTENIMIENTO, always use it—never trust business_role
 * for elevation (e.g. legacy GERENCIA_GENERAL) to avoid incorrect approval permissions.
 */
export function resolveEffectiveBusinessRole(
  profile: ActorProfile | null
): FutureBusinessRole | null {
  if (!profile?.role) {
    return null
  }
  if (profile.role === 'GERENTE_MANTENIMIENTO') {
    return 'GERENTE_MANTENIMIENTO'
  }
  // Never let stale business_role collapse JUN/JP into another line (e.g. Gerente).
  if (profile.role === 'JEFE_UNIDAD_NEGOCIO') {
    return 'JEFE_UNIDAD_NEGOCIO'
  }
  if (profile.role === 'JEFE_PLANTA') {
    return 'JEFE_PLANTA'
  }
  if (profile.business_role) {
    return resolveBusinessRole(profile.business_role)
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
  const permRole =
    effectiveRoleForPermissions({
      role: profile.role,
      business_role: profile.business_role,
    }) ??
    profile.business_role ??
    profile.role
  const authorizationLimit =
    (profile.can_authorize_up_to ?? 0) > 0
      ? (profile.can_authorize_up_to ?? 0)
      : getAuthorizationLimit(permRole)

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
    GERENTE_MANTENIMIENTO: 'global',
    JEFE_UNIDAD_NEGOCIO: 'business_unit',
    JEFE_PLANTA: 'plant',
    COORDINADOR_MANTENIMIENTO: 'plant',
    AREA_ADMINISTRATIVA: 'global',
    AUXILIAR_COMPRAS: 'global',
    ENCARGADO_ALMACEN: 'plant',
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
 * Aut.1 técnica (validación técnica OC): solo Gerente de Mantenimiento por rol canónico.
 * Uses profiles.role only — never business_role (JUN must not pass via stale GERENTE_MANTENIMIENTO).
 * Gerencia General uses checkGMEscalationAuthority for primer aprobado / bypass, not this helper.
 */
export function checkTechnicalApprovalAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return actor.profile.role === 'GERENTE_MANTENIMIENTO'
}

/**
 * Check if actor has viability review authority (Administration).
 * GERENTE_MANTENIMIENTO is never a viability reviewer—only AREA_ADMINISTRATIVA/GM.
 */
export function checkViabilityReviewAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  if (actor.profile.role === 'GERENTE_MANTENIMIENTO') {
    return false
  }
  return isViabilityReviewerRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor has GM escalation authority (final approval).
 * GERENTE_MANTENIMIENTO is never GM—only GERENCIA_GENERAL has escalation authority.
 */
export function checkGMEscalationAuthority(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  if (actor.profile.role === 'GERENTE_MANTENIMIENTO') {
    return false
  }
  return isGMEscalatorRole(actor.profile.business_role ?? actor.profile.role)
}

/**
 * Check if actor can update user authorization (role, limits, scope).
 * Uses shared rule: GERENCIA_GENERAL or RECURSOS_HUMANOS (Task 7 completes RH ownership).
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
 * DOSIFICADOR: same-plant peer list only (e.g. security-talk attendees); requires plant_id on profile.
 */
export function canViewOperatorsList(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return (
    checkRHOwnershipAuthority(actor) ||
    actor.profile.role === 'GERENCIA_GENERAL' ||
    actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' ||
    actor.profile.role === 'JEFE_PLANTA' ||
    (actor.profile.role === 'DOSIFICADOR' && !!actor.profile.plant_id)
  )
}

/**
 * Check if actor can create operators (register new users).
 * JUN/JP: scoped validation in API (BU/plant + role allowlist).
 */
export function canCreateOperators(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return (
    checkRHOwnershipAuthority(actor) ||
    actor.profile.role === 'GERENCIA_GENERAL' ||
    actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' ||
    actor.profile.role === 'JEFE_PLANTA'
  )
}

/**
 * Check if actor can update operators (full profile fields — RH / GG).
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
 * JUN/JP may change plant/BU placement only (not role, limits, or PII batch edits).
 */
export function canUpdateOperatorPlacement(
  actor: ActorContext | null
): boolean {
  if (!actor) {
    return false
  }
  return isJunOrJefePlantaActor({
    userId: actor.userId,
    profile: {
      role: actor.profile.role,
      business_unit_id: actor.profile.business_unit_id,
      plant_id: actor.profile.plant_id,
    },
  })
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

/**
 * RH / GG / Gerente de Mantenimiento — full asset–operator mutations without BU/plant scope checks.
 */
export function canManageAssetOperatorsGlobally(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  return (
    checkRHOwnershipAuthority(actor) ||
    actor.profile.role === 'GERENCIA_GENERAL' ||
    actor.profile.role === 'GERENTE_MANTENIMIENTO'
  )
}

/**
 * Who may call asset-operators APIs at all (global managers or Jefe de Unidad / Jefe de Planta with scoped asserts).
 */
export function canAttemptAssetOperatorMutation(actor: ActorContext | null): boolean {
  if (!actor) {
    return false
  }
  if (canManageAssetOperatorsGlobally(actor)) {
    return true
  }
  return (
    actor.profile.role === 'JEFE_UNIDAD_NEGOCIO' || actor.profile.role === 'JEFE_PLANTA'
  )
}

export type AssetOperatorAssertResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

function actorForOperatorScope(actor: ActorContext): ActorForOperatorScope {
  return {
    userId: actor.userId,
    profile: {
      role: actor.profile.role,
      business_unit_id: actor.profile.business_unit_id,
      plant_id: actor.profile.plant_id,
    },
  }
}

/**
 * Scoped checks for Jefe de Unidad de Negocio / Jefe de Planta when mutating asset–operator rows.
 * Call only when the actor is not {@link canManageAssetOperatorsGlobally}.
 */
export async function assertActorMayMutateAssetOperator(
  supabase: SupabaseClient,
  actor: ActorContext,
  params: { assetId: string; operatorId: string }
): Promise<AssetOperatorAssertResult> {
  const scoped = actorForOperatorScope(actor)

  if (isJefeUnidadNegocioActor(scoped)) {
    if (!actor.profile.business_unit_id) {
      return { ok: false, error: 'Tu perfil no tiene unidad de negocio asignada', status: 403 }
    }
    const buId = actor.profile.business_unit_id

    const { data: plantsInBu } = await supabase
      .from('plants')
      .select('id')
      .eq('business_unit_id', buId)

    const plantIdsInBusinessUnit = (plantsInBu ?? []).map((p) => p.id)

    const { data: assetRow, error: assetErr } = await supabase
      .from('assets')
      .select('id, plant_id, plants:plant_id(business_unit_id)')
      .eq('id', params.assetId)
      .maybeSingle()

    if (assetErr || !assetRow) {
      return { ok: false, error: 'Activo no encontrado', status: 404 }
    }

    if (!assetRow.plant_id) {
      return {
        ok: false,
        error: 'El activo debe tener planta asignada para esta operación',
        status: 403,
      }
    }

    const plantData = Array.isArray(assetRow.plants) ? assetRow.plants[0] : assetRow.plants
    const assetBuId = (plantData as { business_unit_id?: string } | null)?.business_unit_id
    if (!assetBuId || assetBuId !== buId) {
      return {
        ok: false,
        error: 'La planta del activo debe pertenecer a tu unidad de negocio',
        status: 403,
      }
    }

    const { data: opRow, error: opErr } = await supabase
      .from('profiles')
      .select('id, plant_id, business_unit_id')
      .eq('id', params.operatorId)
      .maybeSingle()

    if (opErr || !opRow) {
      return { ok: false, error: 'Operador no encontrado', status: 404 }
    }

    const opPlacement: OperatorPlacementRow = {
      plant_id: opRow.plant_id,
      business_unit_id: opRow.business_unit_id,
    }

    if (!operatorRowVisibleToJun(opPlacement, buId, plantIdsInBusinessUnit)) {
      return {
        ok: false,
        error: 'No puedes asignar este operador a este activo según tu alcance',
        status: 403,
      }
    }

    return { ok: true }
  }

  if (isJefePlantaActor(scoped)) {
    if (!actor.profile.plant_id) {
      return { ok: false, error: 'Tu perfil no tiene planta asignada', status: 403 }
    }
    const jpPlantId = actor.profile.plant_id

    const { data: assetRow, error: assetErr } = await supabase
      .from('assets')
      .select('id, plant_id')
      .eq('id', params.assetId)
      .maybeSingle()

    if (assetErr || !assetRow) {
      return { ok: false, error: 'Activo no encontrado', status: 404 }
    }

    if (assetRow.plant_id !== jpPlantId) {
      return { ok: false, error: 'Solo puedes gestionar activos de tu planta', status: 403 }
    }

    const { data: opRow, error: opErr } = await supabase
      .from('profiles')
      .select('id, plant_id')
      .eq('id', params.operatorId)
      .maybeSingle()

    if (opErr || !opRow) {
      return { ok: false, error: 'Operador no encontrado', status: 404 }
    }

    if (opRow.plant_id !== jpPlantId) {
      return { ok: false, error: 'Solo puedes asignar operadores de tu planta', status: 403 }
    }

    return { ok: true }
  }

  return {
    ok: false,
    error: 'No tienes permiso para gestionar asignaciones operador-activo',
    status: 403,
  }
}

/**
 * Full gate for asset_operators POST/PUT/DELETE and transfer: session, role eligibility, then BU/plant scope for JUN/JP.
 */
export async function assertMayMutateAssetOperatorRow(
  supabase: SupabaseClient,
  actor: ActorContext | null,
  params: { assetId: string; operatorId: string }
): Promise<AssetOperatorAssertResult> {
  if (!actor) {
    return { ok: false, error: 'Unauthorized', status: 401 }
  }
  if (!canAttemptAssetOperatorMutation(actor)) {
    return {
      ok: false,
      error:
        'Forbidden: Only RH, Gerencia General, Gerente de Mantenimiento, Jefe de Unidad de Negocio or Jefe de Planta can manage asset operators',
      status: 403,
    }
  }
  if (canManageAssetOperatorsGlobally(actor)) {
    return { ok: true }
  }
  return assertActorMayMutateAssetOperator(supabase, actor, params)
}

/**
 * Transfer: require scope on target asset (and source asset when provided) for the same operator.
 */
export async function assertMayTransferAssetOperator(
  supabase: SupabaseClient,
  actor: ActorContext | null,
  params: { operatorId: string; toAssetId: string; fromAssetId?: string | null }
): Promise<AssetOperatorAssertResult> {
  const toResult = await assertMayMutateAssetOperatorRow(supabase, actor, {
    assetId: params.toAssetId,
    operatorId: params.operatorId,
  })
  if (!toResult.ok) {
    return toResult
  }
  if (params.fromAssetId) {
    return assertMayMutateAssetOperatorRow(supabase, actor, {
      assetId: params.fromAssetId,
      operatorId: params.operatorId,
    })
  }
  return { ok: true }
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
