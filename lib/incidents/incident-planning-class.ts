import {
  incidentEffectiveMs,
  type DateRangeBounds,
  type IncidentDateField,
  type IncidentLike,
} from "@/lib/incidents/incident-date-filter"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"
import { incidentCanonicalKey } from "@/lib/incidents/incident-thread-grouping"

export type PlanningClass = "nuevo" | "reincidente" | "mixto" | "none"

export type PlanningClassInfo = {
  planningClass: PlanningClass
  label: string
  inCohortCount: number
  totalOpenCount: number
  preCohortCount: number
}

function isOpenIncident(status: string | null | undefined): boolean {
  return !isIncidentResolvedForDashboard(status)
}

export function classifyThreadPlanning(
  threadIncidents: Record<string, unknown>[],
  bounds: DateRangeBounds | null,
  dateField: IncidentDateField = "event",
): PlanningClassInfo {
  if (!bounds) {
    return {
      planningClass: "none",
      label: "",
      inCohortCount: 0,
      totalOpenCount: 0,
      preCohortCount: 0,
    }
  }

  const open = threadIncidents.filter((i) =>
    isOpenIncident(String(i.status ?? "")),
  )
  let inCohortCount = 0
  let preCohortCount = 0

  for (const i of open) {
    const ms = incidentEffectiveMs(i as IncidentLike, dateField)
    if (!Number.isFinite(ms)) continue
    if (ms >= bounds.fromMs && ms <= bounds.toMs) inCohortCount += 1
    else if (ms < bounds.fromMs) preCohortCount += 1
  }

  const totalOpenCount = open.length

  if (inCohortCount === 0) {
    return {
      planningClass: "none",
      label: "",
      inCohortCount: 0,
      totalOpenCount,
      preCohortCount,
    }
  }

  if (preCohortCount === 0) {
    return {
      planningClass: "nuevo",
      label: "Nuevo en revisión",
      inCohortCount,
      totalOpenCount,
      preCohortCount: 0,
    }
  }

  if (inCohortCount > 0 && preCohortCount > 0) {
    return {
      planningClass: "mixto",
      label: `${inCohortCount} nuevo${inCohortCount !== 1 ? "s" : ""} · ${preCohortCount} histórico${preCohortCount !== 1 ? "s" : ""}`,
      inCohortCount,
      totalOpenCount,
      preCohortCount,
    }
  }

  return {
    planningClass: "reincidente",
    label: "Reincidente",
    inCohortCount,
    totalOpenCount,
    preCohortCount,
  }
}

export function threadVisibleInPeriod(
  threadIncidents: Record<string, unknown>[],
  bounds: DateRangeBounds | null,
  dateField: IncidentDateField,
  threadDateMode: "thread_in_period" | "occurrences_only",
): boolean {
  if (!bounds) return true

  const anyInRange = threadIncidents.some((i) => {
    const ms = incidentEffectiveMs(i as IncidentLike, dateField)
    return Number.isFinite(ms) && ms >= bounds.fromMs && ms <= bounds.toMs
  })

  if (threadDateMode === "thread_in_period") return anyInRange

  return anyInRange
}

export function filterThreadOccurrencesForDisplay(
  threadIncidents: Record<string, unknown>[],
  bounds: DateRangeBounds | null,
  dateField: IncidentDateField,
  threadDateMode: "thread_in_period" | "occurrences_only",
): Record<string, unknown>[] {
  if (!bounds || threadDateMode === "thread_in_period") return threadIncidents

  return threadIncidents.filter((i) => {
    const ms = incidentEffectiveMs(i as IncidentLike, dateField)
    return Number.isFinite(ms) && ms >= bounds.fromMs && ms <= bounds.toMs
  })
}

export function isOccurrenceInBounds(
  incident: Record<string, unknown>,
  bounds: DateRangeBounds | null,
  dateField: IncidentDateField,
): boolean {
  if (!bounds) return true
  const ms = incidentEffectiveMs(incident as IncidentLike, dateField)
  return Number.isFinite(ms) && ms >= bounds.fromMs && ms <= bounds.toMs
}
