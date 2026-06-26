/**
 * Strip non-persistable photo previews before saving diesel consumption drafts to IndexedDB.
 * Blob/data URLs are display-only; the staging photo in db.diesel_photos is the source of truth.
 */
import { isPersistablePhotoUrl } from '@/lib/offline/sanitize-draft'

export function sanitizeDieselConsumptionDraftForStorage(
  data: unknown
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {}

  const draft = { ...(data as Record<string, unknown>) }

  const preview = draft.machinePhotoPreview
  if (
    typeof preview === 'string' &&
    preview.trim() &&
    !isPersistablePhotoUrl(preview)
  ) {
    draft.machinePhotoPreview = null
  }

  // Never persist checklist Lane B keys if they leaked through shared saveDraft.
  delete draft.evidenceData
  delete draft.securityData
  delete draft.plantOperationsData
  delete draft.checklist
  delete draft.itemPhotos
  delete draft.itemStatus

  return draft
}

export function isEphemeralPhotoPreviewUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false
  return url.startsWith('blob:') || url.startsWith('data:')
}
