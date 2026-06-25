/** Server-persisted draft payload for in-progress checklist execution (Lane B + partial Lane A). */
export type ChecklistScheduleDraftPayload = {
  completed_items?: Array<{
    item_id: string
    status: string
    notes?: string | null
    photo_url?: string | null
    section_type?: string | null
  }>
  security_data?: Record<string, unknown>
  plant_operations_data?: Record<string, unknown>
  evidence?: Record<string, unknown[]>
}

/** Client-side Dexie draft shape (camelCase keys). */
export type LocalChecklistDraftData = {
  timestamp?: number
  serverDraftUpdatedAt?: string | null
  securityData?: Record<string, unknown>
  plantOperationsData?: Record<string, unknown>
  tireReadingsData?: Record<string, unknown[]>
  itemStatus?: Record<string, string>
  [key: string]: unknown
}

export function isChecklistScheduleDraftPayload(
  value: unknown
): value is ChecklistScheduleDraftPayload {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0
}

/** Map local Dexie draft Lane B fields to server draft_payload shape. */
export function localDraftToServerPayload(
  data: unknown
): ChecklistScheduleDraftPayload {
  if (!data || typeof data !== 'object') return {}

  const local = data as LocalChecklistDraftData
  const payload: ChecklistScheduleDraftPayload = {}

  if (isNonEmptyRecord(local.securityData)) {
    payload.security_data = local.securityData
  }
  if (isNonEmptyRecord(local.plantOperationsData)) {
    payload.plant_operations_data = local.plantOperationsData
  }

  return payload
}

export function hasLaneBDraftData(payload: ChecklistScheduleDraftPayload): boolean {
  return (
    isNonEmptyRecord(payload.security_data) ||
    isNonEmptyRecord(payload.plant_operations_data)
  )
}

/** Shallow-merge section maps; incoming wins per section id. */
export function mergeSectionRecordMaps<T extends Record<string, unknown>>(
  base: T | undefined | null,
  incoming: T | undefined | null
): T {
  if (!isNonEmptyRecord(incoming)) {
    return (base ?? {}) as T
  }
  if (!isNonEmptyRecord(base)) {
    return incoming as T
  }
  return { ...base, ...incoming }
}

/** Merge server Lane B draft with newer local Lane B fields (local wins per section). */
export function mergeServerAndLocalDraftPayload(
  server: ChecklistScheduleDraftPayload | null | undefined,
  local: unknown
): ChecklistScheduleDraftPayload {
  const localPayload = localDraftToServerPayload(local)
  const serverPayload = isChecklistScheduleDraftPayload(server) ? server : {}

  return {
    ...serverPayload,
    security_data: mergeSectionRecordMaps(
      serverPayload.security_data,
      localPayload.security_data
    ),
    plant_operations_data: mergeSectionRecordMaps(
      serverPayload.plant_operations_data,
      localPayload.plant_operations_data
    ),
  }
}

export type OfflineCompleteLaneBFields = {
  security_data?: Record<string, unknown>
  plant_operations_data?: Record<string, unknown>
  tire_readings?: unknown[]
}

/** Normalize offline complete payload + optional local draft into API body fields. */
export function buildOfflineCompleteLaneBFields(
  payload: Record<string, unknown>,
  localDraft?: unknown
): OfflineCompleteLaneBFields {
  const fromPayload: OfflineCompleteLaneBFields = {}

  const security =
    payload.security_data ?? payload.securityData
  if (isNonEmptyRecord(security)) {
    fromPayload.security_data = security
  }

  const plantOps =
    payload.plant_operations_data ?? payload.plantOperationsData
  if (isNonEmptyRecord(plantOps)) {
    fromPayload.plant_operations_data = plantOps
  }

  const tireReadings = payload.tire_readings
  if (Array.isArray(tireReadings) && tireReadings.length > 0) {
    fromPayload.tire_readings = tireReadings
  } else if (localDraft && typeof localDraft === 'object') {
    const local = localDraft as LocalChecklistDraftData
    const fromLocal = Object.values(local.tireReadingsData ?? {}).flat()
    if (fromLocal.length > 0) {
      fromPayload.tire_readings = fromLocal
    }
  }

  if (!localDraft || typeof localDraft !== 'object') {
    return fromPayload
  }

  const localLaneB = localDraftToServerPayload(localDraft)

  if (!fromPayload.security_data && isNonEmptyRecord(localLaneB.security_data)) {
    fromPayload.security_data = localLaneB.security_data
  }
  if (
    !fromPayload.plant_operations_data &&
    isNonEmptyRecord(localLaneB.plant_operations_data)
  ) {
    fromPayload.plant_operations_data = localLaneB.plant_operations_data
  }

  return fromPayload
}

