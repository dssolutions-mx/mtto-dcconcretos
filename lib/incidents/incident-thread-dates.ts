import type { IncidentLike } from "@/lib/incidents/incident-date-filter"

/** When the issue was first registered in the system. */
export function incidentCreatedMs(incident: IncidentLike): number {
  const raw = incident.created_at
  if (!raw) return NaN
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : NaN
}

/** When the defect was last observed (business date, fallback to registration). */
export function incidentObservedMs(incident: IncidentLike): number {
  const raw = incident.date ?? incident.created_at
  if (!raw) return NaN
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : NaN
}

export type ThreadDateSummary = {
  firstCreatedMs: number
  latestObservedMs: number
}

export function summarizeThreadDates(
  threadIncidents: Record<string, unknown>[],
): ThreadDateSummary {
  let firstCreatedMs = NaN
  let latestObservedMs = NaN

  for (const row of threadIncidents) {
    const created = incidentCreatedMs(row as IncidentLike)
    const observed = incidentObservedMs(row as IncidentLike)

    if (Number.isFinite(created)) {
      firstCreatedMs = Number.isFinite(firstCreatedMs)
        ? Math.min(firstCreatedMs, created)
        : created
    }
    if (Number.isFinite(observed)) {
      latestObservedMs = Number.isFinite(latestObservedMs)
        ? Math.max(latestObservedMs, observed)
        : observed
    }
  }

  return { firstCreatedMs, latestObservedMs }
}

export function threadHasObservationInBounds(
  threadIncidents: Record<string, unknown>[],
  fromMs: number,
  toMs: number,
): boolean {
  return threadIncidents.some((row) => {
    const ms = incidentObservedMs(row as IncidentLike)
    return Number.isFinite(ms) && ms >= fromMs && ms <= toMs
  })
}
