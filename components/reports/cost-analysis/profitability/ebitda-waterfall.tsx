'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatCurrencyCompact, formatMonthLabel, formatPercent } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

type Row = {
  name: string
  /** Invisible floor height (for cascading bars) */
  floor: number
  /** Visible bar height (always positive) */
  bar: number
  /** The actual signed value (for tooltip) */
  value: number
  /** Whether this is a running-total bar (totals) vs a delta */
  isTotal?: boolean
  /** Tone: 'positive' (green) | 'negative' (red) | 'total' (indigo) */
  tone: 'positive' | 'negative' | 'total'
}

const COLORS = {
  positive: 'hsl(152 60% 45%)',
  negative: 'hsl(350 70% 55%)',
  total: 'hsl(240 65% 55%)',
}

export function EbitdaWaterfall({ data }: Props) {
  const { months, summary } = data
  if (months.length === 0) return null
  const m = months[months.length - 1]

  const ventas = summary.ventasTotal[m] || 0
  const mp = summary.costoMpTotal[m] || 0
  const diesel = summary.dieselTotal[m] || 0
  const mantto = summary.manttoTotal[m] || 0
  const nomina = summary.nomina[m] || 0
  const otros = summary.otrosIndirectos[m] || 0
  const bombeo = summary.ingresosBombeoTotal[m] || 0
  const ebitdaCB = summary.ebitdaConBombeo[m] || 0

  // Build waterfall rows. Each deduction lowers the running total; each addition raises it.
  const rows: Row[] = []

  // Start: Ventas concreto (full bar)
  let running = ventas
  rows.push({ name: 'Ventas concreto', floor: 0, bar: ventas, value: ventas, isTotal: true, tone: 'positive' })

  // Deductions
  const deductions: Array<{ name: string; amt: number }> = [
    { name: 'Materia prima', amt: mp },
    { name: 'Diesel', amt: diesel },
    { name: 'Mantto', amt: mantto },
    { name: 'Nómina', amt: nomina },
    { name: 'Otros ind.', amt: otros },
  ]
  for (const d of deductions) {
    if (d.amt <= 0) continue
    running -= d.amt
    rows.push({
      name: d.name,
      floor: Math.max(running, 0),
      bar: d.amt,
      value: -d.amt,
      tone: 'negative',
    })
  }

  // Addition: bombeo
  if (bombeo > 0) {
    rows.push({
      name: 'Bombeo',
      floor: running,
      bar: bombeo,
      value: bombeo,
      tone: 'positive',
    })
    running += bombeo
  }

  // Final: EBITDA
  rows.push({
    name: 'EBITDA',
    floor: 0,
    bar: ebitdaCB > 0 ? ebitdaCB : 0,
    value: ebitdaCB,
    isTotal: true,
    tone: 'total',
  })

  const margin = ventas + bombeo > 0 ? (ebitdaCB / (ventas + bombeo)) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Waterfall · {formatMonthLabel(m)}
        </p>
        <p className="text-xs tabular-num text-muted-foreground">
          EBITDA {formatCurrency(ebitdaCB)} · margen {formatPercent(margin)}
        </p>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" interval={0} />
            <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={60} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as Row
                return (
                  <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                    <p className="mb-0.5 font-medium">{row.name}</p>
                    <p className="tabular-num">
                      {row.isTotal ? formatCurrency(row.value) : `${row.value > 0 ? '+' : ''}${formatCurrency(row.value)}`}
                    </p>
                    {ventas > 0 && !row.isTotal && (
                      <p className="text-muted-foreground tabular-num">
                        {formatPercent((Math.abs(row.value) / ventas) * 100)} de ventas
                      </p>
                    )}
                  </div>
                )
              }}
            />
            {/* Invisible floor bar for cascading effect */}
            <Bar dataKey="floor" stackId="w" fill="transparent" />
            <Bar dataKey="bar" stackId="w" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => (
                <Cell key={i} fill={COLORS[r.tone]} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={((v: unknown) => {
                  const n = Number(v)
                  return n === 0 || Number.isNaN(n) ? '' : formatCurrencyCompact(n)
                }) as never}
                className="fill-foreground text-[10px] tabular-num"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
