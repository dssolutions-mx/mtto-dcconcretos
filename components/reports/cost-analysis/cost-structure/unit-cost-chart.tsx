'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatCurrencyCompact, formatMonthShort } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function UnitCostChart({ data }: Props) {
  const { months, summary } = data

  const rows = months.map(m => {
    const vol = summary.totalVolume[m] || 0
    const safe = (n: number) => (vol > 0 ? n / vol : 0)
    return {
      month: formatMonthShort(m),
      'Materia prima': safe(summary.costoMpTotal[m] || 0),
      Diesel: safe(summary.dieselTotal[m] || 0),
      Mantenimiento: safe(summary.manttoTotal[m] || 0),
      Nómina: safe(summary.nomina[m] || 0),
      'Otros indirectos': safe(summary.otrosIndirectos[m] || 0),
    }
  })

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
          <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={60} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const total = payload.reduce((s, p) => s + Number(p.value || 0), 0)
              return (
                <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                  <p className="mb-1.5 font-medium">{label}</p>
                  {payload.map(p => (
                    <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 tabular-num">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                        {String(p.dataKey)}
                      </span>
                      <span>{formatCurrency(Number(p.value))}/m³</span>
                    </div>
                  ))}
                  <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-border/40 pt-1.5 tabular-num font-medium">
                    <span>Costo total / m³</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              )
            }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Materia prima" stackId="u" fill="hsl(35 85% 55%)" />
          <Bar dataKey="Diesel" stackId="u" fill="hsl(15 70% 55%)" />
          <Bar dataKey="Mantenimiento" stackId="u" fill="hsl(220 15% 45%)" />
          <Bar dataKey="Nómina" stackId="u" fill="hsl(240 55% 55%)" />
          <Bar dataKey="Otros indirectos" stackId="u" fill="hsl(280 50% 55%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
