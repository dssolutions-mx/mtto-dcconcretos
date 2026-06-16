import test from 'node:test'
import assert from 'node:assert/strict'

import {
  aggregateRoutingSignals,
  buildRoutingPatternKey,
  computePatternConfidence,
  extractRoutingKeyword,
  inferSignalKind,
  scoreLearnedRulePriority,
} from './incident-routing-learning'

test('extracts routing keyword from checklist-style descriptions', () => {
  assert.equal(extractRoutingKeyword('FUGA DE ACEITE - EN BUEN ESTADO'), 'fuga de aceite')
})

test('infers correction vs confirm signal kinds', () => {
  assert.equal(inferSignalKind('dept-a', 'dept-b'), 'correction')
  assert.equal(inferSignalKind('dept-a', 'dept-a'), 'confirm')
})

test('builds stable pattern keys', () => {
  const key = buildRoutingPatternKey({
    plant_id: 'plant-1',
    incident_type: 'Falla mecánica',
    description_keyword: 'fuga de aceite',
    chosen_department_id: 'dept-1',
  })
  assert.equal(key, 'plant-1|falla mecánica|*|fuga de aceite|dept-1')
})

test('aggregates repeated decisions into promotable patterns', () => {
  const base = {
    plant_id: 'p1',
    incident_type: 'falla mecánica',
    incident_impact: null,
    description_keyword: 'fuga de aceite',
    chosen_department_id: 'd1',
    chosen_assignee_id: null,
    previous_department_id: null,
    previous_rule_id: null,
  }

  const signals = Array.from({ length: 4 }).map((_, i) => ({
    id: `s${i}`,
    incident_id: `i${i}`,
    signal_kind: i === 0 ? ('correction' as const) : ('confirm' as const),
    created_at: new Date().toISOString(),
    ...base,
  }))

  const patterns = aggregateRoutingSignals(signals)
  assert.equal(patterns.length, 1)
  assert.equal(patterns[0].sample_count, 4)
  assert.equal(patterns[0].ready_to_promote, true)
})

test('scores higher confidence with more confirms', () => {
  const low = computePatternConfidence({
    sample_count: 3,
    correction_count: 2,
    confirm_count: 0,
  })
  const high = computePatternConfidence({
    sample_count: 3,
    correction_count: 0,
    confirm_count: 3,
  })
  assert.ok(high > low)
})

test('prioritizes high-confidence learned rules', () => {
  assert.ok(scoreLearnedRulePriority(0.95, 10) < scoreLearnedRulePriority(0.6, 3))
})
