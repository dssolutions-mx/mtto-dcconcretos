import { REPORTS_CALENDAR_TIMEZONE } from '@/lib/reports/mexico-city-report-window'

export function shiftMonthString(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return month

  const shifted = new Date(year, monthNumber - 1 + delta, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`
}

/** Current `YYYY-MM` in the reporting calendar (America/Mexico_City). */
export function mexicoCityYearMonth(referenceDate = new Date()): string {
  const dateOnly = referenceDate.toLocaleDateString('sv-SE', { timeZone: REPORTS_CALENDAR_TIMEZONE })
  return dateOnly.slice(0, 7)
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const MONTH_NAMES_ES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

/** Human label for a `YYYY-MM` value, e.g. `Junio 2026`. */
export function formatYearMonthLabelEs(ym: string, short = false): string {
  const [ys, ms] = ym.split('-')
  const monthIndex = Number(ms) - 1
  if (!ys || monthIndex < 0 || monthIndex > 11) return ym
  const names = short ? MONTH_NAMES_ES_SHORT : MONTH_NAMES_ES
  return `${names[monthIndex]} ${ys}`
}

/** Inclusive `YYYY-MM` range, newest first (for month pickers). */
export function listYearMonthsDescending(fromYm: string, toYm: string): string[] {
  let from = fromYm.slice(0, 7)
  let to = toYm.slice(0, 7)
  if (from > to) [from, to] = [to, from]

  const out: string[] = []
  let cur = to
  for (let i = 0; i < 240; i++) {
    out.push(cur)
    if (cur === from) break
    cur = shiftMonthString(cur, -1)
  }
  return out
}

/** First month with diesel efficiency rollups in production. */
export const DIESEL_EFFICIENCY_REPORT_START_YM = '2026-01'

/** Months available in the diesel efficiency report UI (start → current Mexico City month). */
export function dieselEfficiencyReportMonths(referenceDate = new Date()): string[] {
  return listYearMonthsDescending(
    DIESEL_EFFICIENCY_REPORT_START_YM,
    mexicoCityYearMonth(referenceDate)
  )
}

/** Label for bulk recompute actions, e.g. `Ene–Jun 2026`. */
export function formatYearMonthRangeLabelEs(fromYm: string, toYm: string): string {
  const from = fromYm.slice(0, 7)
  const to = toYm.slice(0, 7)
  if (from === to) return formatYearMonthLabelEs(from)
  const [fromYear, fromMonth] = from.split('-')
  const [toYear, toMonth] = to.split('-')
  const fromIdx = Number(fromMonth) - 1
  const toIdx = Number(toMonth) - 1
  if (fromYear === toYear && fromIdx >= 0 && toIdx >= 0) {
    return `${MONTH_NAMES_ES_SHORT[fromIdx]}–${MONTH_NAMES_ES_SHORT[toIdx]} ${toYear}`
  }
  return `${formatYearMonthLabelEs(from, true)} – ${formatYearMonthLabelEs(to, true)}`
}
