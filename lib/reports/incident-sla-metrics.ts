import { isOpenIncidentStatus } from '@/lib/incidents/incident-routing'

export type SlaMetricKind = 'ack' | 'schedule' | 'resolve' | 'routing'

export type IncidentSlaRow = {
  incident_id: string
  incident_type: string | null
  impact: string | null
  status: string | null
  reported_at: string
  routing_department_id: string | null
  assigned_to_id: string | null
  department_name: string | null
  department_code: string | null
  plant_id: string | null
  routed_at: string | null
  target_response_hours: number | null
  hours_to_acknowledge: number | null
  hours_to_schedule: number | null
  hours_to_resolve: number | null
  sla_target_ack_hours: number
  sla_target_schedule_hours: number
  sla_target_resolve_hours: number
  met_ack_target: boolean | null
  met_schedule_target: boolean | null
  met_resolve_target: boolean | null
  routing_sla_breached: boolean | null
  assignee_name?: string | null
  asset_display_name?: string | null
}

export type SlaKpiSummary = {
  totalIncidents: number
  ackCompliancePct: number | null
  scheduleCompliancePct: number | null
  resolveCompliancePct: number | null
  routingCompliancePct: number | null
  breachCount: number
  medianMttaHours: number | null
  medianMttrHours: number | null
}

export type SlaDepartmentRanking = {
  departmentId: string | null
  departmentName: string
  total: number
  breaches: number
  compliancePct: number | null
}

export type SlaMonthlyTrend = {
  month: string
  total: number
  scheduleCompliancePct: number | null
  resolveCompliancePct: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10
  }
  return sorted[mid]!
}

function compliancePct(rows: IncidentSlaRow[], field: 'met_ack_target' | 'met_schedule_target' | 'met_resolve_target'): number | null {
  const evaluated = rows.filter((row) => row[field] !== null)
  if (evaluated.length === 0) return null
  const met = evaluated.filter((row) => row[field] === true).length
  return Math.round((met / evaluated.length) * 1000) / 10
}

function routingCompliancePct(rows: IncidentSlaRow[]): number | null {
  const evaluated = rows.filter((row) => row.routing_sla_breached !== null)
  if (evaluated.length === 0) return null
  const met = evaluated.filter((row) => row.routing_sla_breached === false).length
  return Math.round((met / evaluated.length) * 1000) / 10
}

export function isSlaBreachedRow(row: IncidentSlaRow, metric: SlaMetricKind): boolean {
  switch (metric) {
    case 'ack':
      return row.met_ack_target === false
    case 'schedule':
      return row.met_schedule_target === false
    case 'resolve':
      return row.met_resolve_target === false
    case 'routing':
      return row.routing_sla_breached === true
    default:
      return false
  }
}

export function aggregateSlaKpis(rows: IncidentSlaRow[]): SlaKpiSummary {
  const mtta = rows
    .map((row) => row.hours_to_acknowledge)
    .filter((value): value is number => value !== null)
  const mttr = rows
    .map((row) => row.hours_to_resolve)
    .filter((value): value is number => value !== null)

  const breachCount = rows.filter(
    (row) =>
      row.met_ack_target === false ||
      row.met_schedule_target === false ||
      row.met_resolve_target === false ||
      row.routing_sla_breached === true,
  ).length

  return {
    totalIncidents: rows.length,
    ackCompliancePct: compliancePct(rows, 'met_ack_target'),
    scheduleCompliancePct: compliancePct(rows, 'met_schedule_target'),
    resolveCompliancePct: compliancePct(rows, 'met_resolve_target'),
    routingCompliancePct: routingCompliancePct(rows),
    breachCount,
    medianMttaHours: median(mtta),
    medianMttrHours: median(mttr),
  }
}

function isDepartmentComplianceMet(row: IncidentSlaRow): boolean {
  const scheduleEvaluated = row.met_schedule_target !== null
  const resolveEvaluated = row.met_resolve_target !== null
  if (!scheduleEvaluated && !resolveEvaluated) return false
  if (scheduleEvaluated && row.met_schedule_target !== true) return false
  if (resolveEvaluated && row.met_resolve_target !== true) return false
  return true
}

export function rankDepartmentsByCompliance(rows: IncidentSlaRow[]): SlaDepartmentRanking[] {
  const byDept = new Map<string, IncidentSlaRow[]>()

  for (const row of rows) {
    const key = row.routing_department_id ?? '__unrouted__'
    const bucket = byDept.get(key) ?? []
    bucket.push(row)
    byDept.set(key, bucket)
  }

  return [...byDept.entries()]
    .map(([departmentId, deptRows]) => {
      const breaches = deptRows.filter(
        (row) =>
          row.met_schedule_target === false ||
          row.met_resolve_target === false,
      ).length
      const evaluated = deptRows.filter(
        (row) => row.met_schedule_target !== null || row.met_resolve_target !== null,
      )
      const met = evaluated.filter(isDepartmentComplianceMet).length
      return {
        departmentId: departmentId === '__unrouted__' ? null : departmentId,
        departmentName: deptRows[0]?.department_name ?? 'Sin departamento',
        total: deptRows.length,
        breaches,
        compliancePct:
          evaluated.length > 0
            ? Math.round((met / evaluated.length) * 1000) / 10
            : null,
      }
    })
    .sort((a, b) => {
      if (a.compliancePct === null && b.compliancePct === null) return b.total - a.total
      if (a.compliancePct === null) return 1
      if (b.compliancePct === null) return -1
      return a.compliancePct - b.compliancePct
    })
}

