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
    completed_items: data.completed_items,
    technician: data.technician,
    notes: data.notes ?? null,
    signature: data.signature ?? data.signature_data ?? null,
    hours_reading: data.hours_reading ?? null,
    kilometers_reading: data.kilometers_reading ?? null,
    evidence_data: data.evidence_data ?? {},
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
