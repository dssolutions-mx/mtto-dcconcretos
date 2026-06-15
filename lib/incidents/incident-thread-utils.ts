import {
  generateCanonicalIssueKey,
  normalizeIssueCoreItem,
} from "@/lib/incidents/normalize-issue-core-item"

export type IncidentThreadRow = {
  id: string
  asset_id: string | null
  description: string | null
  status: string | null
  date: string | null
  created_at: string | null
  work_order_id: string | null
  type: string | null
  canonical_issue_key?: string | null
  work_order_order_id?: string | null
  core_item?: string
}

export function resolveThreadKey(
  assetId: string,
  description: string | null | undefined,
  storedKey?: string | null,
): string {
  if (storedKey && storedKey.length > 0) return storedKey
  return generateCanonicalIssueKey(assetId, description)
}

export function filterIncidentsToThread(
  incidents: IncidentThreadRow[],
  assetId: string,
  description: string,
  storedKey?: string | null,
): IncidentThreadRow[] {
  const threadKey = resolveThreadKey(assetId, description, storedKey)
  return incidents.filter((row) => {
    if (row.asset_id !== assetId) return false
    if (String(row.status ?? "") === "Consolidado") return false
    const rowKey = resolveThreadKey(assetId, row.description, row.canonical_issue_key)
    return rowKey === threadKey
  })
}

export function pickThreadFromIncidentList(
  allIncidents: Record<string, unknown>[],
  assetId: string,
  description: string,
  storedKey?: string | null,
): IncidentThreadRow[] {
  const rows = allIncidents
    .filter((row) => typeof row.id === "string")
    .map((row) => ({
      id: String(row.id),
      asset_id: typeof row.asset_id === "string" ? row.asset_id : null,
      description: typeof row.description === "string" ? row.description : null,
      status: typeof row.status === "string" ? row.status : null,
      date: typeof row.date === "string" ? row.date : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      work_order_id: typeof row.work_order_id === "string" ? row.work_order_id : null,
      type: typeof row.type === "string" ? row.type : null,
      canonical_issue_key:
        typeof row.canonical_issue_key === "string" ? row.canonical_issue_key : null,
      work_order_order_id:
        typeof row.work_order_order_id === "string" ? row.work_order_order_id : null,
    }))

  return filterIncidentsToThread(rows, assetId, description, storedKey).sort((a, b) => {
    const ta = new Date(String(a.date ?? a.created_at ?? "")).getTime()
    const tb = new Date(String(b.date ?? b.created_at ?? "")).getTime()
    return tb - ta
  })
}

export { normalizeIssueCoreItem }
