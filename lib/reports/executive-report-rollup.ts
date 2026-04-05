/**
 * Aggregates gerencial report API payloads into executive analytical report sections.
 * Category buckets align with Q4-style storytelling (seven equipment families).
 */

export const EXECUTIVE_CATEGORY_IDS = [
  'Ollas Revolvedoras',
  'Cargadores Frontales',
  'Plantas',
  'Vehículos',
  'Bombeo',
  'Generadores',
  'Otros Equipos',
] as const

export type ExecutiveCategoryId = (typeof EXECUTIVE_CATEGORY_IDS)[number]

export type GerencialAssetForRollup = {
  id: string
  asset_code: string
  asset_name: string
  plant_name?: string
  maintenance_cost: number
  preventive_cost: number
  corrective_cost: number
  hours_worked?: number
  concrete_m3?: number
  equipment_type?: string | null
  model_category?: string | null
  total_m3?: number
}

export type GerencialSummaryForRollup = {
  totalSales: number
  totalMaintenanceCost: number
  totalPreventiveCost: number
  totalCorrectiveCost: number
  totalConcreteM3: number
}

export type CategoryRollup = {
  id: ExecutiveCategoryId
  maintenance_cost: number
  preventive_cost: number
  corrective_cost: number
  hours_worked: number
  asset_count: number
  /** corrective / preventive when preventive > 0 */
  corrective_to_preventive_ratio: number | null
}

export type AssetRankRow = {
  id: string
  asset_code: string
  asset_name: string
  maintenance_cost: number
  hours_worked: number
  cost_per_hour: number | null
}

export type ExecutiveReportRollup = {
  period: { dateFrom: string; dateTo: string }
  /**
   * Sum of assets[].maintenance_cost — may be less than summary total when the gerencial
   * report includes standalone POs (no work order) attributed to plant but not to an asset.
   */
  maintenance_attributed_to_assets: number
  /** max(0, total_maintenance from API − maintenance_attributed_to_assets) */
  unallocated_maintenance: number
  summary: {
    total_maintenance: number
    total_preventive: number
    total_corrective: number
    corrective_to_preventive_ratio: number | null
    total_concrete_m3: number
    cost_per_m3: number | null
    total_hours: number
    asset_count: number
    cost_per_hour_global: number | null
    production_per_hour: number | null
  }
  categories: CategoryRollup[]
  categories_by_maintenance_desc: CategoryRollup[]
  hours_by_category_desc: CategoryRollup[]
  top10_by_maintenance: AssetRankRow[]
  top10_by_cost_per_hour: AssetRankRow[]
  mixer_bar_rows: Array<{ code: string; maintenance_cost: number }>
  mixer_concentration: {
    top10_sum: number
    category_total: number
    pct_of_category: number | null
  }
  /** Stub until product defines formula (e.g. diesel hours vs expected) */
  hours_coverage_pct: null
}

const EMPTY_CATEGORY = (id: ExecutiveCategoryId): CategoryRollup => ({
  id,
  maintenance_cost: 0,
  preventive_cost: 0,
  corrective_cost: 0,
  hours_worked: 0,
  asset_count: 0,
  corrective_to_preventive_ratio: null,
})

function ratio(corrective: number, preventive: number): number | null {
  if (preventive <= 0) return null
  return corrective / preventive
}

/**
 * Maps one asset to a fixed executive bucket. First-match order matters.
 */
export function mapAssetToExecutiveCategory(a: GerencialAssetForRollup): ExecutiveCategoryId {
  const code = (a.asset_code || '').toUpperCase().trim()
  const name = (a.asset_name || '').toUpperCase().trim()
  const et = (a.equipment_type || '').toLowerCase()
  const mc = (a.model_category || '').toLowerCase()
  const blob = `${et} ${mc}`

  if (code.startsWith('BP') || blob.includes('bomba') || name.includes('BOMBA')) {
    return 'Bombeo'
  }
  if (code.includes('PLANTA') || name.includes('PLANTA')) {
    return 'Plantas'
  }
  if (
    code.startsWith('CR') ||
    blob.includes('revolvedor') ||
    blob.includes('mezclador') ||
    blob.includes('mixer')
  ) {
    return 'Ollas Revolvedoras'
  }
  if (code.startsWith('CF') || blob.includes('cargador') || blob.includes('loader') || blob.includes('caterpillar')) {
    return 'Cargadores Frontales'
  }
  if (blob.includes('generador') || name.includes('GENERADOR')) {
    return 'Generadores'
  }
  if (
    name.includes('CAMION') ||
    name.includes('PIPA') ||
    name.includes('SITRAK') ||
    code.includes('PIPA') ||
    blob.includes('vehículo') ||
    blob.includes('vehiculo') ||
    blob.includes('camión') ||
    blob.includes('camion')
  ) {
    return 'Vehículos'
  }

  return 'Otros Equipos'
}

function finalizeCategory(c: CategoryRollup): CategoryRollup {
  return {
    ...c,
    corrective_to_preventive_ratio: ratio(c.corrective_cost, c.preventive_cost),
  }
}

