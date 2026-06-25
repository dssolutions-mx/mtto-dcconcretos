import type { SupabaseClient } from '@supabase/supabase-js'
import {
  hasLaneBDraftData,
  isChecklistScheduleDraftPayload,
  localDraftHasRestorableData,
  type ChecklistScheduleDraftPayload,
  type LocalChecklistDraftData,
} from '@/lib/checklist/schedule-draft'

export type DraftUpdaterProfile = {
  nombre?: string | null
  apellido?: string | null
}

/** Load draft author profile without PostgREST FK embed (works before migration). */
export async function fetchDraftUpdaterProfile(
  supabase: SupabaseClient,
  draftUpdatedBy: string | null | undefined
): Promise<DraftUpdaterProfile | null> {
  if (!draftUpdatedBy) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('nombre, apellido')
    .eq('id', draftUpdatedBy)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export type DraftSyncStatus =
  | 'none'
  | 'saving'
  | 'synced'
  | 'server_draft'
  | 'local_only'

export type DraftRestoreSource = 'server' | 'local' | 'both'

export function scheduleHasVisibleDraft(schedule: {
  draft_payload?: unknown
  draft_updated_at?: string | null
}): boolean {
  if (schedule.draft_updated_at) return true
  if (!isChecklistScheduleDraftPayload(schedule.draft_payload)) return false
  return hasRestorableServerDraft(schedule.draft_payload)
}

export function hasRestorableServerDraft(
  payload: ChecklistScheduleDraftPayload | null | undefined
): boolean {
  if (!payload) return false
  return (
    hasLaneBDraftData(payload) ||
    (Array.isArray(payload.completed_items) && payload.completed_items.length > 0)
  )
}

export function formatDraftSavedAt(
  value: Date | string | number | null | undefined
): string | null {
  if (value == null) return null
  const date =
    value instanceof Date
      ? value
      : typeof value === 'number'
        ? new Date(value)
        : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDraftSavedBy(
  profile: { nombre?: string | null; apellido?: string | null } | null | undefined
): string | null {
  if (!profile) return null
  const name = `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim()
  return name || null
}

export function countBonusClosureDecisionsInPayload(
  payload: ChecklistScheduleDraftPayload | null | undefined
): number {
  if (!payload?.plant_operations_data) return 0
  let count = 0
  for (const sectionData of Object.values(payload.plant_operations_data)) {
    if (!sectionData || typeof sectionData !== 'object') continue
    const decisions = (sectionData as { decisions?: unknown[] }).decisions
    if (!Array.isArray(decisions)) continue
    count += decisions.filter(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as { eligible?: boolean }).eligible === 'boolean'
    ).length
  }
  return count
}

export function countBonusClosureDecisionsInPlantOps(
  plantOperationsData: Record<string, unknown> | null | undefined
): number {
  if (!plantOperationsData) return 0
  let count = 0
  for (const sectionData of Object.values(plantOperationsData)) {
    if (!sectionData || typeof sectionData !== 'object') continue
    const decisions = (sectionData as { decisions?: unknown[] }).decisions
    if (!Array.isArray(decisions)) continue
    count += decisions.filter(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as { eligible?: boolean }).eligible === 'boolean'
    ).length
  }
  return count
}

export function resolveDraftSyncStatus(input: {
  saving: boolean
  isOnline: boolean
  hasPendingSync: boolean
  laneBDraftDirty: boolean
  hasUnsavedChanges: boolean
  serverDraftUpdatedAt: string | null
  hasLocalDraft: boolean
}): DraftSyncStatus {
  if (input.saving) return 'saving'

  const hasServerTimestamp = Boolean(input.serverDraftUpdatedAt)
  const dirty = input.laneBDraftDirty || input.hasUnsavedChanges

  if (!input.isOnline || input.hasPendingSync) {
    if (dirty || input.hasLocalDraft) return 'local_only'
    if (hasServerTimestamp) return 'server_draft'
    return 'none'
  }

  if (dirty && hasServerTimestamp) return 'server_draft'
  if (dirty && input.hasLocalDraft) return 'local_only'
  if (hasServerTimestamp && !dirty) return 'synced'
  if (input.hasLocalDraft) return 'local_only'
  return 'none'
}

export const DRAFT_SYNC_STATUS_LABEL: Record<
  Exclude<DraftSyncStatus, 'none'>,
  string
> = {
  saving: 'Guardando...',
  synced: 'Sincronizado',
  server_draft: 'Borrador en servidor',
  local_only: 'Solo local (pendiente de sync)',
}

export function detectDraftRestorePrompt(input: {
  serverPayload: unknown
  serverUpdatedAt: string | null
  serverAuthorName: string | null
  localData: unknown
}): {
  source: DraftRestoreSource
  savedAt: Date
  savedByName: string | null
} | null {
  const serverPayload = isChecklistScheduleDraftPayload(input.serverPayload)
    ? input.serverPayload
    : null
  const serverAt = input.serverUpdatedAt
    ? new Date(input.serverUpdatedAt).getTime()
    : 0
  const hasServer =
    serverAt > 0 && hasRestorableServerDraft(serverPayload)

  const local =
    input.localData && typeof input.localData === 'object'
      ? (input.localData as LocalChecklistDraftData)
      : null
  const localAt = typeof local?.timestamp === 'number' ? local.timestamp : 0
  const hasLocal = localDraftHasRestorableData(local)

  if (!hasServer && !hasLocal) return null

  const savedAt =
    hasServer && (!hasLocal || serverAt >= localAt)
      ? new Date(input.serverUpdatedAt!)
      : new Date(localAt)

  const source: DraftRestoreSource =
    hasServer && hasLocal ? 'both' : hasServer ? 'server' : 'local'

  const savedByName =
    hasServer && (!hasLocal || serverAt >= localAt)
      ? input.serverAuthorName
      : null

  return { source, savedAt, savedByName }
}
