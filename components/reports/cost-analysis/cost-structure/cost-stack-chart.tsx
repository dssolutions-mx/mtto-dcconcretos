'use client'

import { useState } from 'react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatCurrency, formatCurrencyCompact, formatMonthShort, formatPercent } from '../formatters'

type Mode = 'absolute' | 'percent'

type Props = {
  data: CostAnalysisResponse
}

const COLORS = {
  mp: 'hsl(35 85% 55%)',
  diesel: 'hsl(15 70% 55%)',
  mantto: 'hsl(220 15% 45%)',
  nomina: 'hsl(240 55% 55%)',
  otros: 'hsl(280 50% 55%)',
}

export function CostStackChart({ data }: Props) {
  const [mode, setMode] = useState<Mode>('absolute')
  const { months, summary } = data

  const rows = months.map(m => {
    const mp = summary.costoMpTotal[m] || 0
    const diesel = summary.dieselTotal[m] || 0
    const mantto = summary.manttoTotal[m] || 0
    const nomina = summary.nomina[m] || 0
    const otros = summary.otrosIndirectos[m] || 0
    const total = mp + diesel + mantto + nomina + otros
    if (mode === 'percent' && total > 0) {
      return {
        month: formatMonthShort(m),
        'Materia prima': (mp / total) * 100,
        Diesel: (diesel / total) * 100,
        Mantenimiento: (mantto / total) * 100,
        Nómina: (nomina / total) * 100,
        'Otros indirectos': (otros / total) * 100,
      }
    }
    return {
      month: formatMonthShort(m),
      'Materia prima': mp,
      Diesel: diesel,
      Mantenimiento: mantto,
      Nómina: nomina,
      'Otros indirectos': otros,
    }
  })

  const tickFmt = mode === 'percent' ? (v: number) => `${v.toFixed(0)}%` : formatCurrencyCompact

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={v => v && setMode(v as Mode)}
          size="sm"
          className="rounded-md border border-border/60 bg-muted/40 p-0.5"
        >
          <ToggleGroupItem value="absolute" className="text-xs data-[state=on]:bg-background">Absoluto</ToggleGroupItem>
          <ToggleGroupItem value="percent" className="text-xs data-[state=on]:bg-background">100%</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis tickFormatter={tickFmt} tickLine={false} axisLine={false} className="text-xs" width={60} />
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
                        <span>
                          {mode === 'percent'
                            ? formatPercent(Number(p.value))
                            : formatCurrency(Number(p.value))}
                        </span>
                      </div>
                    ))}
                    {mode === 'absolute' && (
                      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-border/40 pt-1.5 tabular-num font-medium">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    )}
                  </div>
                )
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Materia prima" stackId="c" fill={COLORS.mp} />
            <Bar dataKey="Diesel" stackId="c" fill={COLORS.diesel} />
            <Bar dataKey="Mantenimiento" stackId="c" fill={COLORS.mantto} />
            <Bar dataKey="Nómina" stackId="c" fill={COLORS.nomina} />
            <Bar dataKey="Otros indirectos" stackId="c" fill={COLORS.otros} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
