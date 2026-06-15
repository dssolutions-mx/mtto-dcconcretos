import { getAssetName, getAssetFullName, getReporterName } from "@/components/incidents/incidents-list-utils"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"
import {
  incidentObservedMs,
  resolveDatePresetBounds,
  type DateRangeBounds,
  type IncidentDatePreset,
} from "@/lib/incidents/incident-date-filter"
import {
  classifyThreadPlanning,
  threadVisibleInPeriod,
  type PlanningClass,
} from "@/lib/incidents/incident-planning-class"
import { groupIncidentsIntoThreads } from "@/lib/incidents/incident-thread-grouping"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"
import { cohortToBounds } from "@/lib/incidents/inspection-cohort"
import { incidentObservedMs } from "@/lib/incidents/incident-thread-dates"

export type LifecycleFilter = "all" | "open" | "resolved"

export type ThreadDateMode = "thread_in_period" | "occurrences_only"

export type WorkOrderFilter = "all" | "with" | "without"

export type PlanningClassFilter = "all" | "nuevo" | "reincidente" | "mixto"

export type IncidentesPageFilters = {
  assetIdFromUrl: string | null
  plantFilter: string
  lifecycleFilter: LifecycleFilter
  statusFilter: string
  typeFilter: string
  searchTerm: string
  /** @deprecated Always uses observation date (date ?? created_at). Kept for URL compat. */
  dateField: "event"
  datePreset: IncidentDatePreset
  fromDate?: Date
  toDate?: Date
  cohortId: InspectionCohortId | null
  threadDateMode: ThreadDateMode
  workOrderFilter: WorkOrderFilter
  planningClassFilter: PlanningClassFilter
  priorityFilter: string
}

export function resolveFilterDateBounds(
  f: Pick<IncidentesPageFilters, "datePreset" | "fromDate" | "toDate" | "cohortId">,
): DateRangeBounds | null {
  if (f.cohortId && f.cohortId !== "custom") {
    return cohortToBounds(f.cohortId)
  }
  if (f.datePreset === "june_2026_inspection") {
    return cohortToBounds("june_2026_inspection")
  }
  return resolveDatePresetBounds(f.datePreset, f.fromDate, f.toDate)
}

function incidentAssetPlantId(incident: Record<string, unknown>): string | null {
  const assets = incident.assets as { plant_id?: string | null } | null | undefined
  const pid = assets?.plant_id
  return typeof pid === "string" && pid.length > 0 ? pid : null
}

function matchesPlanningClassFilter(
  planningClass: PlanningClass | "none",
  filter: PlanningClassFilter,
): boolean {
  if (filter === "all") return true
  if (filter === "nuevo") return planningClass === "nuevo"
  if (filter === "reincidente")
    return planningClass === "reincidente" || planningClass === "mixto"
  if (filter === "mixto") return planningClass === "mixto"
  return true
}

function matchesWorkOrderFilter(
  incident: Record<string, unknown>,
  filter: WorkOrderFilter,
): boolean {
  if (filter === "all") return true
  const hasWo = !!incident.work_order_id
  if (filter === "with") return hasWo
  return !hasWo
}

function matchesPriorityFilter(
  incident: Record<string, unknown>,
  filter: string,
  nowMs: number,
): boolean {
  if (filter === "all") return true
  const status = String(incident.status ?? "")
  if (isIncidentResolvedForDashboard(status)) return filter === "low"

  const dateStr = (incident.date ?? incident.created_at) as string | undefined
  const t = dateStr ? new Date(dateStr).getTime() : NaN
  const days = Number.isFinite(t)
    ? Math.ceil(Math.abs(nowMs - t) / (1000 * 60 * 60 * 24))
    : 0

  if (filter === "critical") return days >= 7
  if (filter === "high") return days >= 3 && days < 7
  if (filter === "medium") return days >= 1 && days < 3
  if (filter === "low") return days < 1
  return true
}

export function filterIncidentsForIncidentesPage(
  incidents: Record<string, unknown>[],
  assets: Record<string, unknown>[],
  f: IncidentesPageFilters,
  nowMs: number = Date.now(),
): Record<string, unknown>[] {
  const bounds = resolveFilterDateBounds(f)
  const hasDateFilter = bounds !== null

  const threadGroups = hasDateFilter
    ? groupIncidentsIntoThreads(
        incidents.filter((i) => String(i.status ?? "") !== "Consolidado"),
      )
    : null

  const visibleThreadKeys = new Set<string>()

  if (threadGroups && bounds) {
    for (const thread of threadGroups) {
      if (
        !threadVisibleInPeriod(
          thread.incidents,
          bounds,
          f.threadDateMode,
        )
      ) {
        continue
      }
      const info = classifyThreadPlanning(thread.incidents, bounds)
      if (!matchesPlanningClassFilter(info.planningClass, f.planningClassFilter)) {
        continue
      }
      visibleThreadKeys.add(thread.canonicalKey)
    }
  }

  return incidents.filter((incident) => {
    if (f.assetIdFromUrl && incident.asset_id !== f.assetIdFromUrl) return false
    if (f.plantFilter !== "all" && incidentAssetPlantId(incident) !== f.plantFilter)
      return false
    if (String(incident.status ?? "") === "Consolidado") return false
    if (
      f.lifecycleFilter === "open" &&
      isIncidentResolvedForDashboard(String(incident.status ?? ""))
    )
      return false
    if (
      f.lifecycleFilter === "resolved" &&
      !isIncidentResolvedForDashboard(String(incident.status ?? ""))
    )
      return false
    if (f.statusFilter !== "all" && String(incident.status ?? "") !== f.statusFilter)
      return false
    if (f.typeFilter !== "all" && String(incident.type ?? "") !== f.typeFilter)
      return false
    if (!matchesWorkOrderFilter(incident, f.workOrderFilter)) return false
    if (!matchesPriorityFilter(incident, f.priorityFilter, nowMs)) return false

    if (bounds) {
      if (threadGroups) {
        const threads = groupIncidentsIntoThreads([incident])
        const key = threads[0]?.canonicalKey
        if (!key || !visibleThreadKeys.has(key)) return false
        if (f.threadDateMode === "occurrences_only") {
          const ms = incidentObservedMs(incident)
          if (!Number.isFinite(ms) || ms < bounds.fromMs || ms > bounds.toMs) return false
        }
      } else {
        const ms = incidentObservedMs(incident)
        if (!Number.isFinite(ms) || ms < bounds.fromMs || ms > bounds.toMs) return false
      }
    }

    if (f.searchTerm.trim()) {
      const q = f.searchTerm.toLowerCase()
      const assetName = getAssetName(incident, assets).toLowerCase()
      const assetFull = getAssetFullName(incident, assets).toLowerCase()
      const reporter = getReporterName(incident).toLowerCase()
      const desc = String(incident.description ?? "").toLowerCase()
      const orderId = incident.work_order_order_id
        ? String(incident.work_order_order_id)
        : ""
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
  if (f.assetIdFromUrl && opts?.assetLabel)
    parts.push(`Activo (URL): ${opts.assetLabel}`)
  if (f.plantFilter !== "all" && opts?.plantLabel)
    parts.push(`Planta: ${opts.plantLabel}`)
  const bounds = resolveFilterDateBounds(f)
  if (bounds) {
    parts.push(
      `Periodo: ${bounds.fromDate.toLocaleDateString("es-MX")} – ${bounds.toDate.toLocaleDateString("es-MX")}`,
    )
  }
  if (f.workOrderFilter === "without") parts.push("Sin OT")
  if (f.workOrderFilter === "with") parts.push("Con OT")
  return parts.join(" · ")
}