export function monthlySlaTrend(rows: IncidentSlaRow[]): SlaMonthlyTrend[] {
  const byMonth = new Map<string, IncidentSlaRow[]>()

  for (const row of rows) {
    const month = row.reported_at.slice(0, 7)
    const bucket = byMonth.get(month) ?? []
    bucket.push(row)
    byMonth.set(month, bucket)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRows]) => ({
      month,
      total: monthRows.length,
      scheduleCompliancePct: compliancePct(monthRows, 'met_schedule_target'),
      resolveCompliancePct: compliancePct(monthRows, 'met_resolve_target'),
    }))
}

export function filterBreachedRows(
  rows: IncidentSlaRow[],
  metric: SlaMetricKind | 'any',
): IncidentSlaRow[] {
  if (metric === 'any') {
    return rows.filter(
      (row) =>
        row.met_ack_target === false ||
        row.met_schedule_target === false ||
        row.met_resolve_target === false ||
        row.routing_sla_breached === true,
    )
  }
  return rows.filter((row) => isSlaBreachedRow(row, metric))
}

/** Client-side fallback when incident_sla_compliance view is not yet applied. */
export function computeSlaRowFromIncident(input: {
  id: string
  type?: string | null
  impact?: string | null
  status?: string | null
  created_at?: string | null
  routing_department_id?: string | null
  assigned_to_id?: string | null
  routed_at?: string | null
  target_response_hours?: number | null
  first_wo_created_at?: string | null
  first_planned_at?: string | null
  resolved_at?: string | null
  plant_id?: string | null
  department_name?: string | null
  department_code?: string | null
}): IncidentSlaRow {
  const reportedAt = input.created_at ?? new Date().toISOString()
  const ackAt = input.first_wo_created_at ?? input.routed_at ?? null
  const hoursToAck = ackAt
    ? Math.round(((new Date(ackAt).getTime() - new Date(reportedAt).getTime()) / 3_600_000) * 10) / 10
    : null
  const hoursToSchedule = input.first_planned_at
    ? Math.round(
        ((new Date(input.first_planned_at).getTime() - new Date(reportedAt).getTime()) / 3_600_000) *
          10,
      ) / 10
    : null
  const hoursToResolve = input.resolved_at
    ? Math.round(
        ((new Date(input.resolved_at).getTime() - new Date(reportedAt).getTime()) / 3_600_000) * 10,
      ) / 10
    : null

  const targetAck = impactToAckTarget(input.impact)
  const targetSchedule = impactToScheduleTarget(input.impact)
  const targetResolve = impactToResolveTarget(input.impact)

  const metAck =
    hoursToAck === null ? null : hoursToAck <= targetAck
  const metSchedule =
    hoursToSchedule === null ? null : hoursToSchedule <= targetSchedule
  const metResolve =
    hoursToResolve === null ? null : hoursToResolve <= targetResolve

  let routingBreached: boolean | null = null
  if (input.routed_at && input.target_response_hours) {
    if (isOpenIncidentStatus(input.status)) {
      const elapsed =
        (Date.now() - new Date(input.routed_at).getTime()) / 3_600_000
      routingBreached = elapsed > input.target_response_hours
    } else if (input.resolved_at) {
      const elapsed =
        (new Date(input.resolved_at).getTime() - new Date(input.routed_at).getTime()) / 3_600_000
      routingBreached = elapsed > input.target_response_hours
    }
  }

  return {
    incident_id: input.id,
    incident_type: input.type ?? null,
    impact: input.impact ?? null,
    status: input.status ?? null,
    reported_at: reportedAt,
    routing_department_id: input.routing_department_id ?? null,
    assigned_to_id: input.assigned_to_id ?? null,
    department_name: input.department_name ?? null,
    department_code: input.department_code ?? null,
    plant_id: input.plant_id ?? null,
    routed_at: input.routed_at ?? null,
    target_response_hours: input.target_response_hours ?? null,
    hours_to_acknowledge: hoursToAck,
    hours_to_schedule: hoursToSchedule,
    hours_to_resolve: hoursToResolve,
    sla_target_ack_hours: targetAck,
    sla_target_schedule_hours: targetSchedule,
    sla_target_resolve_hours: targetResolve,
    met_ack_target: metAck,
    met_schedule_target: metSchedule,
    met_resolve_target: metResolve,
    routing_sla_breached: routingBreached,
  }
}

function impactToAckTarget(impact: string | null | undefined): number {
  if (impact === 'Alto') return 8
  if (impact === 'Medio') return 24
  if (impact === 'Bajo') return 48
  return 24
}

function impactToScheduleTarget(impact: string | null | undefined): number {
  if (impact === 'Alto') return 24
  if (impact === 'Medio') return 48
  if (impact === 'Bajo') return 72
  return 48
}

function impactToResolveTarget(impact: string | null | undefined): number {
  if (impact === 'Alto') return 72
  if (impact === 'Medio') return 120
  if (impact === 'Bajo') return 168
  return 168
}
