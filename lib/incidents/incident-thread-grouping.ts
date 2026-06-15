import {
  generateCanonicalIssueKey,
  normalizeIssueCoreItem,
} from "@/lib/incidents/normalize-issue-core-item"
import { normalizeStatus } from "@/components/incidents/incidents-status-utils"

export type IncidentThread = {
  canonicalKey: string
  coreItemLabel: string
  incidents: Record<string, unknown>[]
  primaryIncident: Record<string, unknown>
  occurrenceCount: number
  openCount: number
  workOrderId: string | null
  workOrderOrderId: string | null
}

export function incidentCanonicalKey(incident: Record<string, unknown>): string {
  const stored = incident.canonical_issue_key
  if (typeof stored === "string" && stored.length > 0) return stored

  const assetId = typeof incident.asset_id === "string" ? incident.asset_id : ""
  const description = String(incident.description ?? "")
  if (!assetId) return `__no_asset__:${normalizeIssueCoreItem(description)}`
  return generateCanonicalIssueKey(assetId, description)
}

function isOpenIncident(incident: Record<string, unknown>): boolean {
  const status = String(incident.status ?? "")
  if (status === "Consolidado") return false
  return normalizeStatus(status) !== "resolved"
}

export function groupIncidentsIntoThreads(
  incidents: Record<string, unknown>[],
): IncidentThread[] {
  const map = new Map<string, Record<string, unknown>[]>()

  for (const incident of incidents) {
    if (String(incident.status ?? "") === "Consolidado") continue

    const key = incidentCanonicalKey(incident)
    const list = map.get(key) ?? []
    list.push(incident)
    map.set(key, list)
  }

  const threads: IncidentThread[] = []

  for (const [canonicalKey, group] of map) {
    const sorted = [...group].sort((a, b) => {
      const da = new Date(String(a.date ?? a.created_at ?? "")).getTime()
      const db = new Date(String(b.date ?? b.created_at ?? "")).getTime()
      return db - da
    })

    const openIncidents = sorted.filter(isOpenIncident)
    const primaryIncident = openIncidents[0] ?? sorted[0]
    const coreItemLabel =
      normalizeIssueCoreItem(String(primaryIncident.description ?? "")) || "—"

    threads.push({
      canonicalKey,
      coreItemLabel,
      incidents: sorted,
      primaryIncident,
      occurrenceCount: sorted.length,
      openCount: openIncidents.length,
      workOrderId:
        typeof primaryIncident.work_order_id === "string"
          ? primaryIncident.work_order_id
          : null,
      workOrderOrderId:
        typeof primaryIncident.work_order_order_id === "string"
          ? primaryIncident.work_order_order_id
          : null,
    })
  }

  return threads.sort((a, b) => {
    if (b.openCount !== a.openCount) return b.openCount - a.openCount
    return b.occurrenceCount - a.occurrenceCount
  })
}
