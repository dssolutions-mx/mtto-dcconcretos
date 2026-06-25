import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_PUNCTUALITY_CONFIG,
  getPunctualitySectionProgress,
  isPunctualitySectionComplete,
  validatePunctualitySectionPayload,
} from './punctuality-validation'

describe('punctuality-validation', () => {
  it('production=false completes without operator entries', () => {
    assert.equal(
      isPunctualitySectionComplete(
        { had_production: false, entries: [] },
        DEFAULT_PUNCTUALITY_CONFIG,
        5
      ),
      true
    )
  })

  it('production=true requires all operators rated', () => {
    const data = {
      had_production: true as const,
      operator_count: 2,
      entries: [
        { operator_id: 'a', status: 'on_time' as const },
        { operator_id: 'b', status: 'late' as const },
      ],
    }
    assert.equal(
      isPunctualitySectionComplete(data, DEFAULT_PUNCTUALITY_CONFIG, 2),
      true
    )
    assert.equal(
      isPunctualitySectionComplete(
        {
          ...data,
          entries: [{ operator_id: 'a', status: 'on_time' as const }],
        },
        DEFAULT_PUNCTUALITY_CONFIG,
        2
      ),
      false
    )
  })

  it('progress skips operator grid when production is false', () => {
    const progress = getPunctualitySectionProgress(
      { had_production: false, entries: [] },
      DEFAULT_PUNCTUALITY_CONFIG
    )
    assert.equal(progress.completed, 1)
    assert.equal(progress.total, 1)
  })

  it('progress caps completed when extra operator ratings exist', () => {
    const progress = getPunctualitySectionProgress(
      {
        had_production: true,
        operator_count: 2,
        entries: [
          { operator_id: 'a', status: 'on_time' as const },
          { operator_id: 'b', status: 'late' as const },
          { operator_id: 'c', status: 'absent' as const },
        ],
      },
      DEFAULT_PUNCTUALITY_CONFIG
    )
    assert.equal(progress.total, 3)
    assert.equal(progress.completed, 3)
  })

  it('validates punctuality payload shape', () => {
    assert.equal(
      validatePunctualitySectionPayload({
        had_production: true,
        operator_count: 1,
        entries: [{ operator_id: 'op-1', status: 'absent', notes: 'Enfermo' }],
      }),
      true
    )
    assert.equal(
      validatePunctualitySectionPayload({
        had_production: true,
        entries: [{ operator_id: 'op-1', status: 'invalid' }],
      }),
      false
    )
  })
})
