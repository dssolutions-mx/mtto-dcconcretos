import {
  incidentEffectiveMs,
  incidentInDateRange,
  type DateRangeBounds,
  type IncidentDateField,
  type IncidentLike,
} from "@/lib/incidents/incident-date-filter"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"

export type InspectionCohortId = "june_2026_inspection" | "custom"

export type InspectionCohortDef = {
  id: InspectionCohortId
  label: string
  description: string
  fromYmd: string
  toYmd: string
  checklistFrequency?: string
}

export const INSPECTION_COHORTS: Record<InspectionCohortId, InspectionCohortDef> = {
  june_2026_inspection: {
    id: "june_2026_inspection",
    label: "Revisión Jun 2026",
    description: "Inspección mensual — oleada 4–11 jun 2026",
    fromYmd: "2026-06-04",
    toYmd: "2026-06-11",
    checklistFrequency: "mensual",
  },
  custom: {
    id: "custom",
    label: "Periodo personalizado",
    description: "Rango de fechas definido por el usuario",
    fromYmd: "",
    toYmd: "",
  },
}

export function cohortToBounds(cohortId: InspectionCohortId): DateRangeBounds | null {
  const def = INSPECTION_COHORTS[cohortId]
  if (cohortId === "custom" || !def.fromYmd || !def.toYmd) return null
  const startMs = new Date(def.fromYmd + "T06:00:00.000Z").getTime()
  const endMs = new Date(def.toYmd + "T29:59:59.999Z").getTime()
  return {
    fromMs: startMs,
    toMs: endMs,
    fromDate: new Date(startMs),
    toDate: new Date(endMs),
  }
}

export function incidentInCohort(
  incident: IncidentLike,
  bounds: DateRangeBounds,
  dateField: IncidentDateField = "event",
): boolean {
  return incidentInDateRange(incident, bounds, dateField)
}

export type CohortFunnelMetrics = {
  totalInCohort: number
  openInCohort: number
  resolvedInCohort: number
  withWorkOrder: number
  withoutWorkOrder: number
  criticalOpen: number
  closedPct: number
}

export type IncidentWithWo = IncidentLike & {
  status?: string | null
  work_order_id?: string | null
}

export function computeCohortFunnelMetrics(
  incidents: IncidentWithWo[],
  bounds: DateRangeBounds,
  dateField: IncidentDateField = "event",
  nowMs: number = Date.now(),
): CohortFunnelMetrics {
  const inCohort = incidents.filter((i) => incidentInCohort(i, bounds, dateField))
  let openInCohort = 0
  let resolvedInCohort = 0
  let withWorkOrder = 0
  let withoutWorkOrder = 0
  let criticalOpen = 0

  for (const i of inCohort) {
    const resolved = isIncidentResolvedForDashboard(i.status)
    if (resolved) {
      resolvedInCohort += 1
    } else {
      openInCohort += 1
      const ms = incidentEffectiveMs(i, dateField)
      if (Number.isFinite(ms)) {
        const days = Math.ceil(Math.abs(nowMs - ms) / (1000 * 60 * 60 * 24))
        if (days >= 7) criticalOpen += 1
      }
    }
    if (i.work_order_id) withWorkOrder += 1
    else withoutWorkOrder += 1
  }

  const totalInCohort = inCohort.length
  const closedPct =
    totalInCohort > 0 ? Math.round((resolvedInCohort / totalInCohort) * 100) : 0

  return {
    totalInCohort,
    openInCohort,
    resolvedInCohort,
    withWorkOrder,
    withoutWorkOrder,
    criticalOpen,
    closedPct,
  }
}
