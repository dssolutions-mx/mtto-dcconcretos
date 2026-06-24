import { db } from "./db"
import { syncAssetCreate, drainPendingAssetFiles } from "./sync-handlers/asset"
import { syncChecklistComplete } from "./sync-handlers/checklist"
import { syncCorrectiveWorkOrder } from "./sync-handlers/work-order"
import {
  drainPendingDieselPhotos,
  syncDieselTransaction,
} from "./sync-handlers/diesel"
import { drainPendingPhotos } from "./sync-handlers/photos"
import { scheduleOutboxRetry } from "./sync-scheduler"
import type { OutboxEntry } from "./types"

async function processOutboxEntry(entry: OutboxEntry, accessToken?: string): Promise<void> {
  if (entry.domain === "checklist" && entry.operation === "complete") {
    await syncChecklistComplete(entry, accessToken)
    return
  }
  if (entry.domain === "checklist" && entry.operation === "work_order") {
    await syncCorrectiveWorkOrder(entry, accessToken)
    return
  }
  if (entry.domain === "diesel" && entry.operation === "transaction") {
    await syncDieselTransaction(entry, accessToken)
    return
  }
  if (entry.domain === "asset" && entry.operation === "create") {
    await syncAssetCreate(entry, accessToken)
    return
  }
  throw new Error(`Unsupported outbox operation: ${entry.domain}/${entry.operation}`)
}

async function drainOutbox(accessToken?: string): Promise<void> {
  const now = Date.now()
  const retryable = await db.outbox
    .where("status")
    .anyOf(["pending", "failed"])
    .filter((entry) => entry.nextAttemptAt <= now)
    .sortBy("createdAt")

  for (const entry of retryable) {
    await db.outbox.update(entry.id, { status: "in_flight" })

    try {
      await processOutboxEntry(entry, accessToken)
      await db.outbox.delete(entry.id)
    } catch (error) {
      const latest = await db.outbox.get(entry.id)
      if (latest) {
        await scheduleOutboxRetry(latest, error)
      }
    }
  }
}

/** Fallback when the dedicated sync Web Worker cannot start. */
export async function drainOutboxOnMainThread(accessToken?: string): Promise<void> {
  await drainPendingPhotos(accessToken)
  await drainPendingDieselPhotos(accessToken)
  await drainPendingAssetFiles(accessToken)
  await drainOutbox(accessToken)
}
