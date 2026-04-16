export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

export const formatCurrencyCompact = (amount: number) => {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}k`
  return `$${amount.toFixed(0)}`
}

export const formatNumber = (n: number, decimals = 0) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)

export const formatPercent = (pct: number, decimals = 1) => `${pct.toFixed(decimals)}%`

export const formatPerM3 = (amount: number) => `${formatCurrency(amount)}/m³`

export const formatMonthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
}

export const formatMonthShort = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString('es-MX', { month: 'short' })
}

export const formatDelta = (delta: number, asPercent = false): string => {
  const sign = delta > 0 ? '+' : delta < 0 ? '' : ''
  if (asPercent) return `${sign}${delta.toFixed(1)}%`
  return `${sign}${formatCurrencyCompact(delta)}`
}

/** Returns { delta, deltaPct } between latest and previous month in a monthly series. */
export function computeMoM(series: Record<string, number>, months: string[]): { delta: number; deltaPct: number | null; current: number; previous: number } {
  if (months.length === 0) return { delta: 0, deltaPct: null, current: 0, previous: 0 }
  const last = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : null
  const current = series[last] || 0
  const previous = prev ? series[prev] || 0 : 0
  const delta = current - previous
  const deltaPct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null
  return { delta, deltaPct, current, previous }
}
