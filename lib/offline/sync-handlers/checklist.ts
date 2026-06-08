import { db } from "../db"
import type { OutboxEntry } from "../types"

export interface ChecklistCompletePayload {
  schedule_id: string
  completed_items: unknown[]
  technician: string
  notes?: string | null
  signature?: string | null
  signature_data?: string | null
  hours_reading?: number | null
  kilometers_reading?: number | null
  evidence_data?: Record<string, unknown>
}

function asChecklistPayload(payload: unknown): ChecklistCompletePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid checklist payload")
  }
  const data = payload as ChecklistCompletePayload
  if (!data.schedule_id) {
    throw new Error("Missing schedule_id in checklist payload")
  }
  return data
}

/**
 * Evidence captured offline carries `photo_url` = a base64 preview and a `photoId`
 * pointing at the blob in db.photos. The worker uploads those blobs (drainPendingPhotos)
 * BEFORE draining the outbox, so by the time we send the completion the real storage
 * URL is available. Swap it in (and drop the heavy base64 preview) so the completed
 * checklist stores a proper storage reference instead of an inline blob — and the
 * uploaded file isn't left orphaned.
 */
async function resolveEvidencePhotoUrls(
  evidenceData: Record<string, unknown> | undefined
): Promise<Record<string, unknown>> {
  if (!evidenceData || typeof evidenceData !== "object") return evidenceData ?? {}

  const resolved: Record<string, unknown> = {}
  for (const [sectionId, items] of Object.entries(evidenceData)) {
    if (!Array.isArray(items)) {
      resolved[sectionId] = items
      continue
    }
    resolved[sectionId] = await Promise.all(
      items.map(async (item) => {
        const evidence = item as { photoId?: string; preview?: string } & Record<string, unknown>
        if (!evidence || typeof evidence !== "object" || !evidence.photoId) return item
        const photo = await db.photos.get(evidence.photoId)
        if (photo?.uploaded && photo.uploadUrl) {
          const { preview: _preview, ...rest } = evidence
          return { ...rest, photo_url: photo.uploadUrl }
        }
        return item
      })
    )
  }
  return resolved
}

/**
 * Item-level photos captured offline are persisted to db.photos (keyed by itemId)
 * and carried in completed_items[].photo_url as a base64 preview. The worker uploads
 * those blobs before draining the outbox, so swap the preview for the real storage
 * URL by matching itemId. This also feeds checklist_issues.photo_url server-side.
 */
async function resolveItemPhotoUrls(
  completedItems: unknown[]
): Promise<unknown[]> {
  if (!Array.isArray(completedItems)) return completedItems
  return Promise.all(
    completedItems.map(async (item) => {
      const it = item as { item_id?: string; photo_url?: string } & Record<string, unknown>
      if (!it || typeof it !== "object" || !it.item_id) return item
      if (typeof it.photo_url !== "string" || !it.photo_url.startsWith("data:")) return item
      const photo = await db.photos
        .where("itemId")
        .equals(it.item_id)
        .filter((p) => p.uploaded && !!p.uploadUrl)
        .first()
      if (photo?.uploadUrl) {
        return { ...it, photo_url: photo.uploadUrl }
      }
      return item
    })
  )
}

export async function syncChecklistComplete(
  entry: OutboxEntry,
  accessToken?: string
): Promise<void> {
  const data = asChecklistPayload(entry.payload)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": entry.id,
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const body = {
    completed_items: await resolveItemPhotoUrls(data.completed_items),
    technician: data.technician,
    notes: data.notes ?? null,
    signature: data.signature ?? data.signature_data ?? null,
    hours_reading: data.hours_reading ?? null,
    kilometers_reading: data.kilometers_reading ?? null,
    evidence_data: await resolveEvidencePhotoUrls(data.evidence_data),
  }

  const response = await fetch(
    `/api/checklists/schedules/${data.schedule_id}/complete`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Checklist sync failed (${response.status}): ${errorText}`)
  }
}
