import { NextRequest, NextResponse } from 'next/server'
import { requireReportsApiAccess } from '@/lib/reports/report-api-auth'
import {
  aggregateSlaKpis,
  computeSlaRowFromIncident,
  filterBreachedRows,
  monthlySlaTrend,
  rankDepartmentsByCompliance,
  type IncidentSlaRow,
  type SlaMetricKind,
} from '@/lib/reports/incident-sla-metrics'

const INCIDENT_FALLBACK_SELECT = `
  id,
  type,
  impact,
  status,
  created_at,
  routing_department_id,
  assigned_to_id,
  routed_at,
  target_response_hours,
  first_wo_created_at,
  first_planned_at,
  resolved_at,
  assets ( plant_id ),
  departments:routing_department_id ( name, code )
`

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VALID_BREACH_METRICS = new Set(['any', 'ack', 'schedule', 'resolve', 'routing'])

function parseDateRange(
  searchParams: URLSearchParams,
): { from: string; to: string } | { error: string } {
  const now = new Date()
  const defaultTo = now.toISOString().slice(0, 10)
  const defaultFrom = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10)
  const from = searchParams.get('from') ?? defaultFrom
  const to = searchParams.get('to') ?? defaultTo

  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    return { error: 'Formato de fecha inválido' }
  }

  if (from > to) {
    return { error: 'La fecha inicial debe ser anterior o igual a la final' }
  }

  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const days = (toDate.getTime() - fromDate.getTime()) / 86_400_000
  if (days > 366) {
    return { error: 'El rango de fechas no puede exceder 366 días' }
  }

  return { from, to }
}

async function fetchAssigneeNames(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createClient>>,
  assigneeIds: string[],
): Promise<Map<string, string>> {
  const assigneeMap = new Map<string, string>()
  if (assigneeIds.length === 0) return assigneeMap

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nombre, apellido')
    .in('id', assigneeIds)

  for (const profile of profiles ?? []) {
    assigneeMap.set(
      profile.id,
      `${profile.nombre ?? ''} ${profile.apellido ?? ''}`.trim() || 'Sin nombre',
    )
  }

  return assigneeMap
}

function enrichRowsWithAssigneeNames(
  rows: IncidentSlaRow[],
  assigneeMap: Map<string, string>,
): IncidentSlaRow[] {
  return rows.map((row) => ({
    ...row,
    assignee_name: row.assigned_to_id
      ? assigneeMap.get(row.assigned_to_id) ?? null
      : null,
  }))
}

async function loadSlaRows(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase-server').createClient>>,
  from: string,
  to: string,
  plantId: string | null,
  departmentId: string | null,
): Promise<{ rows: IncidentSlaRow[]; source: 'view' | 'fallback' }> {
  const viewQuery = supabase
    .from('incident_sla_compliance')
    .select('*')
    .gte('reported_at', `${from}T00:00:00.000Z`)
    .lte('reported_at', `${to}T23:59:59.999Z`)

  if (plantId) viewQuery.eq('plant_id', plantId)
  if (departmentId) viewQuery.eq('routing_department_id', departmentId)

  const { data: viewRows, error: viewError } = await viewQuery

  if (!viewError && viewRows) {
    const rows = viewRows as IncidentSlaRow[]
    const assigneeIds = [
      ...new Set(rows.map((row) => row.assigned_to_id).filter(Boolean)),
    ] as string[]
    const assigneeMap = await fetchAssigneeNames(supabase, assigneeIds)
    return { rows: enrichRowsWithAssigneeNames(rows, assigneeMap), source: 'view' }
  }

  console.warn('[incident-sla] view unavailable, using fallback', viewError)

  let fallback = supabase
    .from('incident_history')
    .select(INCIDENT_FALLBACK_SELECT)
    .is('merged_into_id', null)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)

  if (departmentId) fallback = fallback.eq('routing_department_id', departmentId)

  const { data: incidents, error: incidentError } = await fallback
  if (incidentError) throw incidentError

  const assigneeIds = [
    ...new Set((incidents ?? []).map((row) => row.assigned_to_id).filter(Boolean)),
  ] as string[]
  const assigneeMap = await fetchAssigneeNames(supabase, assigneeIds)

  const rows = (incidents ?? [])
    .map((row) => {
      const assets = row.assets as { plant_id?: string } | null
      const departments = row.departments as { name?: string; code?: string } | null
      if (plantId && assets?.plant_id !== plantId) return null
      const computed = computeSlaRowFromIncident({
        id: row.id as string,
        type: row.type as string,
        impact: row.impact as string | null,
        status: row.status as string | null,
        created_at: row.created_at as string,
        routing_department_id: row.routing_department_id as string | null,
        assigned_to_id: row.assigned_to_id as string | null,
        routed_at: row.routed_at as string | null,
        target_response_hours: row.target_response_hours as number | null,
        first_wo_created_at: row.first_wo_created_at as string | null,
        first_planned_at: row.first_planned_at as string | null,
        resolved_at: row.resolved_at as string | null,
        plant_id: assets?.plant_id ?? null,
        department_name: departments?.name ?? null,
        department_code: departments?.code ?? null,
      })
      return {
        ...computed,
        assignee_name: row.assigned_to_id
          ? assigneeMap.get(row.assigned_to_id as string) ?? null
          : null,
      }
    })
    .filter((row): row is IncidentSlaRow => row !== null)

  return { rows, source: 'fallback' }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireReportsApiAccess()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const dateRange = parseDateRange(searchParams)
    if ('error' in dateRange) {
      return NextResponse.json({ error: dateRange.error }, { status: 400 })
    }
    const { from, to } = dateRange

    const plantId = searchParams.get('plantId')
    const departmentId = searchParams.get('departmentId')
    const breachMetric = (searchParams.get('breach') ?? 'any') as SlaMetricKind | 'any'
    const mode = searchParams.get('mode') ?? 'summary'

    if (!VALID_BREACH_METRICS.has(breachMetric)) {
      return NextResponse.json({ error: 'Parámetro breach inválido' }, { status: 400 })
    }

    const { rows, source } = await loadSlaRows(auth.supabase, from, to, plantId, departmentId)

    if (mode === 'breaches') {
      return NextResponse.json({
        from,
        to,
        source,
        rows: filterBreachedRows(rows, breachMetric),
      })
    }

    if (mode === 'export') {
      return NextResponse.json({
        from,
        to,
        source,
        rows,
        kpis: aggregateSlaKpis(rows),
        departments: rankDepartmentsByCompliance(rows),
        trend: monthlySlaTrend(rows),
      })
    }

    return NextResponse.json({
      from,
      to,
      source,
      kpis: aggregateSlaKpis(rows),
      departments: rankDepartmentsByCompliance(rows),
      trend: monthlySlaTrend(rows),
    })
  } catch (error) {
    console.error('[incident-sla]', error)
    return NextResponse.json({ error: 'Error al cargar SLA' }, { status: 500 })
  }
}
