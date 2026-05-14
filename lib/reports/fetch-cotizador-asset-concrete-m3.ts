import { normalizeAssetCode } from '@/lib/reporting/asset-code-normalize'
import type { SupabaseClient } from '@supabase/supabase-js'

type SalesRow = {
  plant_id: string
  asset_name: string | null
  concrete_m3?: number | null
}

/**
 * Aggregates Cotizador sales rows into concrete m³ per maintenance `asset_id`
 * using `asset_name_mappings` (cotizador) + exact / normalized code match on `assets`.
 *
 * Volume is summed across all Cotizador plants where the unit appears: a mixer may
 * dispatch from several plants while MantenPro keeps a single “home” plant; L/m³ still
 * uses total diesel for that asset in the month vs total concrete attributed to that unit.
 */
export async function aggregateConcreteM3ByAssetId(params: {
  supabase: SupabaseClient
  salesRows: SalesRow[]
  /** maintenance assets in scope: id, asset_id code, plant_id */
  assets: Array<{ id: string; asset_id: string | null; plant_id: string | null }>
  cotizadorPlantToMaintenancePlant: Map<string, string>
}): Promise<Map<string, number>> {
  const { supabase, salesRows, assets, cotizadorPlantToMaintenancePlant } = params
  const out = new Map<string, number>()

  const { data: mappings } = await supabase
    .from('asset_name_mappings')
    .select('asset_id, external_unit')
    .eq('source_system', 'cotizador')

  const nameToId = new Map<string, string>()
  for (const m of mappings || []) {
    if (m.external_unit && m.asset_id) {
      nameToId.set(String(m.external_unit).toUpperCase(), m.asset_id)
    }
  }
  for (const a of assets) {
    if (a.asset_id) {
      const u = a.asset_id.toUpperCase()
      nameToId.set(u, a.id)
      const dashless = a.asset_id.replace(/([A-Z]{2,})-(\d+)/i, '$1$2').toUpperCase()
      if (dashless !== u) nameToId.set(dashless, a.id)
    }
  }

  const byNorm = new Map<string, string[]>()
  for (const a of assets) {
    if (!a.asset_id) continue
    const n = normalizeAssetCode(a.asset_id)
    if (!byNorm.has(n)) byNorm.set(n, [])
    byNorm.get(n)!.push(a.id)
  }

  for (const row of salesRows) {
    const mPlant = cotizadorPlantToMaintenancePlant.get(row.plant_id)
    if (!mPlant) continue
    const name = (row.asset_name || '').toUpperCase()
    if (!name) continue
    const m3 = Number(row.concrete_m3 || 0)
    if (!Number.isFinite(m3) || m3 <= 0) continue

    let aid = nameToId.get(name) || nameToId.get(normalizeAssetCode(name))
    if (!aid) {
      const norm = normalizeAssetCode(name)
      const cands = byNorm.get(norm) || []
      const samePlant = cands.filter((id) => assets.find((x) => x.id === id)?.plant_id === mPlant)
      if (samePlant.length === 1) aid = samePlant[0]
      else if (cands.length === 1) aid = cands[0]
    }
    if (!aid) continue
    out.set(aid, (out.get(aid) || 0) + m3)
  }

  return out
}

/**
 * Sums Cotizador `concrete_m3` by maintenance plant for the month (all units / rows),
 * using Cotizador plant UUID → MantenPro `plants.id` via `cotizadorPlantToMaintenancePlant`.
 */
export function aggregatePlantConcreteM3ByMaintenancePlant(
  salesRows: SalesRow[],
  cotizadorPlantToMaintenancePlant: Map<string, string>
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of salesRows) {
    const mPlant = cotizadorPlantToMaintenancePlant.get(row.plant_id)
    if (!mPlant) continue
    const m3 = Number(row.concrete_m3 ?? 0)
    if (!Number.isFinite(m3) || m3 < 0) continue
    totals.set(mPlant, (totals.get(mPlant) || 0) + m3)
  }
  return totals
}
