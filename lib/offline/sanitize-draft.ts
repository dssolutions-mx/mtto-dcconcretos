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
      section.evidence = section.evidence
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

  return draft
}
