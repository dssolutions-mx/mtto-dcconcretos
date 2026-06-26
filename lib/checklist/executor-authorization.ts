import type { SupabaseClient } from '@supabase/supabase-js'
import { managedPlantIdsForOperatorActor } from '@/lib/auth/operator-scope'
import type { ActorContext } from '@/lib/auth/server-authorization'
import { expandAssetIdsForOperatorChecklists } from '@/lib/composite-operator-scope'
import {
  executorRolesForModel,
  isPlantaAsset,
  normalizeExecutorRoles,
  roleInExecutorRoles,
} from '@/lib/checklist/executor-roles'

export type ScheduleAssetContext = {
  assetId: string
  plantId: string | null
  modelId: string | null
  maintenanceUnit: string | null
}

export type CompletionAuthResult =
  | { allowed: true }
  | { allowed: false; reason: string }

type NestedRelation<T> = T | T[] | null | undefined

function unwrapRelation<T>(value: NestedRelation<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export type ScheduleAuthRow = {
  asset_id: string | null
  checklists?:
    | {
        executor_roles?: string[] | null
        model_id?: string | null
        equipment_models?: NestedRelation<{ maintenance_unit?: string | null }>
      }
    | NestedRelation<{
        executor_roles?: string[] | null
        model_id?: string | null
        equipment_models?: NestedRelation<{ maintenance_unit?: string | null }>
      }>
    | null
  assets?:
    | {
        id?: string
        plant_id?: string | null
        model_id?: string | null
        equipment_models?: NestedRelation<{ maintenance_unit?: string | null }>
      }
    | NestedRelation<{
        id?: string
        plant_id?: string | null
        model_id?: string | null
        equipment_models?: NestedRelation<{ maintenance_unit?: string | null }>
      }>
    | null
}

/** Normalize Supabase schedule row joins for completion/draft authorization. */
export function resolveScheduleAuthContext(schedule: ScheduleAuthRow): {
  executorRoles: string[] | null
  asset: ScheduleAssetContext
} {
  const checklistRow = unwrapRelation(schedule.checklists)
  const assetRow = unwrapRelation(schedule.assets)
  const assetModelRow = unwrapRelation(assetRow?.equipment_models)
  const checklistModelRow = unwrapRelation(checklistRow?.equipment_models)

  return {
    executorRoles: checklistRow?.executor_roles ?? null,
    asset: {
      assetId: schedule.asset_id ?? assetRow?.id ?? '',
      plantId: assetRow?.plant_id ?? null,
      modelId: assetRow?.model_id ?? checklistRow?.model_id ?? null,
      maintenanceUnit:
        assetModelRow?.maintenance_unit ??
        checklistModelRow?.maintenance_unit ??
        null,
    },
  }
}

function plantIdsForActor(actor: ActorContext): string[] {
  return managedPlantIdsForOperatorActor({
    userId: actor.userId,
    profile: {
      role: actor.profile.role,
      business_unit_id: actor.profile.business_unit_id,
      plant_id: actor.profile.plant_id,
      managed_plant_ids: actor.profile.managed_plant_ids,
    },
  })
}

function isPlantScopedRole(role: string): boolean {
  return role === 'DOSIFICADOR' || role === 'JEFE_PLANTA'
}

/** Admin/support roles that may complete PLANTA checklists without plant scope. */
const PLANTA_COMPLETION_ADMIN_ROLES = new Set([
  'GERENCIA_GENERAL',
  'RECURSOS_HUMANOS',
])

function isPlantaCompletionAdminRole(role: string): boolean {
  return PLANTA_COMPLETION_ADMIN_ROLES.has(role)
}

export function getAllowedExecutorRolesForCompletion(
  executorRoles: string[] | null | undefined,
  asset: ScheduleAssetContext
): string[] {
  const planta = isPlantaAsset({
    modelId: asset.modelId,
    maintenanceUnit: asset.maintenanceUnit,
  })
  if (planta) {
    return executorRolesForModel(asset.modelId, asset.maintenanceUnit)
  }
  return normalizeExecutorRoles(executorRoles)
}

/**
 * Sync completion eligibility (except OPERADOR asset assignment, validated server-side).
 */
export function evaluateCompletionEligibilitySync(
  actor: ActorContext,
  executorRoles: string[] | null | undefined,
  asset: ScheduleAssetContext
): CompletionAuthResult & { allowedExecutorRoles: string[] } {
  const role = actor.profile.role
  const allowedExecutorRoles = getAllowedExecutorRolesForCompletion(
    executorRoles,
    asset
  )

  const planta = isPlantaAsset({
    modelId: asset.modelId,
    maintenanceUnit: asset.maintenanceUnit,
  })

  if (planta && isPlantaCompletionAdminRole(role)) {
    return { allowed: true, allowedExecutorRoles }
  }

  // Operators complete checklists on their assigned assets regardless of executor_roles.
  if (role === 'OPERADOR' && !planta) {
    return { allowed: true, allowedExecutorRoles }
  }

  const rolesForCheck = planta
    ? executorRolesForModel(asset.modelId, asset.maintenanceUnit)
    : executorRoles

  if (!roleInExecutorRoles(role, rolesForCheck)) {
    const allowed = planta ? rolesForCheck : allowedExecutorRoles
    return {
      allowed: false,
      allowedExecutorRoles: allowed,
      reason: `El rol '${role}' no está autorizado para completar esta plantilla. Roles permitidos: ${allowed.join(', ')}`,
    }
  }

  if (planta) {
    if (!isPlantScopedRole(role)) {
      return {
        allowed: false,
        allowedExecutorRoles,
        reason:
          'Los checklists de planta solo pueden completarlos Dosificador o Jefe de Planta de la planta correspondiente',
      }
    }
    if (!actorScopedToPlant(actor, asset.plantId)) {
      return {
        allowed: false,
        allowedExecutorRoles,
        reason: 'No tienes alcance sobre la planta de este activo',
      }
    }
    return { allowed: true, allowedExecutorRoles }
  }

  if (role === 'DOSIFICADOR' || role === 'JEFE_PLANTA') {
    if (!actorScopedToPlant(actor, asset.plantId)) {
      return {
        allowed: false,
        allowedExecutorRoles,
        reason: 'No tienes alcance sobre la planta de este activo',
      }
    }
  }

  return { allowed: true, allowedExecutorRoles }
}

function actorScopedToPlant(actor: ActorContext, plantId: string | null): boolean {
  if (!plantId) return false
  return plantIdsForActor(actor).includes(plantId)
}

async function hasActiveAssetOperatorAssignment(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('asset_operators')
    .select('asset_id')
    .eq('operator_id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('[executor-authorization] asset_operators lookup failed', error)
    return false
  }

  const assignmentAssetIds = (data ?? [])
    .map((row) => row.asset_id)
    .filter(Boolean) as string[]
  if (assignmentAssetIds.length === 0) return false

  if (assignmentAssetIds.includes(assetId)) return true

  const expanded = await expandAssetIdsForOperatorChecklists(
    supabase,
    assignmentAssetIds
  )
  return expanded.includes(assetId)
}

/**
 * Whether the actor may complete a schedule given template executor_roles and asset context.
 */
export async function assertCanCompleteChecklistSchedule(
  supabase: SupabaseClient,
  actor: ActorContext,
  executorRoles: string[] | null | undefined,
  asset: ScheduleAssetContext
): Promise<CompletionAuthResult> {
  const role = actor.profile.role
  const syncResult = evaluateCompletionEligibilitySync(
    actor,
    executorRoles,
    asset
  )

  if (!syncResult.allowed) {
    const { allowedExecutorRoles: _roles, ...result } = syncResult
    return result
  }

  if (role === 'OPERADOR') {
    const assigned = await hasActiveAssetOperatorAssignment(
      supabase,
      actor.userId,
      asset.assetId
    )
    if (!assigned) {
      return {
        allowed: false,
        reason: 'Debes estar asignado al activo como operador para completar este checklist',
      }
    }
  }

  return { allowed: true }
}

/**
 * Whether an operator may see a schedule on an assigned asset.
 * Asset assignment (including composite scope) is the gate — not executor_roles
 * or schedule.assigned_to technical assignment.
 */
export function scheduleVisibleToOperatorAssignment(
  schedule: {
    checklists?: { executor_roles?: string[] | null } | null
    assets?: {
      model_id?: string | null
      equipment_models?: { maintenance_unit?: string | null } | null
    } | null
  },
  assignedAssetIds: Set<string>,
  scheduleAssetId: string
): boolean {
  if (!assignedAssetIds.has(scheduleAssetId)) {
    return false
  }

  const asset = schedule.assets
  const modelId = asset?.model_id ?? null
  const maintenanceUnit =
    asset?.equipment_models?.maintenance_unit ?? null

  if (isPlantaAsset({ modelId, maintenanceUnit })) {
    return assignedAssetIds.has(scheduleAssetId)
  }

  return true
}
