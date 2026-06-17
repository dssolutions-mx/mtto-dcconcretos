import { describe, expect, it } from 'vitest'
import {
  aggregateSlaKpis,
  computeSlaRowFromIncident,
  filterBreachedRows,
  rankDepartmentsByCompliance,
} from '@/lib/reports/incident-sla-metrics'

describe('incident-sla-metrics', () => {
  it('computes MTTA and schedule compliance from incident timestamps', () => {
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

    expect(row.hours_to_acknowledge).toBe(1)
    expect(row.hours_to_schedule).toBe(12)
    expect(row.met_ack_target).toBe(true)
    expect(row.met_schedule_target).toBe(true)
  })

  it('aggregates compliance KPIs and breach count', () => {
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
    expect(kpis.totalIncidents).toBe(2)
    expect(kpis.ackCompliancePct).toBe(50)
    expect(kpis.breachCount).toBeGreaterThan(0)

    const breached = filterBreachedRows(rows, 'ack')
    expect(breached).toHaveLength(1)
    expect(breached[0]?.incident_id).toBe('a')

    const ranking = rankDepartmentsByCompliance(rows)
    expect(ranking[0]?.departmentName).toBe('MANT')
    expect(ranking[0]?.total).toBe(2)
  })
})
