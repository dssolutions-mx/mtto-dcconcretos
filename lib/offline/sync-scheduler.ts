import { db } from "./db"
import type { OutboxEntry } from "./types"

export const MAX_SYNC_ATTEMPTS = 10
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 5 * 60 * 1000

export function computeBackoffMs(attemptCount: number): number {
  const backoff = BASE_BACKOFF_MS * 2 ** attemptCount
  return Math.min(backoff, MAX_BACKOFF_MS)
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export async function scheduleOutboxRetry(
  entry: OutboxEntry,
  error: unknown
): Promise<void> {
  const attemptCount = entry.attemptCount + 1
  const lastError = formatError(error)

  if (attemptCount >= MAX_SYNC_ATTEMPTS) {
    await db.outbox.update(entry.id, {
      status: "dead_letter",
      attemptCount,
      lastError,
    })
    return
  }

  await db.outbox.update(entry.id, {
    status: attemptCount >= 3 ? "failed" : "pending",
    attemptCount,
    nextAttemptAt: Date.now() + computeBackoffMs(attemptCount),
    lastError,
  })
}
