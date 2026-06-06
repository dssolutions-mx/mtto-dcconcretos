import type { CorrectiveWorkOrderPayload, OutboxEntry } from "../types"

function asWorkOrderPayload(payload: unknown): CorrectiveWorkOrderPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid corrective work order payload")
  }
  const data = payload as CorrectiveWorkOrderPayload
  if (!data.checklist_id) {
    throw new Error("Missing checklist_id in corrective work order payload")
  }
  if (!data.asset_id) {
    throw new Error("Missing asset_id in corrective work order payload")
  }
  if (!Array.isArray(data.items_with_issues) || data.items_with_issues.length === 0) {
    throw new Error("Missing items_with_issues in corrective work order payload")
  }
  return data
}

export async function syncCorrectiveWorkOrder(
  entry: OutboxEntry,
  accessToken?: string
): Promise<void> {
  const data = asWorkOrderPayload(entry.payload)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": entry.id,
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const body = {
    checklist_id: data.checklist_id,
    asset_id: data.asset_id,
    asset_name: data.asset_name,
    items_with_issues: data.items_with_issues,
    priority: data.priority,
    description: data.description,
    enable_smart_deduplication: true,
    consolidation_window_days: 30,
    consolidation_choices: {},
    offline_created: true,
    allow_manual_override: false,
  }

  const response = await fetch(
    "/api/checklists/generate-corrective-work-order-enhanced",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Corrective work order sync failed (${response.status}): ${errorText}`)
  }
}
