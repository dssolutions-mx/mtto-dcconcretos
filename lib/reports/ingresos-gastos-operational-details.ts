import type { AnomalyFlags } from '@/components/reports/diesel-efficiency/types'

export type DieselEfficiencyRowInput = {
  plant_id: string | null
  total_liters: number | null
  liters_per_hour_trusted: number | null
  liters_per_km: number | null
  anomaly_flags: AnomalyFlags | null
}

export type DieselPlantAggregate = {
  total_liters: number
  avg_lph_trusted: number | null
  avg_lpk: number | null
  assets_with_data: number
}

export type ManttoAssetBreakdown = {
  asset_id: string
  asset_code: string
  preventive_cost: number
  corrective_cost: number
}

export type ManttoPlantBreakdown = {
  preventive_total: number
  corrective_total: number
  unallocated_corrective: number
  assets: ManttoAssetBreakdown[]
}

export type DieselOperationalDetails = {
  category: 'diesel'
  byPlantId: Record<string, DieselPlantAggregate>
}

export type ManttoOperationalDetails = {
  category: 'mantto'
  byPlantId: Record<string, ManttoPlantBreakdown>
}

export function getMonthDateRange(month: string): { dateFromStr: string; dateToStr: string } {
  const [yr, mNum] = month.split('-').map(Number)
  const from = new Date(yr, mNum - 1, 1)
  const to = new Date(yr, mNum, 0)
  return {
    dateFromStr: from.toISOString().slice(0, 10),
    dateToStr: to.toISOString().slice(0, 10),
  }
}

/** Aggregate diesel efficiency monthly rows per plant (KpiStrip-aligned). */
export function aggregateDieselByPlant(
  rows: DieselEfficiencyRowInput[],
  scopePlantIds: Set<string>
): Record<string, DieselPlantAggregate> {
  const byPlant = new Map<string, DieselEfficiencyRowInput[]>()

  for (const row of rows) {
    const pid = row.plant_id
    if (!pid || !scopePlantIds.has(pid)) continue
    if (!byPlant.has(pid)) byPlant.set(pid, [])
    byPlant.get(pid)!.push(row)
  }

  const result: Record<string, DieselPlantAggregate> = {}

  for (const [plantId, plantRows] of byPlant) {
    const total_liters = plantRows.reduce((s, r) => s + Number(r.total_liters ?? 0), 0)

    const lphRows = plantRows.filter(
      r =>
        r.liters_per_hour_trusted != null &&
        r.anomaly_flags?.data_quality_tier !== 'severe'
    )
    const avg_lph_trusted =
      lphRows.length > 0
        ? lphRows.reduce((s, r) => s + (r.liters_per_hour_trusted ?? 0), 0) / lphRows.length
        : null

    const lpkRows = plantRows.filter(
      r => r.liters_per_km != null && Number.isFinite(r.liters_per_km)
    )
    const avg_lpk =
      lpkRows.length > 0
        ? lpkRows.reduce((s, r) => s + (r.liters_per_km ?? 0), 0) / lpkRows.length
        : null

    result[plantId] = {
      total_liters,
      avg_lph_trusted,
      avg_lpk,
      assets_with_data: plantRows.length,
    }
  }

  for (const pid of scopePlantIds) {
    if (!result[pid]) {
      result[pid] = {
        total_liters: 0,
        avg_lph_trusted: null,
        avg_lpk: null,
        assets_with_data: 0,
      }
    }
  }

  return result
}

type GerencialPlantLike = {
  id: string
  maintenance_cost?: number
  preventive_cost?: number
  corrective_cost?: number
}

type GerencialAssetLike = {
  id: string
  asset_code?: string
  plant_id?: string
  preventive_cost?: number
  corrective_cost?: number
  maintenance_cost?: number
}

/** Build mantto breakdown from runGerencialReport output, scoped to plant IDs. */
export function buildManttoBreakdownFromGerencial(
  plants: GerencialPlantLike[],
  assets: GerencialAssetLike[],
  scopePlantIds: Set<string>
): Record<string, ManttoPlantBreakdown> {
  const plantById = new Map<string, GerencialPlantLike>()
  for (const p of plants) {
    if (p.id && scopePlantIds.has(p.id)) plantById.set(p.id, p)
  }

  const assetsByPlant = new Map<string, ManttoAssetBreakdown[]>()
  for (const a of assets) {
    const pid = a.plant_id
    if (!pid || !scopePlantIds.has(pid)) continue
    const prev = Number(a.preventive_cost || 0)
    const corr = Number(a.corrective_cost || 0)
    if (prev + corr <= 0) continue
    if (!assetsByPlant.has(pid)) assetsByPlant.set(pid, [])
    assetsByPlant.get(pid)!.push({
      asset_id: a.id,
      asset_code: a.asset_code || a.id.slice(0, 8),
      preventive_cost: prev,
      corrective_cost: corr,
    })
  }

  const result: Record<string, ManttoPlantBreakdown> = {}

  for (const plantId of scopePlantIds) {
    const plant = plantById.get(plantId)
    const preventive_total = Number(plant?.preventive_cost ?? 0)
    const corrective_total = Number(plant?.corrective_cost ?? 0)
    const plantAssets = assetsByPlant.get(plantId) || []
    const assetPrevSum = plantAssets.reduce((s, x) => s + x.preventive_cost, 0)
    const assetCorrSum = plantAssets.reduce((s, x) => s + x.corrective_cost, 0)
    const maintenance_cost = Number(plant?.maintenance_cost ?? preventive_total + corrective_total)
    const unallocated_corrective = Math.max(0, corrective_total - assetCorrSum)

    result[plantId] = {
      preventive_total,
      corrective_total,
      unallocated_corrective,
      assets: plantAssets.sort(
        (a, b) =>
          b.preventive_cost +
          b.corrective_cost -
          (a.preventive_cost + a.corrective_cost)
      ),
    }

    if (process.env.NODE_ENV === 'development') {
      const sum = preventive_total + corrective_total
      if (maintenance_cost > 0 && Math.abs(sum - maintenance_cost) > 0.05) {
        console.warn(
          `[mantto-operational-details] Plant ${plantId}: prev+corr (${sum}) != maintenance_cost (${maintenance_cost})`
        )
      }
      if (Math.abs(assetPrevSum - preventive_total) > 0.05) {
        console.warn(
          `[mantto-operational-details] Plant ${plantId}: asset preventive sum (${assetPrevSum}) != preventive_total (${preventive_total})`
        )
      }
    }
  }

  return result
}
