import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildOfflineCompleteLaneBFields,
  hasLaneBDraftData,
  localDraftHasRestorableData,
  localDraftToServerPayload,
  clearedScheduleDraftRowUpdate,
  mergeServerAndLocalDraftPayload,
} from './schedule-draft'

describe('schedule-draft helpers', () => {
  it('localDraftToServerPayload maps camelCase Lane B fields', () => {
    const payload = localDraftToServerPayload({
      securityData: { sec1: { attendance: true } },
      plantOperationsData: { ops1: { had_production: false } },
      itemStatus: { item1: 'pass' },
    })

    assert.deepEqual(payload.security_data, { sec1: { attendance: true } })
    assert.deepEqual(payload.plant_operations_data, {
      ops1: { had_production: false },
    })
    assert.equal(payload.completed_items, undefined)
  })

  it('mergeServerAndLocalDraftPayload merges per section with local winning', () => {
    const merged = mergeServerAndLocalDraftPayload(
      {
        security_data: { a: { topic: 'server' }, b: { topic: 'only-server' } },
        plant_operations_data: { x: { had_production: true } },
      },
      {
        securityData: { a: { topic: 'local' }, c: { topic: 'local-only' } },
        plantOperationsData: { x: { had_production: false }, y: { had_production: true } },
      }
    )

    assert.deepEqual(merged.security_data, {
      a: { topic: 'local' },
      b: { topic: 'only-server' },
      c: { topic: 'local-only' },
    })
    assert.deepEqual(merged.plant_operations_data, {
      x: { had_production: false },
      y: { had_production: true },
    })
  })

  it('buildOfflineCompleteLaneBFields fills missing Lane B from local draft', () => {
    const fields = buildOfflineCompleteLaneBFields(
      { schedule_id: 'sched-1', completed_items: [] },
      {
        securityData: { sec: { attendance: true } },
        plantOperationsData: { ops: { had_production: false } },
        tireReadingsData: { tireSec: [{ installation_id: 't1' }] },
      }
    )

    assert.deepEqual(fields.security_data, { sec: { attendance: true } })
    assert.deepEqual(fields.plant_operations_data, {
      ops: { had_production: false },
    })
    assert.deepEqual(fields.tire_readings, [{ installation_id: 't1' }])
  })

  it('buildOfflineCompleteLaneBFields prefers explicit payload fields', () => {
    const fields = buildOfflineCompleteLaneBFields(
      {
        security_data: { sec: { topic: 'payload' } },
        plant_operations_data: { ops: { had_production: true } },
        tire_readings: [{ installation_id: 'from-payload' }],
      },
      {
        securityData: { sec: { topic: 'draft' } },
        tireReadingsData: { tireSec: [{ installation_id: 'from-draft' }] },
      }
    )

    assert.deepEqual(fields.security_data, { sec: { topic: 'payload' } })
    assert.deepEqual(fields.tire_readings, [{ installation_id: 'from-payload' }])
  })

  it('hasLaneBDraftData and localDraftHasRestorableData', () => {
    assert.equal(hasLaneBDraftData({ security_data: { a: {} } }), true)
    assert.equal(hasLaneBDraftData({}), false)
    assert.equal(localDraftHasRestorableData({ plantOperationsData: { s: {} } }), true)
    assert.equal(localDraftHasRestorableData({ timestamp: Date.now() }), false)
  })

  it('clearedScheduleDraftRowUpdate nulls all draft columns', () => {
    assert.deepEqual(clearedScheduleDraftRowUpdate(), {
      draft_payload: null,
      draft_updated_at: null,
      draft_updated_by: null,
    })
  })

  it('mergeServerAndLocalDraftPayload preserves server when local section missing', () => {
    const merged = mergeServerAndLocalDraftPayload(
      {
        plant_operations_data: {
          bonus: {
            period_year: 2026,
            period_month: 6,
            decisions: [{ operator_id: 'op-1', eligible: true }],
          },
        },
      },
      { plantOperationsData: {} }
    )

    assert.deepEqual(merged.plant_operations_data?.bonus, {
      period_year: 2026,
      period_month: 6,
      decisions: [{ operator_id: 'op-1', eligible: true }],
    })
  })
})
