'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMonthShort, formatPercent } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function MarginLadderChart({ data }: Props) {
  const { months, summary } = data

  const rows = months.map(m => {
    const ventas = summary.ventasTotal[m] || 0
    const pv = summary.pvUnitario[m] || 0
    const spreadPct = pv > 0 ? (summary.spreadUnitario[m] / pv) * 100 : 0
    return {
      month: formatMonthShort(m),
      Spread: Number(spreadPct.toFixed(1)),
      EBITDA: Number((summary.ebitdaPct[m] || 0).toFixed(1)),
      'EBITDA c/bombeo': Number((summary.ebitdaConBombeoPct[m] || 0).toFixed(1)),
    }
  })

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            tickLine={false}
            axisLine={false}
            className="text-xs"
            width={50}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                  <p className="mb-1 font-medium">{label}</p>
                  {payload.map(p => (
                    <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 tabular-num">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                        {String(p.dataKey)}
                      </span>
                      <span>{formatPercent(Number(p.value))}</span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Spread" stroke="hsl(35 85% 55%)" strokeWidth={2} dot={{ r: 2.5 }} />
          <Line type="monotone" dataKey="EBITDA" stroke="hsl(240 65% 55%)" strokeWidth={2} dot={{ r: 2.5 }} />
          <Line type="monotone" dataKey="EBITDA c/bombeo" stroke="hsl(170 55% 45%)" strokeWidth={2} dot={{ r: 2.5 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
