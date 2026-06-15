import type { DateRangeBounds } from "@/lib/incidents/incident-date-filter"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"
import {
  incidentCreatedMs,
  incidentObservedMs,
  summarizeThreadDates,
} from "@/lib/incidents/incident-thread-dates"

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

function isObservedInBounds(
  incident: Record<string, unknown>,
  bounds: DateRangeBounds,
): boolean {
  const ms = incidentObservedMs(incident)
  return Number.isFinite(ms) && ms >= bounds.fromMs && ms <= bounds.toMs
}

export function classifyThreadPlanning(
  threadIncidents: Record<string, unknown>[],
  bounds: DateRangeBounds | null,
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
    const observed = incidentObservedMs(i)
    if (!Number.isFinite(observed)) continue
    if (observed >= bounds.fromMs && observed <= bounds.toMs) inCohortCount += 1
    else if (observed < bounds.fromMs) preCohortCount += 1
  }

  const totalOpenCount = open.length
  const { firstCreatedMs } = summarizeThreadDates(threadIncidents)
  const firstSeenInPeriod =
    Number.isFinite(firstCreatedMs) &&
    firstCreatedMs >= bounds.fromMs &&
    firstCreatedMs <= bounds.toMs

  if (inCohortCount === 0) {
    return {
      planningClass: "none",
      label: "",
      inCohortCount: 0,
      totalOpenCount,
      preCohortCount,
    }
  }

  if (preCohortCount === 0 && firstSeenInPeriod) {
    return {
      planningClass: "nuevo",
      label: "Nuevo en revisión",
      inCohortCount,
      totalOpenCount,
      preCohortCount: 0,
    }
  }

  if (inCohortCount > 0 && (preCohortCount > 0 || !firstSeenInPeriod)) {
    if (preCohortCount > 0) {
      return {
        planningClass: "mixto",
        label: `${inCohortCount} en periodo · ${preCohortCount} histórico${preCohortCount !== 1 ? "s" : ""}`,
        inCohortCount,
        totalOpenCount,
        preCohortCount,
      }
    }
    return {
      planningClass: "reincidente",
      label: "Reaparición en periodo",
      inCohortCount,
      totalOpenCount,
      preCohortCount: 0,
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
  threadDateMode: "thread_in_period" | "occurrences_only",
): boolean {
  if (!bounds) return true

  const anyInRange = threadIncidents.some((i) => isObservedInBounds(i, bounds))
  if (threadDateMode === "thread_in_period") return anyInRange
  return anyInRange
}

export function filterThreadOccurrencesForDisplay(
  threadIncidents: Record<string, unknown>[],
  bounds: DateRangeBounds | null,
  threadDateMode: "thread_in_period" | "occurrences_only",
): Record<string, unknown>[] {
  if (!bounds || threadDateMode === "thread_in_period") return threadIncidents

  return threadIncidents.filter((i) => isObservedInBounds(i, bounds))
}

export function isOccurrenceInBounds(
  incident: Record<string, unknown>,
  bounds: DateRangeBounds | null,
): boolean {
  if (!bounds) return true
  return isObservedInBounds(incident, bounds)
}
