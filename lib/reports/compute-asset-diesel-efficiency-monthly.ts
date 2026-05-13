import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeMergedOperatingHoursByAsset,
  fetchDieselPeriodConsumptionTxsForReportAssets,
  type DieselPeriodConsumptionTxRow,
} from '@/lib/reports/merged-operating-hours'
import { resolveTrustedOperatingHours, DIESEL_EFFICIENCY_THRESHOLDS_VERSION } from '@/lib/reports/diesel-efficiency-hours-policy'
import {
  buildMonthlyEfficiencyFlags,
  type EfficiencyBandRow,
} from '@/lib/reports/diesel-efficiency-anomalies'
import { aggregateConcreteM3ByAssetId } from '@/lib/reports/fetch-cotizador-asset-concrete-m3'

export type AssetRowForEfficiency = {
  id: string
  asset_id: string | null
  plant_id: string | null
  equipment_models: { category: string | null } | null
}

function ymBounds(ym: string): { dateFromStr: string; dateToExclusiveStr: string; dateFromStart: Date; dateToExclusive: Date } {
  const [ys, ms] = ym.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const dateFromStr = `${ys}-${ms}-01`
  const dateFromStart = new Date(`${dateFromStr}T00:00:00.000Z`)
  const next = new Date(Date.UTC(y, m, 1))
  const dateToExclusiveStr = next.toISOString().slice(0, 10)
  const dateToExclusive = new Date(`${dateToExclusiveStr}T00:00:00.000Z`)
  return { dateFromStr, dateToExclusiveStr, dateFromStart, dateToExclusive }
}

