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
  other_cost: number
}

export type ManttoOtherLine = {
  id: string
  label: string
  amount: number
}

export type ManttoPlantBreakdown = {
  preventive_total: number
  corrective_total: number
  /** Residual so preventive + corrective + other = P&L mantto_total */
  other_total: number
  unallocated_corrective: number
  assets: ManttoAssetBreakdown[]
  /** Plant-level otros (OC sin OT, balance vs fila MANTTO.) */
  other_lines: ManttoOtherLine[]
}

/** WO type → preventive / corrective / other (inspection and unknown → other). */
export function classifyManttoWoType(
  type: string | null | undefined
): 'preventive' | 'corrective' | 'other' {
  const t = (type ?? '').trim().toLowerCase()
  if (t === 'preventive' || t === 'preventivo') return 'preventive'
  if (t === 'corrective' || t === 'correctivo') return 'corrective'
  return 'other'
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

export type GerencialPlantLike = {
  id: string
  maintenance_cost?: number
  preventive_cost?: number
  corrective_cost?: number
}

export type GerencialAssetLike = {
  id: string
  asset_code?: string
  plant_id?: string
  preventive_cost?: number
  corrective_cost?: number
  other_cost?: number
  maintenance_cost?: number
}

export type GerencialPlantOtherLine = {
  plant_id: string
  id: string
  label: string
  amount: number
}

/** Build mantto breakdown from runGerencialReport output, scoped to plant IDs. */
export function buildManttoBreakdownFromGerencial(
  plants: GerencialPlantLike[],
  assets: GerencialAssetLike[],
  scopePlantIds: Set<string>,
  options?: {
    /** P&L mantto_total per plant — breakdown is forced to reconcile. */
    reconcileManttoTotals?: Record<string, number>
    plantOtherLines?: GerencialPlantOtherLine[]
  }
): Record<string, ManttoPlantBreakdown> {
  const plantById = new Map<string, GerencialPlantLike>()
  for (const p of plants) {
    if (p.id && scopePlantIds.has(p.id)) plantById.set(p.id, p)
  }

  const otherLinesByPlant = new Map<string, ManttoOtherLine[]>()
  for (const line of options?.plantOtherLines || []) {
    if (!scopePlantIds.has(line.plant_id)) continue
    if (!otherLinesByPlant.has(line.plant_id)) otherLinesByPlant.set(line.plant_id, [])
    otherLinesByPlant.get(line.plant_id)!.push({
      id: line.id,
      label: line.label,
      amount: line.amount,
    })
  }

  const assetsByPlant = new Map<string, ManttoAssetBreakdown[]>()
  for (const a of assets) {
    const pid = a.plant_id
    if (!pid || !scopePlantIds.has(pid)) continue
    const prev = Number(a.preventive_cost || 0)
    const corr = Number(a.corrective_cost || 0)
    const other = Number(a.other_cost || 0)
    if (prev + corr + other <= 0) continue
    if (!assetsByPlant.has(pid)) assetsByPlant.set(pid, [])
    assetsByPlant.get(pid)!.push({
      asset_id: a.id,
      asset_code: a.asset_code || a.id.slice(0, 8),
      preventive_cost: prev,
      corrective_cost: corr,
      other_cost: other,
    })
  }

  const result: Record<string, ManttoPlantBreakdown> = {}

  for (const plantId of scopePlantIds) {
    const plant = plantById.get(plantId)
    const preventive_total = Number(plant?.preventive_cost ?? 0)
    const corrective_total = Number(plant?.corrective_cost ?? 0)
    const plantAssets = assetsByPlant.get(plantId) || []
    const assetCorrSum = plantAssets.reduce((s, x) => s + x.corrective_cost, 0)
    const maintenance_cost = Number(plant?.maintenance_cost ?? 0)
    const expectedTotal =
      options?.reconcileManttoTotals?.[plantId] ?? maintenance_cost
    const other_total = expectedTotal - preventive_total - corrective_total
    const unallocated_corrective = Math.max(0, corrective_total - assetCorrSum)

    const other_lines: ManttoOtherLine[] = [...(otherLinesByPlant.get(plantId) || [])]
    const classifiedOther =
      plantAssets.reduce((s, x) => s + x.other_cost, 0) +
      other_lines.reduce((s, x) => s + x.amount, 0)
    const balance = other_total - classifiedOther
    if (Math.abs(balance) > 0.05) {
      other_lines.push({
        id: `balance-${plantId}`,
        label: 'Otros / balance',
        amount: balance,
      })
    }

    result[plantId] = {
      preventive_total,
      corrective_total,
      other_total,
      unallocated_corrective,
      other_lines,
      assets: plantAssets.sort(
        (a, b) =>
          b.preventive_cost +
          b.corrective_cost +
          b.other_cost -
          (a.preventive_cost + a.corrective_cost + a.other_cost)
      ),
    }
  }

  return result
}

/** Serialize P&L mantto totals for operational-details `reconcileTotals` query param. */
export function encodeReconcileManttoTotals(
  byPlantId: Record<string, number>
): string {
  return Object.entries(byPlantId)
    .filter(([, amount]) => Number.isFinite(amount) && amount !== 0)
    .map(([plantId, amount]) => `${plantId}:${amount}`)
    .join('|')
}

/** Parse `plantId:amount|plantId:amount` from ingresos-gastos drill-down request. */
export function parseReconcileManttoTotals(
  raw: string | null | undefined
): Record<string, number> | undefined {
  if (!raw?.trim()) return undefined
  const out: Record<string, number> = {}
  for (const part of raw.split('|')) {
    const sep = part.lastIndexOf(':')
    if (sep <= 0) continue
    const plantId = part.slice(0, sep).trim()
    const amount = Number(part.slice(sep + 1))
    if (plantId && Number.isFinite(amount)) out[plantId] = amount
  }
  return Object.keys(out).length > 0 ? out : undefined
}
