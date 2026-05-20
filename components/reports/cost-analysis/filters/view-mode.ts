import { shiftMonthString } from '@/lib/reports/month-utils'

export type ViewMode = 'absolute' | 'perM3' | 'percentSales'

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  absolute: 'Absoluto',
  perM3: 'Por m³',
  percentSales: '% ventas',
}

export type RangeMode = 'range' | 'month'

export type RangePreset = 'ytd' | '6m' | '12m' | 'custom'

export type MonthPreset = 'this_month' | 'last_month' | 'pick_month'

export function computePresetRange(preset: Exclude<RangePreset, 'custom'>, today = new Date()): { from: string; to: string } {
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const to = `${yyyy}-${mm}`
  if (preset === 'ytd') return { from: `${yyyy}-01`, to }
  if (preset === '6m') {
    const d = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, to }
  }
  const d = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, to }
}

export function computeMonthPreset(preset: Exclude<MonthPreset, 'pick_month'>, today = new Date()): string {
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const thisMonth = `${yyyy}-${mm}`
  if (preset === 'this_month') return thisMonth
  return shiftMonthString(thisMonth, -1)
}

function monthsInclusiveRange(fromYm: string, toYm: string): string[] {
  let a = fromYm.slice(0, 7)
  let b = toYm.slice(0, 7)
  if (a > b) [a, b] = [b, a]
  const out: string[] = []
  let cur = a
  for (let i = 0; i < 120; i++) {
    out.push(cur)
    if (cur === b) break
    cur = shiftMonthString(cur, 1)
  }
  return out
}

/**
 * Months sent to the API. In month mode, includes previous month for MoM while UI focuses on focusMonth.
 */
export function buildMonthsForApi(params: {
  rangeMode: RangeMode
  monthFrom: string
  monthTo: string
  focusMonth: string
}): { apiMonths: string[]; focusMonth: string } {
  const { rangeMode, monthFrom, monthTo, focusMonth } = params
  if (rangeMode === 'month') {
    const focus = focusMonth.slice(0, 7)
    const prev = shiftMonthString(focus, -1)
    const apiMonths = focus <= prev ? [prev, focus] : [focus, prev]
    return { apiMonths, focusMonth: focus }
  }
  const apiMonths = monthsInclusiveRange(monthFrom, monthTo)
  const focus = apiMonths.length > 0 ? apiMonths[apiMonths.length - 1]! : focusMonth.slice(0, 7)
  return { apiMonths, focusMonth: focus }
}

export function formatRangeLabel(monthFrom: string, monthTo: string): string {
  const from = monthFrom.slice(0, 7)
  const to = monthTo.slice(0, 7)
  if (from === to) return from
  return `${from} – ${to}`
}
