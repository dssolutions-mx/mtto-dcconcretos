import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateSecurityTalkOperatorAttendance,
  aggregateSecurityTalkSessions,
  buildFallbackSecurityTalkEventRows,
  computeSecurityTalkSummary,
  hasNonEmptySecurityData,
  mergeSecurityTalkEventRows,
  resolveSecurityTalkEventDate,
  type SecurityTalkEventRow,
  type SecurityTalkProductionDay,
} from './security-talk-reports'

const talkRows: SecurityTalkEventRow[] = [
  {
    id: 'e1',
    operator_id: 'op-a',
    operator_name: 'Ana López',
    employee_code: '001',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-10',
    topic: 'EPP',
    reflection: 'Buena charla',
    evidence: [{ photo_url: 'https://example.com/1.jpg' }],
    source_completion_id: 'comp-1',
  },
  {
    id: 'e2',
    operator_id: 'op-b',
    operator_name: 'Bruno Díaz',
    employee_code: '002',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-10',
    topic: 'EPP',
    reflection: 'Buena charla',
    evidence: [{ photo_url: 'https://example.com/1.jpg' }],
    source_completion_id: 'comp-1',
  },
  {
    id: 'e3',
    operator_id: 'op-a',
    operator_name: 'Ana López',
    employee_code: '001',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-12',
    topic: 'Alturas',
    reflection: null,
    evidence: null,
    source_completion_id: 'comp-2',
  },
]

const productionDays: SecurityTalkProductionDay[] = [
  {
    operator_id: 'op-a',
    operator_name: 'Ana López',
    employee_code: '001',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-10',
  },
  {
    operator_id: 'op-a',
    operator_name: 'Ana López',
    employee_code: '001',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-11',
  },
  {
    operator_id: 'op-a',
    operator_name: 'Ana López',
    employee_code: '001',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-12',
  },
  {
    operator_id: 'op-b',
    operator_name: 'Bruno Díaz',
    employee_code: '002',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-10',
  },
  {
    operator_id: 'op-b',
    operator_name: 'Bruno Díaz',
    employee_code: '002',
    plant_id: 'plant-1',
    plant_name: 'Planta Norte',
    event_date: '2026-06-11',
  },
]

describe('security-talk-reports aggregation', () => {
  it('resolveSecurityTalkEventDate prefers scheduled_day over completion_date', () => {
    assert.equal(
      resolveSecurityTalkEventDate({
        scheduled_day: '2026-06-10',
        scheduled_date: '2026-06-11',
        completion_date: '2026-06-25T18:00:00Z',
      }),
      '2026-06-10'
    )
  })

  it('hasNonEmptySecurityData detects attendees and topic-only payloads', () => {
    assert.equal(
      hasNonEmptySecurityData({
        sec: { attendees: ['op-1'], topic: 'EPP' },
      }),
      true
    )
    assert.equal(hasNonEmptySecurityData({ sec: { topic: 'EPP' } }), true)
    assert.equal(hasNonEmptySecurityData({ sec: {} }), false)
    assert.equal(hasNonEmptySecurityData(null), false)
  })

  it('buildFallbackSecurityTalkEventRows expands completion security_data', () => {
    const rows = buildFallbackSecurityTalkEventRows(
      {
        id: 'comp-fallback',
        schedule_id: 'sched-1',
        asset_id: 'asset-1',
        completion_date: '2026-06-25T12:00:00Z',
        plant_id: 'plant-1',
        scheduled_day: '2026-06-25',
        scheduled_date: null,
        security_data: {
          'section-1': {
            attendees: ['op-a', 'op-b'],
            topic: 'engrasado',
            reflection: 'Buena charla',
          },
        },
      },
      new Map([['plant-1', 'Planta Norte']]),
      new Map([
        ['op-a', { operator_name: 'Ana López', employee_code: '001' }],
        ['op-b', { operator_name: 'Bruno Díaz', employee_code: '002' }],
      ])
    )

    assert.equal(rows.length, 2)
    assert.equal(rows[0].source_completion_id, 'comp-fallback')
    assert.equal(rows[0].topic, 'engrasado')
    assert.equal(rows[0].event_date, '2026-06-25')
    assert.match(rows[0].id, /^fallback:comp-fallback:/)
  })

  it('mergeSecurityTalkEventRows keeps events and fills missing completions', () => {
    const eventRows: SecurityTalkEventRow[] = [
      {
        id: 'event-1',
        operator_id: 'op-a',
        operator_name: 'Ana López',
        employee_code: '001',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
        event_date: '2026-06-10',
        topic: 'EPP',
        reflection: null,
        evidence: null,
        source_completion_id: 'comp-1',
      },
    ]

    const fallbackRows: SecurityTalkEventRow[] = [
      {
        id: 'fallback:comp-2:op-b',
        operator_id: 'op-b',
        operator_name: 'Bruno Díaz',
        employee_code: '002',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
        event_date: '2026-06-12',
        topic: 'Alturas',
        reflection: null,
        evidence: null,
        source_completion_id: 'comp-2',
      },
      {
        id: 'fallback:comp-1:op-a',
        operator_id: 'op-a',
        operator_name: 'Ana López',
        employee_code: '001',
        plant_id: 'plant-1',
        plant_name: 'Planta Norte',
        event_date: '2026-06-10',
        topic: 'EPP',
        reflection: null,
        evidence: null,
        source_completion_id: 'comp-1',
      },
    ]

    const merged = mergeSecurityTalkEventRows(eventRows, fallbackRows)
    assert.equal(merged.length, 2)
    assert.equal(merged.some((row) => row.id === 'event-1'), true)
    assert.equal(merged.some((row) => row.source_completion_id === 'comp-2'), true)
    assert.equal(merged.some((row) => row.id.startsWith('fallback:comp-1')), false)
  })

  it('aggregateSecurityTalkSessions groups attendees by completion', () => {
    const sessions = aggregateSecurityTalkSessions(talkRows)
    assert.equal(sessions.length, 2)
    assert.equal(sessions[0].source_completion_id, 'comp-2')
    assert.equal(sessions[1].attendee_count, 2)
    assert.equal(sessions[1].topic, 'EPP')
    assert.equal(sessions[1].attendees.length, 2)
  })

  it('aggregateSecurityTalkOperatorAttendance computes gaps from production days', () => {
    const operators = aggregateSecurityTalkOperatorAttendance(talkRows, productionDays)
    const ana = operators.find((op) => op.operator_id === 'op-a')
    const bruno = operators.find((op) => op.operator_id === 'op-b')

    assert.ok(ana)
    assert.equal(ana.production_days, 3)
    assert.equal(ana.talks_attended, 2)
    assert.equal(ana.gap_days, 1)
    assert.deepEqual(ana.missed_dates, ['2026-06-11'])

    assert.ok(bruno)
    assert.equal(bruno.production_days, 2)
    assert.equal(bruno.talks_attended, 1)
    assert.equal(bruno.gap_days, 1)
  })

  it('computeSecurityTalkSummary rolls up sessions and operator attendance', () => {
    const sessions = aggregateSecurityTalkSessions(talkRows)
    const operators = aggregateSecurityTalkOperatorAttendance(talkRows, productionDays)
    const summary = computeSecurityTalkSummary(sessions, operators)

    assert.equal(summary.talks_logged, 2)
    assert.equal(summary.unique_production_days_with_talk, 2)
    assert.equal(summary.operators_with_gaps, 2)
    assert.equal(summary.total_production_days, 5)
    assert.equal(summary.attendance_rate_pct, 60)
  })
})
