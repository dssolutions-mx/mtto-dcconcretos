/**
 * Strip non-cloneable / ephemeral values before persisting checklist drafts to IndexedDB.
 * Blob URLs, data URLs, File, and Blob objects cause DataCloneError in IDB.
 */

export function isPersistablePhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false
  return url.startsWith('http://') || url.startsWith('https://')
}

export function stripEphemeralEvidenceFields<T extends Record<string, unknown>>(
  item: T
): T {
  const {
    file: _file,
    preview: _preview,
    blob: _blob,
    compressedBlob: _compressedBlob,
    ...rest
  } = item as T & {
    file?: unknown
    preview?: unknown
    blob?: unknown
    compressedBlob?: unknown
  }

  const out = { ...rest } as T & { photo_url?: string }
  if (typeof out.photo_url === 'string' && !isPersistablePhotoUrl(out.photo_url)) {
    delete out.photo_url
  }
  return out as T
}

export function sanitizeEvidenceMapForStorage(
  evidenceData: unknown
): Record<string, Array<Record<string, unknown>>> {
  if (!evidenceData || typeof evidenceData !== 'object') return {}

  const out: Record<string, Array<Record<string, unknown>>> = {}
  for (const [sectionId, items] of Object.entries(
    evidenceData as Record<string, unknown>
  )) {
    if (!Array.isArray(items)) continue
    out[sectionId] = items
      .map((item) =>
        item && typeof item === 'object'
          ? stripEphemeralEvidenceFields(item as Record<string, unknown>)
          : null
      )
      .filter((item): item is Record<string, unknown> => {
        if (!item) return false
        return (
          isPersistablePhotoUrl(item.photo_url) ||
          typeof item.photo_id === 'string' ||
          typeof item.photoId === 'string'
        )
      })
  }
  return out
}

function sanitizeEvidenceArray(items: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(items)) return []
  return items
    .map((item) =>
      item && typeof item === 'object'
        ? stripEphemeralEvidenceFields(item as Record<string, unknown>)
        : null
    )
    .filter((item): item is Record<string, unknown> => {
      if (!item) return false
      return (
        isPersistablePhotoUrl(item.photo_url) ||
        typeof item.photo_id === 'string' ||
        typeof item.photoId === 'string'
      )
    })
}

export function sanitizeSecurityTalkDataForStorage(
  data: unknown
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}

  const out: Record<string, unknown> = {}
  for (const [sectionId, sectionData] of Object.entries(
    data as Record<string, unknown>
  )) {
    if (!sectionData || typeof sectionData !== 'object') continue
    const section = { ...(sectionData as Record<string, unknown>) }

    if (Array.isArray(section.evidence)) {
      section.evidence = sanitizeEvidenceArray(section.evidence)
    }

    out[sectionId] = section
  }
  return out
}

/** Strip blob/data URLs from bonus_closure / punctuality nested in plant_operations_data. */
export function sanitizePlantOperationsDataForStorage(
  data: unknown
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}

  const out: Record<string, unknown> = {}
  for (const [sectionId, sectionData] of Object.entries(
    data as Record<string, unknown>
  )) {
    if (!sectionData || typeof sectionData !== 'object' || Array.isArray(sectionData)) {
      continue
    }

    const section = { ...(sectionData as Record<string, unknown>) }

    if (Array.isArray(section.decisions)) {
      section.decisions = section.decisions.map((decision) => {
        if (!decision || typeof decision !== 'object') return decision
        const row = { ...(decision as Record<string, unknown>) }
        if (Array.isArray(row.evidence)) {
          row.evidence = sanitizeEvidenceArray(row.evidence)
        }
        return row
      })
    }

    if (Array.isArray(section.evidence)) {
      section.evidence = sanitizeEvidenceArray(section.evidence)
    }

    out[sectionId] = section
  }
  return out
}

export function sanitizeLocalChecklistDraft(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}

  const draft = { ...(data as Record<string, unknown>) }
  const checklist = draft.checklist

  if (checklist && typeof checklist === 'object') {
    const c = checklist as Record<string, unknown>
    draft.checklist = {
      id: c.id,
      name: c.name,
      assetId: c.assetId,
      asset: c.asset,
      plantId: c.plantId,
      scheduledDate: c.scheduledDate,
      scheduledDay: c.scheduledDay,
    }
  }

  if (draft.itemPhotos && typeof draft.itemPhotos === 'object') {
    const photos: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(
      draft.itemPhotos as Record<string, unknown>
    )) {
      if (typeof value === 'string' && isPersistablePhotoUrl(value)) {
        photos[key] = value
      } else if (typeof value === 'string' && value.startsWith('photo_')) {
        photos[key] = value
      }
    }
    draft.itemPhotos = photos
  }

  draft.evidenceData = sanitizeEvidenceMapForStorage(draft.evidenceData)
  draft.securityData = sanitizeSecurityTalkDataForStorage(draft.securityData)
  draft.plantOperationsData = sanitizePlantOperationsDataForStorage(
    draft.plantOperationsData
  )

  return draft
}

/** Sanitize checklist completion payload before outbox / API JSON bodies. */
export function sanitizeChecklistCompletePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...payload }

  if (out.evidence_data) {
    out.evidence_data = sanitizeEvidenceMapForStorage(out.evidence_data)
  }

  if (out.security_data) {
    out.security_data = sanitizeSecurityTalkDataForStorage(out.security_data)
  }

  const plantOps = out.plant_operations_data ?? out.plantOperationsData
  if (plantOps) {
    const sanitized = sanitizePlantOperationsDataForStorage(plantOps)
    out.plant_operations_data = sanitized
    delete out.plantOperationsData
  }

  if (Array.isArray(out.completed_items)) {
    out.completed_items = out.completed_items.map((item) => {
      if (!item || typeof item !== 'object') return item
      const row = { ...(item as Record<string, unknown>) }
      if (
        typeof row.photo_url === 'string' &&
        !isPersistablePhotoUrl(row.photo_url) &&
        !String(row.photo_url).startsWith('photo_')
      ) {
        delete row.photo_url
      }
      return row
    })
  }

  return out
}

/** JSON round-trip safe for Dexie structured clone. */
export function cloneForIndexedDb<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