function lastDayOfMonthYm(ym: string): string {
  const { dateToExclusiveStr } = ymBounds(ym)
  const d = new Date(dateToExclusiveStr)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function bandForCategory(
  bands: EfficiencyBandRow[],
  category: string | null
): EfficiencyBandRow | null {
  if (!category) return null
  const key = category.trim().toLowerCase()
  return bands.find((b) => b.category_key === key) ?? null
}

/**
 * Computes and upserts `asset_diesel_efficiency_monthly` for the given YYYY-MM list.
 */
export async function computeAssetDieselEfficiencyMonths(
  supabase: SupabaseClient,
  params: {
    yearMonths: string[]
    plantId?: string | null
    /** e.g. http://127.0.0.1:3000 — when set, loads Cotizador sales for L/m³ */
    requestBaseUrl?: string | null
  }
): Promise<{ upserted: number; errors: string[] }> {
  const { yearMonths, plantId, requestBaseUrl } = params
  const errors: string[] = []
  let upserted = 0

  const sb = supabase as SupabaseClient & { from: (r: string) => any }
  const { data: bandsRaw } = await sb
    .from('equipment_category_efficiency_bands')
    .select(
      'category_key, reference_liters_per_hour, band_comfort_min, band_comfort_max, band_watch_above, band_severe_above'
    )
    .eq('version', DIESEL_EFFICIENCY_THRESHOLDS_VERSION)

  const bands: EfficiencyBandRow[] = (bandsRaw || []).map((r: any) => ({
    category_key: r.category_key,
    reference_liters_per_hour: Number(r.reference_liters_per_hour),
    band_comfort_min: r.band_comfort_min != null ? Number(r.band_comfort_min) : null,
    band_comfort_max: r.band_comfort_max != null ? Number(r.band_comfort_max) : null,
    band_watch_above: r.band_watch_above != null ? Number(r.band_watch_above) : null,
    band_severe_above: r.band_severe_above != null ? Number(r.band_severe_above) : null,
  }))

  let assetsQuery = supabase
    .from('assets')
    .select('id, asset_id, plant_id, status, equipment_models(category)')
    .neq('status', 'retired')
  if (plantId) assetsQuery = assetsQuery.eq('plant_id', plantId)
  const { data: assetsData, error: assetsErr } = await assetsQuery
  if (assetsErr) throw assetsErr
  const assets = (assetsData || []) as unknown as AssetRowForEfficiency[]
  const assetIds = assets.map((a) => a.id)
  if (assetIds.length === 0) return { upserted: 0, errors: [] }

  const { data: plants } = await supabase.from('plants').select('id, code')
  const plantCodeToId = new Map<string, string>()
  for (const p of plants || []) {
    if (p.code) plantCodeToId.set(p.code, p.id)
  }

  let cotizadorPlantToMaintenancePlant = new Map<string, string>()
  if (
    process.env.COTIZADOR_SUPABASE_URL &&
    process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY
  ) {
    const cotizador = createClient(
      process.env.COTIZADOR_SUPABASE_URL,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )
    const { data: cotPlants } = await cotizador.from('plants').select('id, code')
    for (const cp of cotPlants || []) {
      const mid = plantCodeToId.get(cp.code)
      if (mid) cotizadorPlantToMaintenancePlant.set(cp.id, mid)
    }
  }

  const sortedMonths = [...yearMonths].sort()

  const priorLph = new Map<string, number>()

  for (const ym of sortedMonths) {
    const { dateFromStr, dateToExclusiveStr, dateFromStart, dateToExclusive } = ymBounds(ym)

    const dieselTxs: DieselPeriodConsumptionTxRow[] = await fetchDieselPeriodConsumptionTxsForReportAssets(
      supabase,
      {
        assetIds,
        transactionDateGte: dateFromStr,
        transactionDateLt: dateToExclusiveStr,
      }
    )

    const txsByAsset = new Map<string, DieselPeriodConsumptionTxRow[]>()
    for (const t of dieselTxs) {
      if (!t.asset_id) continue
      if (!txsByAsset.has(t.asset_id)) txsByAsset.set(t.asset_id, [])
      txsByAsset.get(t.asset_id)!.push(t)
    }

    const dieselConsumedHoursByAsset = new Map<string, number>()
    const dieselConsumedKmByAsset = new Map<string, number>()
    txsByAsset.forEach((txs, aid) => {
      dieselConsumedHoursByAsset.set(
        aid,
        txs.reduce((s, t) => s + Number(t.hours_consumed || 0), 0)
      )
      dieselConsumedKmByAsset.set(
        aid,
        txs.reduce((s, t) => s + Number(t.kilometers_consumed || 0), 0)
      )
    })

    const { hoursByAsset, hoursMergedByAsset, hoursSumByAsset } =
      await computeMergedOperatingHoursByAsset(supabase, {
      assetIds,
      dateFromStart,
      dateToExclusive,
      dateToExclusiveStr,
      dieselConsumedHoursByAsset,
      periodDieselConsumptionTxs: dieselTxs,
    })

    let m3ByAsset = new Map<string, number>()
    if (requestBaseUrl) {
      try {
        const dateToInclusive = lastDayOfMonthYm(ym)
        const salesResp = await fetch(`${requestBaseUrl}/api/integrations/cotizador/sales/assets/weekly`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateFrom: dateFromStr,
            dateTo: dateToInclusive,
            plantIds: undefined,
          }),
        })
        if (salesResp.ok) {
          const salesRows = (await salesResp.json()) as Array<{
            plant_id: string
            asset_name: string | null
            concrete_m3?: number | null
          }>
          m3ByAsset = await aggregateConcreteM3ByAssetId({
            supabase,
            salesRows,
            assets: assets.map((a) => ({
              id: a.id,
              asset_id: a.asset_id,
              plant_id: a.plant_id,
            })),
            cotizadorPlantToMaintenancePlant,
          })
        }
      } catch (e) {
        errors.push(`Cotizador fetch failed for ${ym}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    const rows: Record<string, unknown>[] = []

    for (const asset of assets) {
      const txs = txsByAsset.get(asset.id) || []
      const liters = txs.reduce((s, t) => s + Number(t.quantity_liters || 0), 0)
      const merged = hoursMergedByAsset.get(asset.id) ?? 0
      const sumH = hoursSumByAsset.get(asset.id) ?? dieselConsumedHoursByAsset.get(asset.id) ?? 0
      const trusted = resolveTrustedOperatingHours(merged, sumH)
      const trustedH = hoursByAsset.get(asset.id) ?? trusted.trusted
      const km = dieselConsumedKmByAsset.get(asset.id) ?? 0

      const lph = trustedH > 0 && liters > 0 ? liters / trustedH : null
      const lpk = km > 0 && liters > 0 ? liters / km : null
      const m3 = m3ByAsset.get(asset.id) ?? null
      const lpm3 = m3 != null && m3 > 0 && liters > 0 ? liters / m3 : null

      const cat = asset.equipment_models?.category ?? null
      const band = bandForCategory(bands, cat)
      const prior = priorLph.get(asset.id) ?? null
      const { quality, anomaly } = buildMonthlyEfficiencyFlags({
        txs,
        trusted,
        litersPerHour: lph,
        litersPerHourPriorMonth: prior,
        categoryBand: band,
      })

      if (lph != null && Number.isFinite(lph)) priorLph.set(asset.id, lph)

      if (liters <= 0 && txs.length === 0) continue

      rows.push({
        asset_id: asset.id,
        plant_id: asset.plant_id,
        year_month: ym,
        total_liters: liters,
        hours_merged: merged,
        hours_sum_raw: sumH,
        hours_trusted: trustedH,
        kilometers_sum_raw: km,
        liters_per_hour_trusted: lph,
        liters_per_km: lpk,
        concrete_m3: m3,
        liters_per_m3: lpm3,
        equipment_category: cat,
        quality_flags: quality,
        anomaly_flags: anomaly,
        thresholds_version: DIESEL_EFFICIENCY_THRESHOLDS_VERSION,
        computed_at: new Date().toISOString(),
      })
    }

    if (rows.length > 0) {
      // Table added in migration 20260510140000 — regenerate Database types when convenient.
      const { error: upErr } = await sb.from('asset_diesel_efficiency_monthly').upsert(rows, {
        onConflict: 'asset_id,year_month',
      })
      if (upErr) {
        errors.push(`Upsert ${ym}: ${upErr.message}`)
      } else {
        upserted += rows.length
      }
    }
  }

  return { upserted, errors }
}
