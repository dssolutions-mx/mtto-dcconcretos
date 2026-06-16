import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAssetCoverageRow,
  computeAssetCoverageStatus,
  findOrphanedPositionCodes,
} from './coverage'

test('computeAssetCoverageStatus returns no-layout without model or layout', () => {
  assert.equal(
    computeAssetCoverageStatus({
      hasModel: false,
      hasLayout: false,
      mountedCount: 0,
      totalPositions: 0,
    }),
    'no-layout'
  )
})

test('computeAssetCoverageStatus returns ok when fully mounted', () => {
  assert.equal(
    computeAssetCoverageStatus({
      hasModel: true,
      hasLayout: true,
      mountedCount: 10,
      totalPositions: 10,
    }),
    'ok'
  )
})

test('computeAssetCoverageStatus returns partial when incomplete', () => {
  assert.equal(
    computeAssetCoverageStatus({
      hasModel: true,
      hasLayout: true,
      mountedCount: 4,
      totalPositions: 10,
    }),
    'partial'
  )
})

test('findOrphanedPositionCodes detects codes outside layout', () => {
  const orphaned = findOrphanedPositionCodes(
    ['eje1_izq', 'old_pos'],
    [{ code: 'eje1_izq', label: 'Eje 1', axle: 1, side: 'izq' }]
  )
  assert.deepEqual(orphaned, ['old_pos'])
})

test('buildAssetCoverageRow computes pct and status', () => {
  const row = buildAssetCoverageRow({
    asset_id: 'a1',
    asset_name: 'Camión #08',
    model_id: 'm1',
    has_layout: true,
    total_positions: 10,
    mounted_count: 4,
  })
  assert.equal(row.coverage_pct, 40)
  assert.equal(row.status, 'partial')
})
