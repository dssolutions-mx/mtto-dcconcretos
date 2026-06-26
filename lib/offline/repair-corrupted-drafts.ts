/**
 * One-time repair for checklist drafts written before Lane B sanitization (Jun 2026).
 * The draft-sync launch stored blob:/data: URLs in Dexie and caused DataCloneError on
 * subsequent saves — especially for operators filling security talk / evidence sections.
 */
import { db } from './db'
import { cloneForIndexedDb, sanitizeLocalChecklistDraft } from './sanitize-draft'

const REPAIR_FLAG = 'offline_checklist_draft_sanitize_v1'

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
        const sanitized = cloneForIndexedDb(
          sanitizeLocalChecklistDraft(draft.data)
        )
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