export type ServerDraftPatchResult =
  | { ok: true; draft_updated_at: string | null; draft_payload: ChecklistScheduleDraftPayload }
  | { ok: false; status: number; conflict?: ChecklistScheduleDraftPayload; draft_updated_at?: string | null }

/**
 * PATCH Lane B draft to server with optimistic concurrency.
 * On 409, merges server + local (local wins per section) and retries once.
 */
export async function patchServerDraftWithMerge(
  scheduleId: string,
  localData: unknown,
  options?: {
    accessToken?: string
    clientUpdatedAt?: string | null
    allowRetry?: boolean
  }
): Promise<ServerDraftPatchResult> {
  const localPayload = localDraftToServerPayload(localData)
  if (!hasLaneBDraftData(localPayload)) {
    return { ok: false, status: 400 }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const body: Record<string, unknown> = { draft_payload: localPayload }
  if (options?.clientUpdatedAt) {
    body.draft_updated_at = options.clientUpdatedAt
  }

  const response = await fetch(`/api/checklists/schedules/${scheduleId}/draft`, {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  })

  if (response.status === 409 && options?.allowRetry !== false) {
    const conflict = (await response.json().catch(() => ({}))) as {
      draft_payload?: ChecklistScheduleDraftPayload
      draft_updated_at?: string | null
    }
    const merged = mergeServerAndLocalDraftPayload(
      conflict.draft_payload,
      localData
    )
    if (!hasLaneBDraftData(merged)) {
      return {
        ok: false,
        status: 409,
        conflict: conflict.draft_payload,
        draft_updated_at: conflict.draft_updated_at ?? null,
      }
    }
    return patchServerDraftWithMerge(
      scheduleId,
      {
        ...(typeof localData === 'object' && localData ? localData : {}),
        securityData: merged.security_data,
        plantOperationsData: merged.plant_operations_data,
        serverDraftUpdatedAt: conflict.draft_updated_at ?? null,
      },
      {
        accessToken: options?.accessToken,
        clientUpdatedAt: conflict.draft_updated_at ?? null,
        allowRetry: false,
      }
    )
  }

  if (!response.ok) {
    return { ok: false, status: response.status }
  }

  const data = (await response.json().catch(() => ({}))) as {
    draft_updated_at?: string | null
    draft_payload?: ChecklistScheduleDraftPayload
  }

  return {
    ok: true,
    draft_updated_at: data.draft_updated_at ?? null,
    draft_payload: isChecklistScheduleDraftPayload(data.draft_payload)
      ? data.draft_payload
      : localPayload,
  }
}

export function localDraftHasRestorableData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const local = data as LocalChecklistDraftData

  return (
    isNonEmptyRecord(local.itemStatus) ||
    isNonEmptyRecord(local.securityData) ||
    isNonEmptyRecord(local.plantOperationsData) ||
    isNonEmptyRecord(local.tireReadingsData) ||
    typeof local.notes === 'string' && local.notes.length > 0 ||
    typeof local.technician === 'string' && local.technician.length > 0 ||
    !!local.signature
  )
}

/** Column values to clear a persisted schedule draft (server). */
export function clearedScheduleDraftRowUpdate() {
  return {
    draft_payload: null,
    draft_updated_at: null,
    draft_updated_by: null,
  } as const
}

export type ClearServerScheduleDraftResult =
  | { ok: true }
  | { ok: false; status: number }

/** Remove server draft for a schedule (DELETE /draft). */
export async function clearServerScheduleDraft(
  scheduleId: string,
  options?: { accessToken?: string }
): Promise<ClearServerScheduleDraftResult> {
  const headers: Record<string, string> = {}
  if (options?.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(`/api/checklists/schedules/${scheduleId}/draft`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    return { ok: false, status: response.status }
  }

  return { ok: true }
}

