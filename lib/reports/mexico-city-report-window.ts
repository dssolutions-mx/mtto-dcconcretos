/**
 * Calendar boundaries for diesel / meter reporting aligned with SQL rollups that use
 * `AT TIME ZONE 'America/Mexico_City'` (see asset_diesel_efficiency rollups migrations).
 *
 * Mexico abolished DST for most of the country in 2022; `America/Mexico_City` is UTC−6
 * year-round. If policy changes, revisit the offset logic or adopt a TZ database.
 */
export const REPORTS_CALENDAR_TIMEZONE = 'America/Mexico_City' as const

const MEXICO_CITY_STANDARD_OFFSET_MS = 6 * 60 * 60 * 1000

/** Start of calendar month in Mexico City, as UTC milliseconds (instant of local midnight). */
export function mexicoCityMonthStartUtcMs(year: number, month1To12: number): number {
  return Date.UTC(year, month1To12 - 1, 1) + MEXICO_CITY_STANDARD_OFFSET_MS
}

export type MexicoCityMonthWindow = {
  year: number
  month: number
  /** Inclusive lower bound for timestamptz filters (`>=`). */
  startInclusiveMs: number
  /** Exclusive upper bound for timestamptz filters (`<`). */
  endExclusiveMs: number
  startInclusiveIso: string
  endExclusiveIso: string
}

/**
 * Half-open window [startInclusive, endExclusive) for the given `YYYY-MM` in Mexico City.
 */
export function mexicoCityMonthWindowFromYm(ym: string): MexicoCityMonthWindow {
  const [ys, ms] = ym.split('-')
  const year = Number(ys)
  const month = Number(ms)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year-month (expected YYYY-MM): ${ym}`)
  }
  const startInclusiveMs = mexicoCityMonthStartUtcMs(year, month)
  const endExclusiveMs =
    month === 12 ? mexicoCityMonthStartUtcMs(year + 1, 1) : mexicoCityMonthStartUtcMs(year, month + 1)
  return {
    year,
    month,
    startInclusiveMs,
    endExclusiveMs,
    startInclusiveIso: new Date(startInclusiveMs).toISOString(),
    endExclusiveIso: new Date(endExclusiveMs).toISOString(),
  }
}

/** `YYYY-MM-DD` for the given instant in Mexico City (for `date` / `completion_date` filters). */
export function formatMexicoCityDateOnly(utcMs: number): string {
  return new Date(utcMs).toLocaleDateString('sv-SE', { timeZone: REPORTS_CALENDAR_TIMEZONE })
}
