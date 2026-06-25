import {
  buildOfflineCompleteLaneBFields,
  hasLaneBDraftData,
  localDraftToServerPayload,
  patchServerDraftWithMerge,
  type LocalChecklistDraftData,
} from "@/lib/checklist/schedule-draft"
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
  security_data?: Record<string, unknown>
  securityData?: Record<string, unknown>
  plant_operations_data?: Record<string, unknown>
  plantOperationsData?: Record<string, unknown>
  tire_readings?: unknown[]
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

async function pushServerDraftIfNeeded(
  scheduleId: string,
  localDraft: unknown,
  accessToken?: string
): Promise<void> {
  const draftPayload = localDraftToServerPayload(localDraft)
  if (!hasLaneBDraftData(draftPayload)) return

  const local = localDraft as LocalChecklistDraftData
  const resolvedPlantOps = await resolvePlantOperationsPhotoUrls(
    draftPayload.plant_operations_data
  )
  const dataForSync = {
    ...(typeof localDraft === "object" && localDraft ? localDraft : {}),
    plantOperationsData:
      resolvedPlantOps ?? local.plantOperationsData,
  }

  try {
    const result = await patchServerDraftWithMerge(scheduleId, dataForSync, {
      accessToken,
      clientUpdatedAt: local.serverDraftUpdatedAt ?? undefined,
    })

    if (result.ok) {
      const existing = await db.drafts.get(scheduleId)
      if (existing?.data && typeof existing.data === "object") {
        await db.drafts.put({
          ...existing,
          data: {
            ...(existing.data as LocalChecklistDraftData),
            serverDraftUpdatedAt: result.draft_updated_at,
            plantOperationsData:
              result.draft_payload.plant_operations_data ??
              (existing.data as LocalChecklistDraftData).plantOperationsData,
            securityData:
              result.draft_payload.security_data ??
              (existing.data as LocalChecklistDraftData).securityData,
          },
          updatedAt: Date.now(),
        })
      }
      return
    }

    if (result.status !== 409) {
      console.warn("[offline-sync] server draft PATCH failed:", result.status)
    }
  } catch (error) {
    console.warn("[offline-sync] server draft PATCH failed (non-fatal):", error)
  }
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

/** Resolve bonus_closure evidence photos stored offline in plant_operations_data. */
async function resolvePlantOperationsPhotoUrls(
  plantOps: Record<string, unknown> | undefined
): Promise<Record<string, unknown> | undefined> {
  if (!plantOps || typeof plantOps !== "object") return plantOps

  const resolved: Record<string, unknown> = {}

  for (const [sectionId, sectionData] of Object.entries(plantOps)) {
    if (!sectionData || typeof sectionData !== "object" || Array.isArray(sectionData)) {
      resolved[sectionId] = sectionData
      continue
    }

    const section = sectionData as {
      decisions?: Array<{
        evidence?: Array<
          { photoId?: string; preview?: string; photo_url?: string } & Record<
            string,
            unknown
          >
        >
      } & Record<string, unknown>>
    }

    if (!Array.isArray(section.decisions)) {
      resolved[sectionId] = sectionData
      continue
    }

    resolved[sectionId] = {
      ...section,
      decisions: await Promise.all(
        section.decisions.map(async (decision) => {
          if (!Array.isArray(decision.evidence)) return decision
          return {
            ...decision,
            evidence: await Promise.all(
              decision.evidence.map(async (item) => {
                if (!item?.photoId) return item
                const photo = await db.photos.get(item.photoId)
                if (photo?.uploaded && photo.uploadUrl) {
                  const { preview: _preview, ...rest } = item
                  return { ...rest, photo_url: photo.uploadUrl }
                }
                return item
              })
            ),
          }
        })
      ),
    }
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
  const localDraftEntry = await db.drafts.get(data.schedule_id)
  const localDraft = localDraftEntry?.data

  if (localDraft) {
    await pushServerDraftIfNeeded(data.schedule_id, localDraft, accessToken)
  }

  const laneBFields = buildOfflineCompleteLaneBFields(
    data as Record<string, unknown>,
    localDraft
  )

  const resolvedPlantOps = await resolvePlantOperationsPhotoUrls(
    laneBFields.plant_operations_data
  )
  if (resolvedPlantOps) {
    laneBFields.plant_operations_data = resolvedPlantOps
  }

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
    ...(laneBFields.security_data
      ? { security_data: laneBFields.security_data }
      : {}),
    ...(laneBFields.plant_operations_data
      ? { plant_operations_data: laneBFields.plant_operations_data }
      : {}),
    ...(laneBFields.tire_readings?.length
      ? { tire_readings: laneBFields.tire_readings }
      : {}),
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

  // Operator evaluation events are written server-side on successful complete.
  await db.drafts.delete(data.schedule_id)
}
