import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExecutiveReportRollup,
  mapAssetToExecutiveCategory,
  type GerencialAssetForRollup,
} from './executive-report-rollup.ts'

test('mapAssetToExecutiveCategory maps mixer codes', () => {
  assert.equal(
    mapAssetToExecutiveCategory({ asset_code: 'CR-15', asset_name: 'Mixer', id: '1' } as GerencialAssetForRollup),
    'Ollas Revolvedoras'
  )
})

test('buildExecutiveReportRollup tracks unallocated maintenance', () => {
  const assets: GerencialAssetForRollup[] = [
    {
      id: 'a1',
      asset_code: 'CR-01',
      asset_name: 'Mixer 1',
      maintenance_cost: 100,
      preventive_cost: 40,
      corrective_cost: 60,
      hours_worked: 10,
      concrete_m3: 50,
    },
  ]
  const rollup = buildExecutiveReportRollup(
    assets,
    {
      totalSales: 0,
      totalMaintenanceCost: 150,
      totalPreventiveCost: 40,
      totalCorrectiveCost: 60,
      totalConcreteM3: 50,
    },
    { dateFrom: '2026-01-01', dateTo: '2026-01-31' }
  )
  assert.equal(rollup.maintenance_attributed_to_assets, 100)
  assert.equal(rollup.unallocated_maintenance, 50)
  assert.equal(rollup.summary.cost_per_m3, 3)
})
