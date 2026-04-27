import { getAssetName, getAssetFullName, getReporterName } from "@/components/incidents/incidents-list-utils"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"

export type LifecycleFilter = "all" | "open" | "resolved"

export type IncidentesPageFilters = {
  assetIdFromUrl: string | null
  /** UUID of plant (from asset.plant_id) or "all" */
  plantFilter: string
  lifecycleFilter: LifecycleFilter
  statusFilter: string
  typeFilter: string
  searchTerm: string
}

function incidentAssetPlantId(incident: Record<string, unknown>): string | null {
  const assets = incident.assets as { plant_id?: string | null } | null | undefined
  const pid = assets?.plant_id
  return typeof pid === "string" && pid.length > 0 ? pid : null
}

export function filterIncidentsForIncidentesPage(
  incidents: Record<string, unknown>[],
  assets: Record<string, unknown>[],
  f: IncidentesPageFilters,
): Record<string, unknown>[] {
  return incidents.filter((incident) => {
    if (f.assetIdFromUrl && incident.asset_id !== f.assetIdFromUrl) return false
    if (f.plantFilter !== "all" && incidentAssetPlantId(incident) !== f.plantFilter) return false
    if (f.lifecycleFilter === "open" && isIncidentResolvedForDashboard(String(incident.status ?? ""))) return false
    if (f.lifecycleFilter === "resolved" && !isIncidentResolvedForDashboard(String(incident.status ?? ""))) return false
    if (f.statusFilter !== "all" && String(incident.status ?? "") !== f.statusFilter) return false
    if (f.typeFilter !== "all" && String(incident.type ?? "") !== f.typeFilter) return false
    if (f.searchTerm.trim()) {
      const q = f.searchTerm.toLowerCase()
      const assetName = getAssetName(incident, assets).toLowerCase()
      const assetFull = getAssetFullName(incident, assets).toLowerCase()
      const reporter = getReporterName(incident).toLowerCase()
      const desc = String(incident.description ?? "").toLowerCase()
      const orderId = incident.work_order_order_id ? String(incident.work_order_order_id) : ""
      if (
        !assetName.includes(q) &&
        !assetFull.includes(q) &&
        !reporter.includes(q) &&
        !desc.includes(q) &&
        !orderId.includes(q)
      )
        return false
    }
    return true
  })
}

const LIFECYCLE_LABELS: Record<LifecycleFilter, string> = {
  all: "Todos",
  open: "Solo abiertos",
  resolved: "Solo resueltos",
}

export function buildIncidentesFilterSummary(
  f: IncidentesPageFilters,
  opts?: { assetLabel?: string | null; plantLabel?: string | null },
): string {
  const parts: string[] = []
  parts.push(`Vista: ${LIFECYCLE_LABELS[f.lifecycleFilter]}`)
  if (f.statusFilter !== "all") parts.push(`Estado: ${f.statusFilter}`)
  if (f.typeFilter !== "all") parts.push(`Tipo: ${f.typeFilter}`)
  if (f.searchTerm.trim()) parts.push(`Búsqueda: ${f.searchTerm.trim()}`)
  if (f.assetIdFromUrl && opts?.assetLabel) parts.push(`Activo (URL): ${opts.assetLabel}`)
  if (f.plantFilter !== "all" && opts?.plantLabel) parts.push(`Planta: ${opts.plantLabel}`)
  return parts.join(" · ")
}
