import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bonusClosureResourceKey,
  normalizeBonusClosureDecisionsForState,
  normalizeBonusClosureSectionForEmit,
  serializeBonusClosureSectionData,
} from './bonus-closure-section-load'

describe('bonus-closure-section-load', () => {
  it('bonusClosureResourceKey returns null without plant', () => {
    assert.equal(bonusClosureResourceKey(undefined, 2026, 7), null)
    assert.equal(bonusClosureResourceKey(null, 2026, 7), null)
  })

  it('bonusClosureResourceKey encodes plant and period', () => {
    assert.equal(
      bonusClosureResourceKey('plant-1', 2026, 7),
      'plant-1:2026:7'
    )
  })

  it('serializeBonusClosureSectionData is stable for equal payloads', () => {
    const payload = {
      period_year: 2026,
      period_month: 7,
      decisions: [
        {
          operator_id: 'op-1',
          operator_name: 'Juan Pérez',
          weekly_pass_rate: 0.8,
          evaluation_ids: ['e1'],
          system_suggested_eligible: true,
          eligible: true,
        },
      ],
    }
    const a = serializeBonusClosureSectionData(payload)
    const b = serializeBonusClosureSectionData({ ...payload })
    assert.equal(a, b)
  })

  it('normalizeBonusClosureSectionForEmit treats undefined eligible as false', () => {
    const normalized = normalizeBonusClosureSectionForEmit({
      period_year: 2026,
      period_month: 7,
      decisions: [
        {
          operator_id: 'op-1',
          weekly_pass_rate: 0.5,
          evaluation_ids: [],
          system_suggested_eligible: false,
          eligible: undefined as unknown as boolean,
          ineligible_reason: undefined,
        },
      ],
    })
    assert.equal(normalized.decisions[0].eligible, false)
    assert.equal(normalized.decisions[0].ineligible_reason, '')
  })

  it('normalizeBonusClosureDecisionsForState is idempotent', () => {
    const decisions = [
      {
        operator_id: 'op-1',
        operator_name: 'Juan Pérez',
        weekly_pass_rate: 0.8,
        evaluation_ids: ['e1'],
        system_suggested_eligible: true,
        eligible: undefined as unknown as boolean,
      },
    ]
    const once = normalizeBonusClosureDecisionsForState(2026, 7, decisions)
    const twice = normalizeBonusClosureDecisionsForState(2026, 7, once)
    assert.deepEqual(once, twice)
    assert.equal(once[0].eligible, false)
  })
})
