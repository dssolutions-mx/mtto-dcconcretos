/**
 * Client-side helpers for incident response-time metrics.
 * Mirrors incident_response_metrics view; usable before migration is applied.
 */

export interface IncidentResponseMetrics {
  incidentId: string
  reportedAt: string
  firstWoCreatedAt: string | null
  firstPlannedAt: string | null
  firstAssignedAt: string | null
  resolvedAt: string | null
  targetResponseHours: number
  hoursToWorkOrder: number | null
  hoursToSchedule: number | null
  hoursToResolve: number | null
  metScheduleTarget: boolean | null
}

function hoursBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.round((ms / 3_600_000) * 10) / 10
}

export function computeResponseMetrics(input: {
  id: string
  created_at?: string | null
  first_wo_created_at?: string | null
  first_planned_at?: string | null
  first_assigned_at?: string | null
  resolved_at?: string | null
  target_response_hours?: number | null
  status?: string | null
}): IncidentResponseMetrics {
  const reportedAt = input.created_at ?? new Date().toISOString()
  const targetResponseHours = input.target_response_hours ?? 48
  const hoursToSchedule = hoursBetween(reportedAt, input.first_planned_at)

  let metScheduleTarget: boolean | null = null
  if (input.first_planned_at) {
    const deadline = new Date(reportedAt).getTime() + targetResponseHours * 3_600_000
    metScheduleTarget = new Date(input.first_planned_at).getTime() <= deadline
  }

  return {
    incidentId: input.id,
    reportedAt,
    firstWoCreatedAt: input.first_wo_created_at ?? null,
    firstPlannedAt: input.first_planned_at ?? null,
    firstAssignedAt: input.first_assigned_at ?? null,
    resolvedAt: input.resolved_at ?? null,
    targetResponseHours,
    hoursToWorkOrder: hoursBetween(reportedAt, input.first_wo_created_at),
    hoursToSchedule,
    hoursToResolve: hoursBetween(reportedAt, input.resolved_at),
    metScheduleTarget,
  }
}

export function formatHoursLabel(hours: number | null): string {
  if (hours === null) return "—"
  if (hours < 24) return `${hours}h`
  const days = Math.round((hours / 24) * 10) / 10
  return `${days}d`
}
