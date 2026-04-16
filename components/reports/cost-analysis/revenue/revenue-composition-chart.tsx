'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrencyCompact, formatCurrency, formatMonthShort } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function RevenueCompositionChart({ data }: Props) {
  const { months, summary } = data
  const rows = months.map(m => ({
    month: formatMonthShort(m),
    concreto: summary.ventasTotal[m] || 0,
    bombeo: summary.ingresosBombeoTotal[m] || 0,
    total: (summary.ventasTotal[m] || 0) + (summary.ingresosBombeoTotal[m] || 0),
  }))

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev-concreto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(152 60% 42%)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(152 60% 42%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rev-bombeo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(170 55% 45%)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(170 55% 45%)" stopOpacity={0} />
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
                  {payload.map(p => (
                    <div key={String(p.dataKey)} className="flex items-center justify-between gap-3 tabular-num">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                        {String(p.dataKey)}
                      </span>
                      <span>{formatCurrency(Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="concreto"
            stackId="rev"
            stroke="hsl(152 60% 42%)"
            fill="url(#rev-concreto)"
            strokeWidth={2}
            name="Concreto"
          />
          <Area
            type="monotone"
            dataKey="bombeo"
            stackId="rev"
            stroke="hsl(170 55% 45%)"
            fill="url(#rev-bombeo)"
            strokeWidth={2}
            name="Bombeo"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
