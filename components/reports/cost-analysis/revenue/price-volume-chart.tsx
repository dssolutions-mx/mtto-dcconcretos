'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatCurrencyCompact, formatMonthShort, formatNumber } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function PriceVolumeChart({ data }: Props) {
  const { months, summary } = data
  const rows = months.map(m => ({
    month: formatMonthShort(m),
    volumen: summary.totalVolume[m] || 0,
    precio: summary.pvUnitario[m] || 0,
  }))

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatNumber(v, 0)}
            tickLine={false}
            axisLine={false}
            className="text-xs"
            width={60}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatCurrencyCompact}
            tickLine={false}
            axisLine={false}
            className="text-xs"
            width={60}
          />
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
                        {String(p.dataKey) === 'volumen' ? 'Volumen (m³)' : 'Precio/m³'}
                      </span>
                      <span>
                        {String(p.dataKey) === 'volumen'
                          ? `${formatNumber(Number(p.value), 0)} m³`
                          : formatCurrency(Number(p.value))}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="volumen" name="Volumen (m³)" fill="hsl(205 75% 70%)" radius={[4, 4, 0, 0]} barSize={22} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="precio"
            name="Precio/m³"
            stroke="hsl(240 65% 55%)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
