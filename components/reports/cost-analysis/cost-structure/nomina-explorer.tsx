'use client'

import { useMemo, useState } from 'react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatMonthShort } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function NominaExplorer({ data }: Props) {
  const { months, byDepartment } = data
  const nominaDepts = byDepartment.filter(d => d.type === 'nomina')
  const hasMonths = months.length > 0
  const last = hasMonths ? months[months.length - 1] : ''
  const prev = months.length > 1 ? months[months.length - 2] : null

  const ranked = useMemo(() => {
    return nominaDepts
      .map(d => {
        const current = hasMonths ? (d.monthlyTotals[last] || 0) : 0
        const previous = prev ? (d.monthlyTotals[prev] || 0) : 0
        const delta = current - previous
        const deltaPct = previous > 0 ? (delta / previous) * 100 : null
        const total = months.reduce((s, m) => s + (d.monthlyTotals[m] || 0), 0)
        return { ...d, current, previous, delta, deltaPct, total }
      })
      .filter(d => d.total > 0)
      .sort((a, b) => b.current - a.current)
  }, [nominaDepts, last, prev, months, hasMonths])

  const [selectedDept, setSelectedDept] = useState<string | null>(ranked[0]?.department || null)
  const selected = ranked.find(d => d.department === selectedDept) || ranked[0]

  if (!selected) {
    return <p className="text-sm text-muted-foreground">Sin datos de nómina en el rango.</p>
  }

  const max = ranked[0]?.current || 0
  const chartRows = months.map(m => ({
    month: formatMonthShort(m),
    value: selected.monthlyTotals[m] || 0,
  }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Departamentos · {formatMonthShort(last)}
        </p>
        <div className="max-h-[420px] overflow-y-auto pr-1">
          <div className="divide-y divide-border/40">
            {ranked.map(d => {
              const active = d.department === selected.department
              const pct = max > 0 ? (d.current / max) * 100 : 0
              const Arrow = d.delta > 0 ? ArrowUpRight : d.delta < 0 ? ArrowDownRight : Minus
              const tone =
                d.delta > 0 ? 'text-rose-600 dark:text-rose-400' :
                d.delta < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              return (
                <button
                  key={d.department}
                  onClick={() => setSelectedDept(d.department)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                    active && 'bg-muted/60'
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{d.department}</p>
                    <p className="flex-shrink-0 text-sm font-semibold tabular-num">{formatCurrencyCompact(d.current)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn('flex min-w-[56px] items-center justify-end gap-0.5 text-[11px] tabular-num', tone)}>
                      <Arrow className="h-3 w-3" />
                      <span>{d.deltaPct !== null ? `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(0)}%` : '—'}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3 lg:col-span-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tendencia de nómina</p>
          <h3 className="text-lg font-semibold">{selected.department}</h3>
          <p className="text-xs text-muted-foreground tabular-num">
            Total en rango: {formatCurrency(selected.total)}
          </p>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nom-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(240 55% 55%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(240 55% 55%)" stopOpacity={0} />
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
                stroke="hsl(240 55% 55%)"
                strokeWidth={2}
                fill="url(#nom-trend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
