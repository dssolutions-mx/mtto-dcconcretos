import type { TrustedHoursResolution, TrustedKmResolution } from '@/lib/reports/diesel-efficiency-hours-policy'

export type EfficiencyBandRow = {
  category_key: string
  reference_liters_per_hour: number
  band_comfort_min: number | null
  band_comfort_max: number | null
  band_watch_above: number | null
  band_severe_above: number | null
}

export type MonthlyEfficiencyQualityFlags = {
  tx_count: number
  null_previous_horometer_count: number
  negative_hours_consumed_count: number
  /** True when merged hours and sum(hours_consumed) disagree materially */
  merge_fork: boolean
  null_previous_kilometer_count: number
  negative_kilometers_consumed_count: number
  /** True when merged km and sum(kilometers_consumed) disagree materially */
  merge_fork_km: boolean
}

export type MonthlyEfficiencyAnomalyFlags = {
  data_quality_tier: 'ok' | 'watch' | 'severe'
  efficiency_tier: 'ok' | 'watch' | 'severe' | 'unknown'
  /** MoM step in L/h vs prior month (if prior exists) */
  breakpoint_mom_lph: boolean
  /** Human-safe hint — never asserts theft */
  review_consumption_pattern: boolean
}

function tierFromNulls(nulls: number, txs: number): 'ok' | 'watch' | 'severe' {
  if (txs === 0) return 'ok'
  const r = nulls / txs
  if (r > 0.5) return 'severe'
  if (r > 0.15) return 'watch'
  return 'ok'
}

function worseDataQualityTier(
  a: 'ok' | 'watch' | 'severe',
  b: 'ok' | 'watch' | 'severe'
): 'ok' | 'watch' | 'severe' {
  const rank: Record<'ok' | 'watch' | 'severe', number> = { ok: 0, watch: 1, severe: 2 }
  return rank[a] >= rank[b] ? a : b
}

function tierFromLph(
  lph: number | null,
  band: EfficiencyBandRow | null
): 'ok' | 'watch' | 'severe' | 'unknown' {
  if (lph == null || !Number.isFinite(lph) || lph <= 0) return 'unknown'
  if (!band) return 'unknown'
  const cmin = band.band_comfort_min ?? 0
  const cmax = band.band_comfort_max ?? Infinity
  if (lph >= cmin && lph <= cmax) return 'ok'
  const watch = band.band_watch_above ?? cmax
  if (lph <= watch) return 'watch'
  const severe = band.band_severe_above ?? watch
  if (lph > severe) return 'severe'
  return 'watch'
}

export function buildMonthlyEfficiencyFlags(params: {
  txs: Array<{
    hours_consumed?: number | null
    previous_horometer?: number | null
    horometer_reading?: number | null
    kilometers_consumed?: number | null
    previous_kilometer?: number | null
    kilometer_reading?: number | null
  }>
  trusted: TrustedHoursResolution
  trustedKm: TrustedKmResolution
  litersPerHour: number | null
  litersPerHourPriorMonth: number | null
  categoryBand: EfficiencyBandRow | null
}): { quality: MonthlyEfficiencyQualityFlags; anomaly: MonthlyEfficiencyAnomalyFlags } {
  const { txs, trusted, trustedKm, litersPerHour, litersPerHourPriorMonth, categoryBand } = params
  let null_previous_horometer_count = 0
  let negative_hours_consumed_count = 0
  let null_previous_kilometer_count = 0
  let negative_kilometers_consumed_count = 0
  for (const t of txs) {
    if (t.horometer_reading != null && t.previous_horometer == null) {
      null_previous_horometer_count++
    }
    const h = Number(t.hours_consumed)
    if (Number.isFinite(h) && h < 0) negative_hours_consumed_count++
    if (t.kilometer_reading != null && t.previous_kilometer == null) {
      null_previous_kilometer_count++
    }
    const k = Number(t.kilometers_consumed)
    if (Number.isFinite(k) && k < 0) negative_kilometers_consumed_count++
  }
  const quality: MonthlyEfficiencyQualityFlags = {
    tx_count: txs.length,
    null_previous_horometer_count,
    negative_hours_consumed_count,
    merge_fork: trusted.mergeFork,
    null_previous_kilometer_count,
    negative_kilometers_consumed_count,
    merge_fork_km: trustedKm.mergeFork,
  }

  const dq = worseDataQualityTier(
    tierFromNulls(null_previous_horometer_count, txs.length),
    tierFromNulls(null_previous_kilometer_count, txs.length)
  )
  const eff = tierFromLph(litersPerHour, categoryBand)
  let breakpoint_mom_lph = false
  if (
    litersPerHour != null &&
    litersPerHourPriorMonth != null &&
    litersPerHourPriorMonth > 0 &&
    Math.abs(litersPerHour - litersPerHourPriorMonth) / litersPerHourPriorMonth > 0.35
  ) {
    breakpoint_mom_lph = true
  }

  const review_consumption_pattern =
    eff === 'severe' &&
    dq === 'ok' &&
    !trusted.mergeFork &&
    !trustedKm.mergeFork &&
    (litersPerHour ?? 0) > 0

  const anomaly: MonthlyEfficiencyAnomalyFlags = {
    data_quality_tier:
      trusted.mergeFork || trustedKm.mergeFork || dq !== 'ok'
        ? dq === 'severe'
          ? 'severe'
          : 'watch'
        : 'ok',
    efficiency_tier: eff,
    breakpoint_mom_lph,
    review_consumption_pattern,
  }

  if (negative_hours_consumed_count > 0 || negative_kilometers_consumed_count > 0) {
    anomaly.data_quality_tier = 'severe'
  }

  return { quality, anomaly }
}
