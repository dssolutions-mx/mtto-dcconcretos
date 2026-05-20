import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateDieselByPlant,
  buildManttoBreakdownFromGerencial,
  getMonthDateRange,
} from './ingresos-gastos-operational-details.ts'

test('getMonthDateRange returns inclusive calendar month', () => {
  const { dateFromStr, dateToStr } = getMonthDateRange('2026-03')
  assert.equal(dateFromStr, '2026-03-01')
  assert.equal(dateToStr, '2026-03-31')
})

test('aggregateDieselByPlant sums liters and averages L/h excluding severe', () => {
  const scope = new Set(['p1'])
  const byPlant = aggregateDieselByPlant(
    [
      {
        plant_id: 'p1',
        total_liters: 100,
        liters_per_hour_trusted: 10,
        liters_per_km: 2,
        anomaly_flags: { data_quality_tier: 'ok' } as any,
      },
      {
        plant_id: 'p1',
        total_liters: 50,
        liters_per_hour_trusted: 20,
        liters_per_km: null,
        anomaly_flags: { data_quality_tier: 'severe' } as any,
      },
    ],
    scope
  )
  assert.equal(byPlant.p1.total_liters, 150)
  assert.equal(byPlant.p1.assets_with_data, 2)
  assert.equal(byPlant.p1.avg_lph_trusted, 10)
})

test('buildManttoBreakdownFromGerencial splits prev/corr and unallocated', () => {
  const scope = new Set(['pl1'])
  const byPlant = buildManttoBreakdownFromGerencial(
    [
      {
        id: 'pl1',
        maintenance_cost: 100,
        preventive_cost: 60,
        corrective_cost: 40,
      },
    ],
    [
      {
        id: 'a1',
        asset_code: 'CR-15',
        plant_id: 'pl1',
        preventive_cost: 60,
        corrective_cost: 25,
      },
    ],
    scope
  )
  assert.equal(byPlant.pl1.preventive_total, 60)
  assert.equal(byPlant.pl1.corrective_total, 40)
  assert.equal(byPlant.pl1.unallocated_corrective, 15)
  assert.equal(byPlant.pl1.assets.length, 1)
  assert.equal(byPlant.pl1.assets[0].asset_code, 'CR-15')
})
