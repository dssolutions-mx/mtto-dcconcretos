import type { SupabaseClient } from '@supabase/supabase-js'
import { managedPlantIdsForOperatorActor } from '@/lib/auth/operator-scope'
import type { ActorContext } from '@/lib/auth/server-authorization'
import { scheduleVisibleToOperatorAssignment } from '@/lib/checklist/executor-authorization'
import {
  CHECKLIST_EXECUTOR_ROLE_OPTIONS,
  isPlantaAsset,
  roleInExecutorRoles,
} from '@/lib/checklist/executor-roles'

export type ScheduleVisibilityAsset = {
  id: string
  plant_id?: string | null
  model_id?: string | null
  equipment_models?: { maintenance_unit?: string | null } | null
}

export type ScheduleVisibilityTemplate = {
  executor_roles?: string[] | null
}

export type ScheduleVisibilityRow = {
  asset_id: string
  checklists?: ScheduleVisibilityTemplate | ScheduleVisibilityTemplate[] | null
  assets?: ScheduleVisibilityAsset | ScheduleVisibilityAsset[] | null
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

function actorScopedToPlant(actor: ActorContext, plantId: string | null): boolean {
  if (!plantId) return false
  return plantIdsForActor(actor).includes(plantId)
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function resolveAsset(
  schedule: ScheduleVisibilityRow,
  asset?: ScheduleVisibilityAsset | ScheduleVisibilityAsset[] | null
): ScheduleVisibilityAsset | null {
  const fromArg = unwrapRelation(asset)
  const fromSchedule = unwrapRelation(schedule.assets)
  return fromArg ?? fromSchedule
}

function resolveChecklistTemplate(
  template?: ScheduleVisibilityTemplate | null,
  schedule?: ScheduleVisibilityRow | null
): ScheduleVisibilityTemplate | null {
  const fromArg =
    template && !Array.isArray(template) ? template : null
  const raw = fromArg ?? schedule?.checklists ?? null
  if (!raw) return null
  if (Array.isArray(raw)) {
    return (raw[0] as ScheduleVisibilityTemplate | undefined) ?? null
  }
  return raw
}

function resolveMaintenanceUnit(
  asset?: ScheduleVisibilityAsset | null
): string | null {
  const em = asset?.equipment_models
  if (!em) return null
  if (Array.isArray(em)) {
    return (em[0] as { maintenance_unit?: string | null })?.maintenance_unit ?? null
  }
  return em.maintenance_unit ?? null
}

function isChecklistExecutorRole(role: string): boolean {
  return (CHECKLIST_EXECUTOR_ROLE_OPTIONS as readonly string[]).includes(role)
}

/** Maintenance supervisors keep full list/dashboard overview (pre-filter behavior). */
const MAINTENANCE_OVERVIEW_ROLES = new Set([
  'GERENTE_MANTENIMIENTO',
  'COORDINADOR_MANTENIMIENTO',
  'ENCARGADO_MANTENIMIENTO',
])

/** Supervisory roles that may see PLANTA assets in list views (read-only; completion stays scoped). */
const PLANTA_LIST_OVERVIEW_ROLES = new Set([
  'GERENCIA_GENERAL',
  'RECURSOS_HUMANOS',
  'AREA_ADMINISTRATIVA',
  ...MAINTENANCE_OVERVIEW_ROLES,
])

function isMaintenanceOverviewRole(role: string): boolean {
  return MAINTENANCE_OVERVIEW_ROLES.has(role)
}

function isPlantaListOverviewRole(role: string): boolean {
  return PLANTA_LIST_OVERVIEW_ROLES.has(role)
}

/** Whether an actor may see PLANTA assets/schedules in checklist list dashboards. */
export function canActorViewPlantaInList(
  actor: ActorContext,
  plantId: string | null
): boolean {
  const role = actor.profile.role
  if (isPlantScopedRole(role)) {
    return actorScopedToPlant(actor, plantId)
  }
  if (isPlantaListOverviewRole(role)) {
    return true
  }
  return false
}

export function isPlantaListReadOnlyRole(role: string): boolean {
  return isPlantaListOverviewRole(role)
}

/**
 * List/dashboard visibility: executor_roles restrict field roles only.
 * Supervisory roles keep the pre-filter overview access they had before.
 */
function rolePassesExecutorRolesForListView(
  role: string,
  executorRoles: string[] | null | undefined
): boolean {
  if (isMaintenanceOverviewRole(role)) return true
  if (roleInExecutorRoles(role, executorRoles)) return true
  return !isChecklistExecutorRole(role)
}

/**
 * Whether an actor may see a schedule in list/dashboard views.
 * Mirrors {@link assertCanCompleteChecklistSchedule} read-side rules.
 */
export function isScheduleVisibleToActor(
  schedule: ScheduleVisibilityRow,
  actor: ActorContext,
  template?: ScheduleVisibilityTemplate | null,
  asset?: ScheduleVisibilityAsset | null,
  assignedAssetIds?: Set<string>
): boolean {
  const role = actor.profile.role
  const checklist = resolveChecklistTemplate(template, schedule)
  const executorRoles = checklist?.executor_roles

  if (!rolePassesExecutorRolesForListView(role, executorRoles)) {
    return false
  }

  const resolvedAsset = resolveAsset(schedule, asset)
  const assetId = schedule.asset_id || resolvedAsset?.id
  if (!assetId) return false

  if (!resolvedAsset?.id) {
    if (role === 'OPERADOR') {
      return assignedAssetIds?.has(assetId) ?? false
    }
    if (role === 'DOSIFICADOR' || role === 'JEFE_PLANTA') {
      return false
    }
    return true
  }

  const modelId = resolvedAsset.model_id ?? null
  const maintenanceUnit = resolveMaintenanceUnit(resolvedAsset)
  const planta = isPlantaAsset({ modelId, maintenanceUnit })

  if (planta) {
    return canActorViewPlantaInList(actor, resolvedAsset.plant_id ?? null)
  }

  if (role === 'OPERADOR') {
    if (!assignedAssetIds?.has(assetId)) return false
    return scheduleVisibleToOperatorAssignment(
      { checklists: { executor_roles: executorRoles }, assets: resolvedAsset },
      assignedAssetIds,
      assetId
    )
  }

  if (role === 'DOSIFICADOR' || role === 'JEFE_PLANTA') {
    if (!actorScopedToPlant(actor, resolvedAsset.plant_id ?? null)) return false
  }

  return true
}

/** Whether an asset row should appear in checklist dashboards for this actor. */
export function isAssetVisibleToActor(
  asset: ScheduleVisibilityAsset,
  actor: ActorContext,
  assignedAssetIds?: Set<string>
): boolean {
  const planta = isPlantaAsset({
    modelId: asset.model_id,
    maintenanceUnit: resolveMaintenanceUnit(asset),
  })

  if (planta) {
    return canActorViewPlantaInList(actor, asset.plant_id ?? null)
  }

  if (actor.profile.role === 'OPERADOR') {
    return assignedAssetIds?.has(asset.id) ?? false
  }

  if (actor.profile.role === 'DOSIFICADOR' || actor.profile.role === 'JEFE_PLANTA') {
    return actorScopedToPlant(actor, asset.plant_id ?? null)
  }

  return true
}

export async function loadOperatorAssignedAssetIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('asset_operators')
    .select('asset_id')
    .eq('operator_id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('[schedule-visibility] asset_operators lookup failed', error)
    return new Set()
  }

  return new Set((data ?? []).map((row) => row.asset_id).filter(Boolean))
}

export function filterSchedulesForActor<T extends ScheduleVisibilityRow>(
  schedules: T[],
  actor: ActorContext,
  assetById: Map<string, ScheduleVisibilityAsset>,
  assignedAssetIds?: Set<string>
): T[] {
  return schedules.filter((schedule) => {
    const asset =
      assetById.get(schedule.asset_id) ?? unwrapRelation(schedule.assets)
    const checklist = resolveChecklistTemplate(schedule.checklists, schedule)
    return isScheduleVisibleToActor(
      schedule,
      actor,
      checklist,
      asset,
      assignedAssetIds
    )
  })
}
