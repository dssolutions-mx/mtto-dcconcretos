/**
 * One-time repair for drafts written before Lane B / diesel sanitization (Jun 2026).
 * blob:/data: URLs and non-cloneable fields in Dexie caused DataCloneError on saves.
 */
import { DIESEL_CONSUMPTION_DRAFT_ID } from '@/lib/diesel/diesel-consumption-draft'
import { sanitizeDieselConsumptionDraftForStorage } from '@/lib/diesel/sanitize-diesel-draft'
import { db } from './db'
import { cloneForIndexedDb, sanitizeLocalChecklistDraft } from './sanitize-draft'

const REPAIR_FLAG = 'offline_draft_sanitize_v2'

export async function repairCorruptedChecklistDrafts(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(REPAIR_FLAG) === '1') return
  } catch {
    return
  }

  try {
    const drafts = await db.drafts.toArray()
    for (const draft of drafts) {
      try {
        const sanitized =
          draft.id === DIESEL_CONSUMPTION_DRAFT_ID
            ? cloneForIndexedDb(
                sanitizeDieselConsumptionDraftForStorage(draft.data)
              )
            : cloneForIndexedDb(sanitizeLocalChecklistDraft(draft.data))
        await db.drafts.put({
          ...draft,
          data: sanitized,
          updatedAt: Date.now(),
        })
      } catch (error) {
        console.warn(
          `[offline] removing unrecoverable draft ${draft.scheduleId}:`,
          error
        )
        await db.drafts.delete(draft.id)
      }
    }
    localStorage.setItem(REPAIR_FLAG, '1')
  } catch (error) {
    console.warn('[offline] draft repair migration failed (non-fatal):', error)
  }
}
