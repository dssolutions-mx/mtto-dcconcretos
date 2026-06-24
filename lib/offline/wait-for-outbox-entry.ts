import { db } from "./db"
import type { OutboxEntry } from "./types"

export type OutboxWaitResult = "synced" | "failed" | "timeout"

/**
 * Poll until an outbox entry is removed (successful sync) or reaches a terminal failure state.
 */
export async function waitForOutboxEntry(
  entryId: string,
  timeoutMs = 45_000,
  pollMs = 400
): Promise<OutboxWaitResult> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const entry = await db.outbox.get(entryId)
    if (!entry) return "synced"
    if (entry.status === "dead_letter") return "failed"
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  const finalEntry = await db.outbox.get(entryId)
  if (!finalEntry) return "synced"
  if (finalEntry.status === "dead_letter") return "failed"
  return "timeout"
}

export async function getOutboxEntrySummary(entryId: string): Promise<OutboxEntry | undefined> {
  return db.outbox.get(entryId)
}
