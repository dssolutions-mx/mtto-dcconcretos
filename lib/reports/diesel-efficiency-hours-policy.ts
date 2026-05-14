/**
 * Single published policy for diesel efficiency (L/h, L/km): which operating-time denominators win.
 *
 * - **Trusted hours for efficiency** = merged/capped horometer+checklist hours when that curve
 *   produced any positive hours in the window; otherwise fall back to the sum of row-level
 *   `hours_consumed` (diesel_transactions generated column).
 *
 * - **Trusted km for L/km** = merged/capped diesel odómetro + checklist km when that curve
 *   produced any positive distance in the window; otherwise fall back to the sum of row-level
 *   `kilometers_consumed` (`resolveTrustedOperatingKilometers`, implemented in app with
 *   `computeMergedOperatingKmByAsset`).
 *
 * Rationale: summing `hours_consumed` can be inflated when `previous_horometer` was wrong;
 * the merged curve explicitly filters impossible jumps and caps deltas. Using merged-first
 * avoids bad sums dominating L/h (see plan Section 2.3).
 *
 * Diagnostics should still expose `hours_merged` vs `hours_sum_raw` (and km analogs) whenever both exist.
 */

export const DIESEL_EFFICIENCY_THRESHOLDS_VERSION = '2026-05-v1'

/** Relative difference above which merged vs raw sums are flagged for review (hours and km). */
export const DIESEL_EFFICIENCY_MERGE_FORK_REL_EPS = 0.25

export type TrustedHoursResolution = {
  /** Hours used for liters_per_hour denominator */
  trusted: number
  /** Horometer/checklist merged hours inside the window (may be 0) */
  merged: number
  /** Sum of diesel_transactions.hours_consumed in the window */
  sumRaw: number
  /** True when both merged and sumRaw are positive and differ materially */
  mergeFork: boolean
}

export type TrustedKmResolution = {
  /** Km used for liters_per_km denominator */
  trusted: number
  /** Diesel odómetro + checklist merged km inside the window (may be 0) */
  merged: number
  /** Sum of diesel_transactions.kilometers_consumed in the window */
  sumRaw: number
  /** True when both merged and sumRaw are positive and differ materially */
  mergeFork: boolean
}

export function resolveTrustedOperatingHours(merged: number, sumRaw: number): TrustedHoursResolution {
  const m = Number(merged) || 0
  const s = Number(sumRaw) || 0
  const trusted = m > 0 ? m : s
  const denom = Math.max(m, s, 1e-9)
  const mergeFork = m > 0 && s > 0 && Math.abs(m - s) / denom > DIESEL_EFFICIENCY_MERGE_FORK_REL_EPS
  return { trusted, merged: m, sumRaw: s, mergeFork }
}

/** Merged-first km for L/km — same fork rule as hours (`DIESEL_EFFICIENCY_MERGE_FORK_REL_EPS`). */
export function resolveTrustedOperatingKilometers(merged: number, sumRaw: number): TrustedKmResolution {
  const m = Number(merged) || 0
  const s = Number(sumRaw) || 0
  const trusted = m > 0 ? m : s
  const denom = Math.max(m, s, 1e-9)
  const mergeFork = m > 0 && s > 0 && Math.abs(m - s) / denom > DIESEL_EFFICIENCY_MERGE_FORK_REL_EPS
  return { trusted, merged: m, sumRaw: s, mergeFork }
}
