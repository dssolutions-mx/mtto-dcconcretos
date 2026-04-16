'use client'

import { useMemo, useState } from 'react'
import type { CostAnalysisResponse, CostAnalysisCategoryRow } from '@/lib/reports/cost-analysis-aggregate'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatMonthShort } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function IndirectExplorer({ data }: Props) {
  const { months, byCategory } = data
  const hasMonths = months.length > 0
  const last = hasMonths ? months[months.length - 1] : ''
  const prev = months.length > 1 ? months[months.length - 2] : null

  const ranked = useMemo(() => {
    return byCategory
      .map(c => {
        const current = hasMonths ? (c.monthlyTotals[last] || 0) : 0
        const previous = prev ? (c.monthlyTotals[prev] || 0) : 0
        const delta = current - previous
        const deltaPct = previous > 0 ? (delta / previous) * 100 : null
        return { ...c, current, previous, delta, deltaPct }
      })
      .sort((a, b) => b.current - a.current)
  }, [byCategory, last, prev, hasMonths])

  const [selectedId, setSelectedId] = useState<string | null>(ranked[0]?.categoryId || null)
  const selected = ranked.find(c => c.categoryId === selectedId) || ranked[0]

  if (!selected) {
    return <p className="text-sm text-muted-foreground">Sin datos de indirectos en el rango.</p>
  }

  const max = ranked[0]?.current || 0

  const chartRows = months.map(m => ({
    month: formatMonthShort(m),
    value: selected.monthlyTotals[m] || 0,
  }))

  const subRows = (selected.subcategories || [])
    .map(s => {
      const current = s.monthlyTotals[last] || 0
      const total = months.reduce((sum, m) => sum + (s.monthlyTotals[m] || 0), 0)
      return { ...s, current, total }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* Left: ranked categories */}
      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Categorías · {formatMonthShort(last)}
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
  )
}
