import test from 'node:test'
import assert from 'node:assert/strict'

import {
  aggregateSlaKpis,
  computeSlaRowFromIncident,
  filterBreachedRows,
  rankDepartmentsByCompliance,
} from '@/lib/reports/incident-sla-metrics'

test('computes MTTA and schedule compliance from incident timestamps', () => {
  const row = computeSlaRowFromIncident({
    id: 'inc-1',
    type: 'Falla',
    impact: 'Alto',
    status: 'Abierto',
    created_at: '2026-06-01T08:00:00.000Z',
    first_wo_created_at: '2026-06-01T09:00:00.000Z',
    first_planned_at: '2026-06-01T20:00:00.000Z',
    target_response_hours: 24,
    routing_department_id: 'dept-1',
    department_name: 'Mantenimiento',
  })

  assert.equal(row.hours_to_acknowledge, 1)
  assert.equal(row.hours_to_schedule, 12)
  assert.equal(row.met_ack_target, true)
  assert.equal(row.met_schedule_target, true)
})

test('Alto impact uses 24h schedule target not target_response_hours', () => {
  const row = computeSlaRowFromIncident({
    id: 'inc-alto',
    impact: 'Alto',
    created_at: '2026-06-01T08:00:00.000Z',
    first_planned_at: '2026-06-02T14:00:00.000Z',
    target_response_hours: 48,
  })

  assert.equal(row.sla_target_schedule_hours, 24)
  assert.equal(row.met_schedule_target, false)
})

test('aggregates compliance KPIs and breach count', () => {
  const rows = [
    computeSlaRowFromIncident({
      id: 'a',
      created_at: '2026-06-01T08:00:00.000Z',
      first_wo_created_at: '2026-06-01T20:00:00.000Z',
      impact: 'Alto',
      routing_department_id: 'd1',
      department_name: 'MANT',
    }),
    computeSlaRowFromIncident({
      id: 'b',
      created_at: '2026-06-01T08:00:00.000Z',
      first_wo_created_at: '2026-06-01T09:00:00.000Z',
      resolved_at: '2026-06-10T08:00:00.000Z',
      impact: 'Bajo',
      routing_department_id: 'd1',
      department_name: 'MANT',
    }),
  ]

  const kpis = aggregateSlaKpis(rows)
  assert.equal(kpis.totalIncidents, 2)
  assert.equal(kpis.ackCompliancePct, 50)
  assert.ok(kpis.breachCount > 0)

  const breached = filterBreachedRows(rows, 'ack')
  assert.equal(breached.length, 1)
  assert.equal(breached[0]?.incident_id, 'a')

  const ranking = rankDepartmentsByCompliance(rows)
  assert.equal(ranking[0]?.departmentName, 'MANT')
  assert.equal(ranking[0]?.total, 2)
})

test('department ranking excludes routing-only breaches', () => {
  const row = computeSlaRowFromIncident({
    id: 'routing-only',
    created_at: '2026-06-01T08:00:00.000Z',
    impact: 'Medio',
    status: 'Abierto',
    routed_at: new Date(Date.now() - 72 * 3_600_000).toISOString(),
    target_response_hours: 24,
    routing_department_id: 'dept-1',
    department_name: 'MANT',
    first_wo_created_at: '2026-06-01T09:00:00.000Z',
    first_planned_at: '2026-06-01T12:00:00.000Z',
  })

  assert.equal(row.routing_sla_breached, true)

  const ranking = rankDepartmentsByCompliance([row])
  assert.equal(ranking[0]?.breaches, 0)
  assert.equal(ranking[0]?.compliancePct, 100)
})
