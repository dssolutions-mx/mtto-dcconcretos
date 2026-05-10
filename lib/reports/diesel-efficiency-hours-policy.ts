/**
 * Single published policy for diesel efficiency (L/h, L/km): which "hours" denominator wins.
 *
 * - **Trusted hours for efficiency** = merged/capped horometer+checklist hours when that curve
 *   produced any positive hours in the window; otherwise fall back to the sum of row-level
 *   `hours_consumed` (diesel_transactions generated column).
 *
 * Rationale: summing `hours_consumed` can be inflated when `previous_horometer` was wrong;
 * the merged curve explicitly filters impossible jumps and caps deltas. Using merged-first
 * avoids bad sums dominating L/h (see plan Section 2.3).
 *
 * Diagnostics should still expose `hours_merged` vs `hours_sum_raw` whenever both exist.
 */

export const DIESEL_EFFICIENCY_THRESHOLDS_VERSION = '2026-05-v1'

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

const FORK_REL_EPS = 0.25

export function resolveTrustedOperatingHours(merged: number, sumRaw: number): TrustedHoursResolution {
  const m = Number(merged) || 0
  const s = Number(sumRaw) || 0
  const trusted = m > 0 ? m : s
  const denom = Math.max(m, s, 1e-9)
  const mergeFork = m > 0 && s > 0 && Math.abs(m - s) / denom > FORK_REL_EPS
  return { trusted, merged: m, sumRaw: s, mergeFork }
}
