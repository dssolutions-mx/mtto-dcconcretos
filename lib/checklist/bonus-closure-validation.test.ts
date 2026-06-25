import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_BONUS_CLOSURE_CONFIG,
  buildInitialBonusClosureDecision,
  getBonusClosureSectionProgress,
  isBonusClosureSectionComplete,
  systemSuggestedEligible,
  validateBonusClosureSectionPayload,
} from './bonus-closure-validation'

describe('bonus-closure-validation', () => {
  it('ineligible requires reason', () => {
    const incomplete = {
      period_year: 2026,
      period_month: 6,
      decisions: [
        {
          operator_id: 'op-1',
          weekly_pass_rate: 0.5,
          evaluation_ids: ['eval-1'],
          system_suggested_eligible: false,
          eligible: false,
        },
      ],
    }
    assert.equal(isBonusClosureSectionComplete(incomplete, 1), false)

    const complete = {
      ...incomplete,
      decisions: [
        {
          ...incomplete.decisions[0],
          ineligible_reason: 'Evaluaciones semanales insuficientes',
        },
      ],
    }
    assert.equal(isBonusClosureSectionComplete(complete, 1), true)
  })

  it('eligible decision does not require reason', () => {
    const data = {
      period_year: 2026,
      period_month: 6,
      decisions: [
        {
          operator_id: 'op-1',
          weekly_pass_rate: 0.9,
          evaluation_ids: ['a', 'b'],
          system_suggested_eligible: true,
          eligible: true,
        },
      ],
    }
    assert.equal(isBonusClosureSectionComplete(data, 1), true)
  })

  it('system suggestion uses threshold', () => {
    assert.equal(systemSuggestedEligible(0.79, DEFAULT_BONUS_CLOSURE_CONFIG), false)
    assert.equal(systemSuggestedEligible(0.8, DEFAULT_BONUS_CLOSURE_CONFIG), true)
  })

  it('progress counts completed decisions', () => {
    const progress = getBonusClosureSectionProgress(
      {
        period_year: 2026,
        period_month: 6,
        decisions: [
          {
            operator_id: 'a',
            weekly_pass_rate: 1,
            evaluation_ids: [],
            system_suggested_eligible: true,
            eligible: true,
          },
          {
            operator_id: 'b',
            weekly_pass_rate: 0.5,
            evaluation_ids: [],
            system_suggested_eligible: false,
            eligible: false,
          },
        ],
      },
      2
    )
    assert.equal(progress.completed, 1)
    assert.equal(progress.total, 2)
  })

  it('validates bonus closure payload shape', () => {
    assert.equal(
      validateBonusClosureSectionPayload({
        period_year: 2026,
        period_month: 6,
        decisions: [
          {
            operator_id: 'op-1',
            weekly_pass_rate: 0.75,
            evaluation_ids: ['e1'],
            system_suggested_eligible: false,
            eligible: false,
            ineligible_reason: 'No cumple umbral',
          },
        ],
      }),
      true
    )
    assert.equal(
      validateBonusClosureSectionPayload({
        period_year: 2026,
        period_month: 6,
        decisions: [
          {
            operator_id: 'op-1',
            weekly_pass_rate: 0.75,
            evaluation_ids: [],
            system_suggested_eligible: false,
            eligible: false,
          },
        ],
      }),
      false
    )
  })

  it('buildInitialBonusClosureDecision pre-fills from pass rate', () => {
    const decision = buildInitialBonusClosureDecision(
      { id: 'op-1', nombre: 'Juan', apellido: 'Pérez', employee_code: 'OP01' },
      { weekly_pass_rate: 0.85, evaluation_ids: ['e1', 'e2'] },
      DEFAULT_BONUS_CLOSURE_CONFIG
    )
    assert.equal(decision.system_suggested_eligible, true)
    assert.equal(decision.eligible, true)
    assert.deepEqual(decision.evaluation_ids, ['e1', 'e2'])
  })
})
