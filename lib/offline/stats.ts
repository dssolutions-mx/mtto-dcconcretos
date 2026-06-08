import { db } from "./db"
import type { SyncStats } from "./types"

/** Matches MAX_PHOTO_RETRIES / MAX_FILE_RETRIES in the sync handlers. */
export const MAX_FILE_RETRIES = 5

/**
 * File-upload queues hold their own state (`uploaded` + `retryCount`) separate
 * from the outbox. Not-uploaded entries under the retry cap are still pending;
 * those at/over the cap are exhausted (the drain loops skip them).
 */
async function countFileQueue(exhausted: boolean): Promise<number> {
  const tables = [db.photos, db.diesel_photos, db.asset_files]
  let count = 0
  for (const table of tables) {
    count += await table
      .filter((entry) => {
        const e = entry as unknown as { uploaded: boolean; retryCount?: number }
        if (e.uploaded) return false
        const retries = e.retryCount ?? 0
        return exhausted ? retries >= MAX_FILE_RETRIES : retries < MAX_FILE_RETRIES
      })
      .count()
  }
  return count
}

/**
 * Single source of truth for the sync badge. Counts the outbox AND the separate
 * file-upload queues (checklist evidence, diesel photos, asset files), so the
 * badge can't read "todo sincronizado" while evidence photos are still queued or
 * have exhausted their retries. dead_letter / retry-exhausted entries are folded
 * into `failed` so they stay visible instead of silently disappearing.
 */
export async function collectSyncStats(): Promise<SyncStats> {
  const [pendingOutbox, failedOutbox, inFlight, pendingFiles, failedFiles] = await Promise.all([
    db.outbox.where("status").equals("pending").count(),
    db.outbox.where("status").anyOf(["failed", "dead_letter"]).count(),
    db.outbox.where("status").equals("in_flight").count(),
    countFileQueue(false),
    countFileQueue(true),
  ])

  return {
    pending: pendingOutbox + pendingFiles,
    failed: failedOutbox + failedFiles,
    inFlight,
  }
}
