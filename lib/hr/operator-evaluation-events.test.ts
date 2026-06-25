import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildBonusClosureEventRows,
  buildCleanlinessWeeklyEventRow,
  buildPunctualityEventRows,
  buildSecurityTalkEventRows,
  writeAllOperatorEvaluationEvents,
  writeBonusClosureEvents,
  writePunctualityEvents,
  type OperatorEvaluationCompletion,
} from './operator-evaluation-events'

const completion: OperatorEvaluationCompletion = {
  id: 'completion-1',
  schedule_id: 'schedule-1',
  event_date: '2026-06-25',
  asset_id: 'asset-1',
  template_version_id: 'tv-1',
}

const plantId = 'plant-1'

describe('operator-evaluation-events builders', () => {
  it('buildPunctualityEventRows — one row per rated operator', () => {
    const rows = buildPunctualityEventRows(plantId, completion, {
      'section-p': {
        had_production: true,
        entries: [
          { operator_id: 'op-1', status: 'on_time' },
          { operator_id: 'op-2', status: 'late', notes: 'Tarde 10 min' },
        ],
      },
    })

    assert.equal(rows.length, 2)
    assert.equal(rows[0].event_type, 'punctuality')
    assert.equal(rows[0].status, 'on_time')
    assert.equal(rows[1].operator_id, 'op-2')
    assert.equal(rows[1].reason, 'Tarde 10 min')
    assert.equal(rows[0].source_completion_id, 'completion-1')
  })

  it('buildPunctualityEventRows — skips when no production', () => {
    const rows = buildPunctualityEventRows(plantId, completion, {
      'section-p': {
        had_production: false,
        entries: [{ operator_id: 'op-1', status: 'on_time' }],
      },
    })
    assert.equal(rows.length, 0)
  })

  it('buildBonusClosureEventRows — eligible and ineligible decisions', () => {
    const rows = buildBonusClosureEventRows(plantId, completion, {
      'section-b': {
        period_year: 2026,
        period_month: 6,
        decisions: [
          {
            operator_id: 'op-1',
            weekly_pass_rate: 0.9,
            evaluation_ids: ['e1'],
            system_suggested_eligible: true,
            eligible: true,
          },
          {
            operator_id: 'op-2',
            weekly_pass_rate: 0.5,
            evaluation_ids: ['e2'],
            system_suggested_eligible: false,
            eligible: false,
            ineligible_reason: 'Bajo cumplimiento',
          },
        ],
      },
    })

    assert.equal(rows.length, 2)
    assert.equal(rows[0].event_type, 'cleanliness_closure')
    assert.equal(rows[0].status, 'eligible')
    assert.equal(rows[0].period_year, 2026)
    assert.equal(rows[1].status, 'ineligible')
    assert.equal(rows[1].reason, 'Bajo cumplimiento')
  })

  it('buildSecurityTalkEventRows — plant manager attendees', () => {
    const rows = buildSecurityTalkEventRows(plantId, completion, {
      'section-s': {
        attendees: ['op-1', 'op-2'],
        topic: 'EPP',
      },
    })

    assert.equal(rows.length, 2)
    assert.equal(rows[0].event_type, 'security_talk')
    assert.equal(rows[0].status, 'attended')
    assert.deepEqual(rows.map((r) => r.operator_id), ['op-1', 'op-2'])
  })

  it('buildSecurityTalkEventRows — operator mode uses primary operator', () => {
    const rows = buildSecurityTalkEventRows(
      plantId,
      completion,
      { 'section-s': { attendance: true, topic: 'Velocidad' } },
      'primary-op'
    )

    assert.equal(rows.length, 1)
    assert.equal(rows[0].operator_id, 'primary-op')
  })

  it('buildCleanlinessWeeklyEventRow — pass/fail from evaluation', () => {
    const passRow = buildCleanlinessWeeklyEventRow(
      plantId,
      completion,
      'op-1',
      {
        passed_both: true,
        overall_score: 100,
        interior_status: 'pass',
        exterior_status: 'pass',
      },
      []
    )
    assert.equal(passRow.event_type, 'cleanliness_weekly')
    assert.equal(passRow.status, 'pass')

    const failRow = buildCleanlinessWeeklyEventRow(
      plantId,
      completion,
      'op-1',
      {
        passed_both: false,
        overall_score: 50,
        interior_status: 'fail',
        exterior_status: 'pass',
      },
      []
    )
    assert.equal(failRow.status, 'fail')
  })
})

function mockSupabaseForReplace(): {
  supabase: SupabaseClient
  deleted: Array<{ completionId: string; eventType: string }>
  inserted: unknown[]
} {
  const deleted: Array<{ completionId: string; eventType: string }> = []
  const inserted: unknown[] = []

  const supabase = {
    from(table: string) {
      assert.equal(table, 'operator_evaluation_events')
      return {
        delete() {
          return {
            eq(field: string, value: string) {
              if (field === 'source_completion_id') {
                const completionId = value
                return {
                  eq(field2: string, eventType: string) {
                    assert.equal(field2, 'event_type')
                    deleted.push({ completionId, eventType })
                    return Promise.resolve({ error: null })
                  },
                }
              }
              return Promise.resolve({ error: null })
            },
          }
        },
        insert(rows: unknown) {
          inserted.push(rows)
          return Promise.resolve({ error: null })
        },
      }
    },
  } as unknown as SupabaseClient

  return { supabase, deleted, inserted }
}

describe('operator-evaluation-events writers', () => {
  it('writePunctualityEvents — delete+insert idempotent per type', async () => {
    const { supabase, deleted, inserted } = mockSupabaseForReplace()

    const count = await writePunctualityEvents(supabase, completion, {
      'section-p': {
        had_production: true,
        entries: [{ operator_id: 'op-1', status: 'absent' }],
      },
    }, plantId)

    assert.equal(count, 1)
    assert.deepEqual(deleted, [
      { completionId: 'completion-1', eventType: 'punctuality' },
    ])
    assert.equal(Array.isArray(inserted[0]) ? inserted[0].length : 0, 1)
  })

  it('writeBonusClosureEvents — returns 0 when no plant', async () => {
    const { supabase } = mockSupabaseForReplace()
    const count = await writeBonusClosureEvents(supabase, completion, {}, '')
    assert.equal(count, 0)
  })

  it('writeAllOperatorEvaluationEvents — aggregates counts', async () => {
    const deleted: string[] = []
    const supabase = {
      from(table: string) {
        if (table === 'operator_evaluation_events') {
          return {
            delete: () => ({
              eq: () => ({
                eq: (_f: string, eventType: string) => {
                  deleted.push(eventType)
                  return Promise.resolve({ error: null })
                },
              }),
            }),
            insert: () => Promise.resolve({ error: null }),
          }
        }
        if (table === 'asset_operators_full') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ operator_id: 'primary-op', assignment_type: 'primary' }],
                    error: null,
                  }),
              }),
            }),
          }
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }
      },
    } as unknown as SupabaseClient

    const result = await writeAllOperatorEvaluationEvents(supabase, {
      completion,
      plantId,
      plantOperationsData: {
        'section-p': {
          had_production: true,
          entries: [{ operator_id: 'op-1', status: 'on_time' }],
        },
      },
      securityData: {
        'section-s': { attendees: ['op-2'] },
      },
      completedItems: [],
    })

    assert.equal(result.byType.punctuality, 1)
    assert.equal(result.byType.security_talk, 1)
    assert.ok(deleted.includes('punctuality'))
    assert.ok(deleted.includes('security_talk'))
  })
})
