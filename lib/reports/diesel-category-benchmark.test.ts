import { describe, expect, it } from 'vitest'
import {
  computeCategoryBenchmarks,
  deltaVsCategoryMedian,
} from './diesel-category-benchmark'
import type { EfficiencyRow } from '@/components/reports/diesel-efficiency/types'

function row(
  category: string,
  lph: number | null,
  assetId = 'a1'
): EfficiencyRow {
  return {
    id: `${assetId}-${category}`,
    year_month: '2026-06',
    plant_id: 'p1',
    total_liters: 100,
    hours_merged: 10,
    hours_sum_raw: 10,
    hours_trusted: 10,
    kilometers_sum_raw: 0,
    kilometers_merged: 0,
    kilometers_trusted: 0,
    liters_per_hour_trusted: lph,
    liters_per_km: null,
    concrete_m3: null,
    plant_concrete_m3: null,
    liters_per_m3: null,
    equipment_category: category,
    quality_flags: {
      tx_count: 1,
      null_previous_horometer_count: 0,
      negative_hours_consumed_count: 0,
      merge_fork: false,
    },
    anomaly_flags: {
      data_quality_tier: 'ok',
      efficiency_tier: 'ok',
      breakpoint_mom_lph: false,
      review_consumption_pattern: false,
    },
    assets: { id: assetId, asset_id: assetId, name: assetId },
  }
}

describe('computeCategoryBenchmarks', () => {
  it('computes median L/h per category', () => {
    const map = computeCategoryBenchmarks([
      row('camion', 10, 'a1'),
      row('camion', 20, 'a2'),
      row('mezcladora de concreto', 8, 'a3'),
    ])
    expect(map.get('camion')?.medianLph).toBe(15)
    expect(map.get('camion')?.assetCount).toBe(2)
    expect(map.get('mezcladora de concreto')?.medianLph).toBe(8)
  })
})

describe('deltaVsCategoryMedian', () => {
  it('returns null when inputs missing', () => {
    expect(deltaVsCategoryMedian(null, 10)).toBeNull()
    expect(deltaVsCategoryMedian(12, null)).toBeNull()
  })

  it('computes percent delta', () => {
    expect(deltaVsCategoryMedian(12, 10)).toBeCloseTo(20)
    expect(deltaVsCategoryMedian(8, 10)).toBeCloseTo(-20)
  })
})
