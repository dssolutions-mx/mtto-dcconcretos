import { getAssetName, getAssetFullName } from "@/components/incidents/incidents-list-utils"
import { getDaysSinceCreated, normalizeStatus } from "@/components/incidents/incidents-status-utils"

export type IncidentAssetGroup = {
  assetId: string | null
  assetCode: string
  assetFullName: string
  incidents: Record<string, unknown>[]
  openCount: number
  criticalCount: number
}

function isResolvedStatus(status: string): boolean {
  return normalizeStatus(status) === "resolved"
}

/** Same grouping and sort order as `IncidentsOTLookup` (by asset, then list order). */
export function groupIncidentsForIncidentesLookup(
  incidents: Record<string, unknown>[],
  assets: Record<string, unknown>[],
): IncidentAssetGroup[] {
  const map = new Map<string, IncidentAssetGroup>()

  incidents.forEach((incident) => {
    const assetId = typeof incident.asset_id === "string" ? incident.asset_id : null
    const key = assetId ?? "__no_asset__"
    const assetCode = getAssetName(incident, assets)
    const assetFullName = getAssetFullName(incident, assets)

    if (!map.has(key)) {
      map.set(key, { assetId, assetCode, assetFullName, incidents: [], openCount: 0, criticalCount: 0 })
    }

    const group = map.get(key)!
    group.incidents.push(incident)

    const status = String(incident.status ?? "")
    if (!isResolvedStatus(status)) {
      group.openCount++
      const dateStr = (incident.date ?? incident.created_at) as string | undefined
      if (getDaysSinceCreated(dateStr ?? "") >= 7) group.criticalCount++
    }
  })

  for (const group of map.values()) {
    group.incidents.sort((a, b) => {
      const da = new Date((a.date ?? a.created_at ?? "") as string).getTime()
      const db = new Date((b.date ?? b.created_at ?? "") as string).getTime()
      return db - da
    })
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount
    return b.openCount - a.openCount
  })
}
