import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildResolvedLayout,
  defaultResolvedLayout,
  resolvePositionsFromLayout,
} from './layout-resolver'
import {
  DEFAULT_TIRE_POSITIONS,
  TRUCK_6WHEEL_POSITIONS,
  VEHICLE_4WHEEL_POSITIONS,
} from './positions'

test('resolvePositionsFromLayout uses custom positions when provided', () => {
  const custom = [{ code: 'a', label: 'A', axle: 1, side: 'izq' as const }]
  const result = resolvePositionsFromLayout({
    template_key: 'truck_6x4',
    positions: custom,
    svg_variant: 'v1',
  })
  assert.deepEqual(result, custom)
})

test('resolvePositionsFromLayout falls back to truck_6x4 template when positions empty', () => {
  const result = resolvePositionsFromLayout({
    template_key: 'truck_6x4',
    positions: [],
    svg_variant: 'v1',
  })
  assert.deepEqual(result, TRUCK_6WHEEL_POSITIONS)
})

test('resolvePositionsFromLayout uses vehicle_4wheel template', () => {
  const result = resolvePositionsFromLayout({
    template_key: 'vehicle_4wheel',
    positions: [],
    svg_variant: 'v1',
  })
  assert.deepEqual(result, VEHICLE_4WHEEL_POSITIONS)
})

test('resolvePositionsFromLayout custom template with empty positions uses default 6x4', () => {
  const result = resolvePositionsFromLayout({
    template_key: 'custom',
    positions: [],
    svg_variant: 'v1',
  })
  assert.deepEqual(result, DEFAULT_TIRE_POSITIONS)
})

test('buildResolvedLayout marks source as model', () => {
  const resolved = buildResolvedLayout(
    { template_key: 'vehicle_4wheel', positions: [], svg_variant: 'v2' },
    'model-uuid'
  )
  assert.equal(resolved.source, 'model')
  assert.equal(resolved.model_id, 'model-uuid')
  assert.equal(resolved.template_key, 'vehicle_4wheel')
  assert.equal(resolved.svg_variant, 'v2')
  assert.equal(resolved.positions.length, 4)
})

test('defaultResolvedLayout returns 6x4 fallback without crash', () => {
  const resolved = defaultResolvedLayout()
  assert.equal(resolved.source, 'default')
  assert.equal(resolved.model_id, null)
  assert.equal(resolved.template_key, 'truck_6x4')
  assert.deepEqual(resolved.positions, DEFAULT_TIRE_POSITIONS)
  assert.equal(resolved.positions.length, 10)
})
