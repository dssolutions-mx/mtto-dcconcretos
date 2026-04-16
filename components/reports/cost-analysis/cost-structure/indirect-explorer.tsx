'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatMonthLabel, formatMonthShort } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

const TOTAL_EXPENSE_CATEGORIES = 14

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const diffMs = Date.now() - t
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function formatRelativeDays(d: number | null): string {
  if (d === null) return 'sin capturas'
  if (d === 0) return 'hoy'
  if (d === 1) return 'hace 1 día'
  return `hace ${d} días`
}

export function IndirectExplorer({ data }: Props) {
  const { months, byCategory, dataFreshness, categoryCoverage } = data
  const hasMonths = months.length > 0
  const last = hasMonths ? months[months.length - 1] : ''

  // Effective month: latest month in the range where byCategory has any non-zero total.
  // When the latest month is empty (typical mid-month before manual adjustments are entered),
  // we fall back to the most recent month with actual data so the explorer stays useful.
  const effectiveMonth = useMemo(() => {
    if (!hasMonths) return ''
    for (let i = months.length - 1; i >= 0; i--) {
      const m = months[i]
      const sum = byCategory.reduce((s, c) => s + (c.monthlyTotals[m] || 0), 0)
      if (sum > 0) return m
    }
    return last
  }, [months, byCategory, hasMonths, last])

  const prev = useMemo(() => {
    if (!effectiveMonth) return null
    const idx = months.indexOf(effectiveMonth)
    return idx > 0 ? months[idx - 1] : null
  }, [months, effectiveMonth])

  const showEmptyBanner = hasMonths && last && effectiveMonth && last !== effectiveMonth

  const ranked = useMemo(() => {
    return byCategory
      .map(c => {
        const current = effectiveMonth ? (c.monthlyTotals[effectiveMonth] || 0) : 0
        const previous = prev ? (c.monthlyTotals[prev] || 0) : 0
        const delta = current - previous
        const deltaPct = previous > 0 ? (delta / previous) * 100 : null
        const total = months.reduce((s, m) => s + (c.monthlyTotals[m] || 0), 0)
        return { ...c, current, previous, delta, deltaPct, total }
      })
      .filter(c => c.total > 0 || c.current > 0)
      .sort((a, b) => b.current - a.current || b.total - a.total)
  }, [byCategory, effectiveMonth, prev, months])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = ranked.find(c => c.categoryId === selectedId) || ranked[0]

  // Freshness details (for ribbon)
  const lastUpdatedDays = daysSince(dataFreshness?.manualAdjustments?.lastUpdatedAt ?? null)
  const rowsThisMonth = effectiveMonth
    ? (dataFreshness?.manualAdjustments?.rowCountByMonth?.[effectiveMonth] ?? 0)
    : 0
  const coverage = effectiveMonth ? (categoryCoverage?.[effectiveMonth] ?? 0) : 0

  if (!selected) {
    return (
      <div className="space-y-3">
        {showEmptyBanner && <EmptyMonthBanner latestMonth={last} effectiveMonth={effectiveMonth} />}
        <p className="text-sm text-muted-foreground">Sin datos de indirectos en el rango.</p>
      </div>
    )
  }

  const max = ranked[0]?.current || ranked[0]?.total || 0

  const chartRows = months.map(m => ({
    month: formatMonthShort(m),
    value: selected.monthlyTotals[m] || 0,
  }))

  const subRows = (selected.subcategories || [])
    .map(s => {
      const current = s.monthlyTotals[effectiveMonth] || 0
      const total = months.reduce((sum, m) => sum + (s.monthlyTotals[m] || 0), 0)
      return { ...s, current, total }
    })
    .filter(s => s.total > 0 || s.current > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-3">
      {showEmptyBanner && <EmptyMonthBanner latestMonth={last} effectiveMonth={effectiveMonth} />}

      {/* Freshness ribbon */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Última captura: {formatRelativeDays(lastUpdatedDays)}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="tabular-num">
          {rowsThisMonth} ajuste{rowsThisMonth === 1 ? '' : 's'} en {formatMonthLabel(effectiveMonth)}
        </span>
        <span className="text-muted-foreground/60">·</span>
        <span className="tabular-num">
          {coverage} de {TOTAL_EXPENSE_CATEGORIES} categorías con movimiento
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Left: ranked categories */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Categorías · {formatMonthShort(effectiveMonth)}
          </p>
          <div className="max-h-[420px] overflow-y-auto pr-1">
            <div className="divide-y divide-border/40">
              {ranked.map(c => {
                const active = c.categoryId === selected.categoryId
                const pct = max > 0 ? (c.current / max) * 100 : 0
                const Arrow = c.delta > 0 ? ArrowUpRight : c.delta < 0 ? ArrowDownRight : Minus
                const tone =
                  c.delta > 0 ? 'text-rose-600 dark:text-rose-400' :
                  c.delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                return (
                  <button
                    key={c.categoryId}
                    onClick={() => setSelectedId(c.categoryId)}
                    className={cn(
                      'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                      active && 'bg-muted/60'
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.categoryName}</p>
                      <p className="flex-shrink-0 text-sm font-semibold tabular-num">{formatCurrencyCompact(c.current)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${pct}%` }} />
                      </div>
                      <div className={cn('flex min-w-[56px] items-center justify-end gap-0.5 text-[11px] tabular-num', tone)}>
                        <Arrow className="h-3 w-3" />
                        <span>{c.deltaPct !== null ? `${c.deltaPct > 0 ? '+' : ''}${c.deltaPct.toFixed(0)}%` : '—'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: trend + subcategories */}
        <div className="space-y-3 lg:col-span-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tendencia</p>
            <h3 className="text-lg font-semibold">{selected.categoryName}</h3>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ind-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(350 70% 55%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(350 70% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={60} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                        <p className="mb-1 font-medium">{label}</p>
                        <p className="tabular-num">{formatCurrency(Number(payload[0].value))}</p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(350 70% 55%)"
                  strokeWidth={2}
                  fill="url(#ind-trend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {subRows.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Subcategoría</th>
                    <th className="px-3 py-1.5 text-right font-medium">Mes actual</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total rango</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {subRows.map(s => (
                    <tr key={s.name} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5">{s.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-num">{formatCurrency(s.current)}</td>
                      <td className="px-3 py-1.5 text-right tabular-num text-muted-foreground">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyMonthBanner({ latestMonth, effectiveMonth }: { latestMonth: string; effectiveMonth: string }) {
  return (
    <div className="callout-attention flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium">{formatMonthLabel(latestMonth)}</span>
          {' '}aún sin captura de ajustes manuales. Mostrando{' '}
          <span className="font-medium">{formatMonthLabel(effectiveMonth)}</span>.
        </div>
      </div>
      <Link
        href={`/reportes/gerencial/manual-costs?month=${latestMonth}`}
        className="text-xs font-medium underline-offset-2 hover:underline"
      >
        Capturar ahora →
      </Link>
    </div>
  )
}