export function buildExecutiveReportRollup(
  assets: GerencialAssetForRollup[],
  summary: GerencialSummaryForRollup,
  period: { dateFrom: string; dateTo: string }
): ExecutiveReportRollup {
  const map = new Map<ExecutiveCategoryId, CategoryRollup>()
  EXECUTIVE_CATEGORY_IDS.forEach((id) => map.set(id, { ...EMPTY_CATEGORY(id) }))

  let totalHours = 0

  for (const a of assets) {
    const cat = mapAssetToExecutiveCategory(a)
    const row = map.get(cat)!
    const mc = Number(a.maintenance_cost || 0)
    const prev = Number(a.preventive_cost || 0)
    const corr = Number(a.corrective_cost || 0)
    const hw = Number(a.hours_worked || 0)

    row.maintenance_cost += mc
    row.preventive_cost += prev
    row.corrective_cost += corr
    row.hours_worked += hw
    row.asset_count += 1
    totalHours += hw
  }

  const categories = EXECUTIVE_CATEGORY_IDS.map((id) => finalizeCategory(map.get(id)!))

  const categories_by_maintenance_desc = [...categories].sort(
    (a, b) => b.maintenance_cost - a.maintenance_cost
  )

  const hours_by_category_desc = [...categories].sort((a, b) => b.hours_worked - a.hours_worked)

  const totalMaint = Number(summary.totalMaintenanceCost || 0)
  const totalPrev = Number(summary.totalPreventiveCost || 0)
  const totalCorr = Number(summary.totalCorrectiveCost || 0)
  const totalM3 = Number(summary.totalConcreteM3 || 0)

  const rankRows: AssetRankRow[] = assets.map((a) => {
    const mc = Number(a.maintenance_cost || 0)
    const hw = Number(a.hours_worked || 0)
    return {
      id: a.id,
      asset_code: a.asset_code,
      asset_name: a.asset_name,
      maintenance_cost: mc,
      hours_worked: hw,
      cost_per_hour: hw > 0 ? mc / hw : null,
    }
  })

  const top10_by_maintenance = [...rankRows]
    .filter((r) => r.maintenance_cost > 0)
    .sort((a, b) => b.maintenance_cost - a.maintenance_cost)
    .slice(0, 10)

  const top10_by_cost_per_hour = [...rankRows]
    .filter((r) => r.cost_per_hour != null && r.cost_per_hour > 0 && r.hours_worked > 0)
    .sort((a, b) => (b.cost_per_hour || 0) - (a.cost_per_hour || 0))
    .slice(0, 10)

  const mixerAssets = assets.filter((a) => mapAssetToExecutiveCategory(a) === 'Ollas Revolvedoras')
  const mixerSorted = [...mixerAssets]
    .sort((a, b) => Number(b.maintenance_cost || 0) - Number(a.maintenance_cost || 0))
    .slice(0, 10)

  const mixer_bar_rows = mixerSorted.map((a) => ({
    code: a.asset_code || a.asset_name,
    maintenance_cost: Number(a.maintenance_cost || 0),
  }))

  const top10MixerSum = mixer_bar_rows.reduce((s, r) => s + r.maintenance_cost, 0)
  const mixerCategory = categories.find((c) => c.id === 'Ollas Revolvedoras')
  const categoryTotal = mixerCategory?.maintenance_cost || 0
  const pct =
    categoryTotal > 0 ? (top10MixerSum / categoryTotal) * 100 : null

  const cost_per_m3 = totalM3 > 0 ? totalMaint / totalM3 : null
  const cost_per_hour_global = totalHours > 0 ? totalMaint / totalHours : null
  const production_per_hour = totalHours > 0 ? totalM3 / totalHours : null

  const maintenance_attributed_to_assets = assets.reduce(
    (s, a) => s + Number(a.maintenance_cost || 0),
    0
  )
  const rawGap = totalMaint - maintenance_attributed_to_assets
  const unallocated_maintenance = rawGap > 0.01 ? rawGap : 0

  return {
    period,
    maintenance_attributed_to_assets,
    unallocated_maintenance,
    summary: {
      total_maintenance: totalMaint,
      total_preventive: totalPrev,
      total_corrective: totalCorr,
      corrective_to_preventive_ratio: ratio(totalCorr, totalPrev),
      total_concrete_m3: totalM3,
      cost_per_m3,
      total_hours: totalHours,
      asset_count: assets.length,
      cost_per_hour_global,
      production_per_hour,
    },
    categories,
    categories_by_maintenance_desc,
    hours_by_category_desc,
    top10_by_maintenance,
    top10_by_cost_per_hour,
    mixer_bar_rows,
    mixer_concentration: {
      top10_sum: top10MixerSum,
      category_total: categoryTotal,
      pct_of_category: pct,
    },
    hours_coverage_pct: null,
  }
}

/** Grayscale fills for charts (largest share = darkest) */
export function grayscaleForIndex(index: number, total: number): string {
  if (total <= 1) return '#171717'
  const t = index / Math.max(1, total - 1)
  const light = 240
  const dark = 23
  const v = Math.round(light - (light - dark) * t)
  return `rgb(${v},${v},${v})`
}
