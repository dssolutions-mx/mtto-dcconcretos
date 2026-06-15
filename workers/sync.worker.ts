/// <reference lib="webworker" />

import { db } from "../lib/offline/db"
import { syncAssetCreate, drainPendingAssetFiles } from "../lib/offline/sync-handlers/asset"
import { syncChecklistComplete } from "../lib/offline/sync-handlers/checklist"
import { syncCorrectiveWorkOrder } from "../lib/offline/sync-handlers/work-order"
import {
  drainPendingDieselPhotos,
  syncDieselTransaction,
} from "../lib/offline/sync-handlers/diesel"
import { drainPendingPhotos } from "../lib/offline/sync-handlers/photos"
import { scheduleOutboxRetry } from "../lib/offline/sync-scheduler"
import { collectSyncStats } from "../lib/offline/stats"
import type { OutboxEntry, SyncStats } from "../lib/offline/types"

type WorkerInboundMessage = {
  type: "DRAIN"
  accessToken?: string
}

type WorkerOutboundMessage = {
  type: "STATS"
  stats: SyncStats
}

declare const self: DedicatedWorkerGlobalScope

let draining = false
let currentAccessToken: string | undefined

async function getStats(): Promise<SyncStats> {
  return collectSyncStats()
}

function postStats(stats: SyncStats): void {
  const message: WorkerOutboundMessage = { type: "STATS", stats }
  self.postMessage(message)
}

async function processOutboxEntry(entry: OutboxEntry): Promise<void> {
  if (entry.domain === "checklist" && entry.operation === "complete") {
    await syncChecklistComplete(entry, currentAccessToken)
    return
  }
  if (entry.domain === "checklist" && entry.operation === "work_order") {
    await syncCorrectiveWorkOrder(entry, currentAccessToken)
    return
  }
  if (entry.domain === "diesel" && entry.operation === "transaction") {
    await syncDieselTransaction(entry, currentAccessToken)
    return
  }
  if (entry.domain === "asset" && entry.operation === "create") {
    await syncAssetCreate(entry, currentAccessToken)
    return
  }
  throw new Error(`Unsupported outbox operation: ${entry.domain}/${entry.operation}`)
}

async function drainOutbox(): Promise<void> {
  const now = Date.now()
  // Drain "failed" alongside "pending": scheduleOutboxRetry flips an entry to
  // "failed" at attempt 3, but it's still mid-retry (cap is MAX_SYNC_ATTEMPTS).
  // If we only drained "pending", failed entries would be stuck forever — never
  // retried by auto-sync or the manual "Sincronizar ahora" button.
  const retryable = await db.outbox
    .where("status")
    .anyOf(["pending", "failed"])
    .filter((entry) => entry.nextAttemptAt <= now)
    .sortBy("createdAt")

  for (const entry of retryable) {
    await db.outbox.update(entry.id, { status: "in_flight" })

    try {
      await processOutboxEntry(entry)
      await db.outbox.delete(entry.id)
    } catch (error) {
      const latest = await db.outbox.get(entry.id)
      if (latest) {
        await scheduleOutboxRetry(latest, error)
      }
    }
  }
}

async function drain(): Promise<void> {
  if (draining) return
  draining = true

  try {
    await drainPendingPhotos(currentAccessToken)
    await drainPendingDieselPhotos(currentAccessToken)
    await drainPendingAssetFiles(currentAccessToken)
    await drainOutbox()
  } finally {
    draining = false
    postStats(await getStats())
  }
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const { type, accessToken } = event.data
  if (type !== "DRAIN") return

  if (accessToken) {
    currentAccessToken = accessToken
  }

  void drain()
}
