import type { EfficiencyRow } from '@/components/reports/diesel-efficiency/types'

export type CategoryBenchmark = {
  category: string
  assetCount: number
  medianLph: number | null
  medianLpk: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

/** Fleet median L/h and L/km per equipment category for the current report slice. */
export function computeCategoryBenchmarks(rows: EfficiencyRow[]): Map<string, CategoryBenchmark> {
  const byCategory = new Map<string, EfficiencyRow[]>()
  for (const row of rows) {
    const cat = row.equipment_category?.trim()
    if (!cat) continue
    const list = byCategory.get(cat) ?? []
    list.push(row)
    byCategory.set(cat, list)
  }

  const out = new Map<string, CategoryBenchmark>()
  for (const [category, group] of byCategory) {
    const lphValues = group
      .map((r) => r.liters_per_hour_trusted)
      .filter((v): v is number => v != null && v > 0 && Number.isFinite(v))
    const lpkValues = group
      .map((r) => r.liters_per_km)
      .filter((v): v is number => v != null && v > 0 && Number.isFinite(v))

    out.set(category, {
      category,
      assetCount: group.length,
      medianLph: median(lphValues),
      medianLpk: median(lpkValues),
    })
  }
  return out
}

/** Percent delta vs category median; positive = worse (higher L/h). */
export function deltaVsCategoryMedian(
  value: number | null | undefined,
  median: number | null | undefined
): number | null {
  if (value == null || median == null || median <= 0 || !Number.isFinite(value)) return null
  return ((value - median) / median) * 100
}
