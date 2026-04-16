'use client'

import type { CostAnalysisPlantRow } from '@/lib/reports/cost-analysis-aggregate'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatMonthLabel, formatMonthShort, formatNumber, formatPercent } from '../formatters'

type Props = {
  plant: CostAnalysisPlantRow | null
  months: string[]
  onClose: () => void
}

type Driver = {
  metric: string
  current: number
  previous: number
  delta: number
  deltaPct: number | null
  invertTone?: boolean
  format: (v: number) => string
}

export function PlantDrawer({ plant, months, onClose }: Props) {
  const open = plant !== null
  if (!plant || months.length === 0) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" />
      </Sheet>
    )
  }

  const last = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : null

  const ventasCurrent = (plant.ventasTotal[last] || 0) + (plant.ingresosBombeoTotal[last] || 0)
  const ventasPrev = prev ? (plant.ventasTotal[prev] || 0) + (plant.ingresosBombeoTotal[prev] || 0) : 0

  // Candidate drivers sorted by |deltaPct|
  const candidates: Driver[] = [
    { metric: 'Costo MP', current: plant.costoMpTotal[last] || 0, previous: prev ? plant.costoMpTotal[prev] || 0 : 0, delta: 0, deltaPct: null, invertTone: true, format: formatCurrencyCompact },
    { metric: 'Diesel', current: plant.dieselTotal[last] || 0, previous: prev ? plant.dieselTotal[prev] || 0 : 0, delta: 0, deltaPct: null, invertTone: true, format: formatCurrencyCompact },
    { metric: 'Mantenimiento', current: plant.manttoTotal[last] || 0, previous: prev ? plant.manttoTotal[prev] || 0 : 0, delta: 0, deltaPct: null, invertTone: true, format: formatCurrencyCompact },
    { metric: 'Nómina', current: plant.nomina[last] || 0, previous: prev ? plant.nomina[prev] || 0 : 0, delta: 0, deltaPct: null, invertTone: true, format: formatCurrencyCompact },
    { metric: 'Otros indirectos', current: plant.otrosIndirectos[last] || 0, previous: prev ? plant.otrosIndirectos[prev] || 0 : 0, delta: 0, deltaPct: null, invertTone: true, format: formatCurrencyCompact },
    { metric: 'Volumen', current: plant.volume[last] || 0, previous: prev ? plant.volume[prev] || 0 : 0, delta: 0, deltaPct: null, format: (v: number) => `${formatNumber(v, 0)} m³` },
    { metric: 'Precio unitario', current: plant.pvUnitario[last] || 0, previous: prev ? plant.pvUnitario[prev] || 0 : 0, delta: 0, deltaPct: null, format: (v: number) => `${formatCurrency(v)}/m³` },
  ].map(d => {
    const delta = d.current - d.previous
    const deltaPct = d.previous !== 0 ? (delta / Math.abs(d.previous)) * 100 : null
    return { ...d, delta, deltaPct }
  })

  const topDrivers = candidates
    .filter(d => d.deltaPct !== null && Math.abs(d.deltaPct) >= 1)
    .sort((a, b) => Math.abs(b.deltaPct || 0) - Math.abs(a.deltaPct || 0))
    .slice(0, 3)

  // Trend data for all key metrics
  const trendRows = months.map(m => ({
    month: formatMonthShort(m),
    Ventas: (plant.ventasTotal[m] || 0) + (plant.ingresosBombeoTotal[m] || 0),
    'Costo op.': plant.totalCostoOp[m] || 0,
    MP: plant.costoMpTotal[m] || 0,
    EBITDA: plant.ebitdaConBombeo[m] || 0,
  }))

  const pnl: Array<{ label: string; value: number; invert?: boolean; strong?: boolean }> = [
    { label: 'Ventas concreto', value: plant.ventasTotal[last] || 0 },
    { label: 'Ingresos bombeo', value: plant.ingresosBombeoTotal[last] || 0 },
    { label: '(−) Costo materia prima', value: -(plant.costoMpTotal[last] || 0), invert: true },
    { label: '(−) Diesel', value: -(plant.dieselTotal[last] || 0), invert: true },
    { label: '(−) Mantenimiento', value: -(plant.manttoTotal[last] || 0), invert: true },
    { label: '(−) Nómina', value: -(plant.nomina[last] || 0), invert: true },
    { label: '(−) Otros indirectos', value: -(plant.otrosIndirectos[last] || 0), invert: true },
    { label: 'EBITDA', value: plant.ebitdaConBombeo[last] || 0, strong: true },
  ]

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-baseline gap-2">
            <span className="text-xs font-normal text-muted-foreground tabular-num">{plant.plantCode}</span>
            <span>{plant.plantName}</span>
          </SheetTitle>
          <SheetDescription>
            P&amp;L de {formatMonthLabel(last)} · {months.length} meses de tendencia
          </SheetDescription>
        </SheetHeader>

        {/* Headline */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ventas</p>
            <p className="text-xl font-semibold tabular-num">{formatCurrency(ventasCurrent)}</p>
            {ventasPrev > 0 && (
              <p className={cn('text-xs tabular-num', ventasCurrent >= ventasPrev ? 'text-emerald-600' : 'text-rose-600')}>
                {ventasCurrent >= ventasPrev ? '+' : ''}
                {(((ventasCurrent - ventasPrev) / ventasPrev) * 100).toFixed(1)}% vs mes anterior
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">EBITDA</p>
            <p className="text-xl font-semibold tabular-num">{formatCurrency(plant.ebitdaConBombeo[last] || 0)}</p>
            <p className="text-xs tabular-num text-muted-foreground">
              {formatPercent(plant.ebitdaConBombeoPct[last] || 0)} margen
            </p>
          </div>
        </div>

        {/* Top variance drivers */}
        {topDrivers.length > 0 && (
          <section className="mt-5">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Principales variaciones vs mes anterior
            </h4>
            <div className="space-y-1.5">
              {topDrivers.map(d => {
                const goodDirection = d.invertTone ? d.delta < 0 : d.delta > 0
                const tone = goodDirection ? 'text-emerald-600' : 'text-rose-600'
                const Arrow = d.delta > 0 ? ArrowUpRight : ArrowDownRight
                return (
                  <div
                    key={d.metric}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Arrow className={cn('h-4 w-4', tone)} />
                      <span className="text-sm font-medium">{d.metric}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm tabular-num">
                        {d.format(d.current)} <span className="text-muted-foreground">← {d.format(d.previous)}</span>
                      </div>
                      <div className={cn('text-xs tabular-num', tone)}>
                        {d.deltaPct !== null ? `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* P&L */}
        <section className="mt-5">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            P&amp;L · {formatMonthLabel(last)}
          </h4>
          <div className="divide-y divide-border/40 rounded-lg border border-border/50">
            {pnl.map(row => (
              <div
                key={row.label}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-1.5',
                  row.strong && 'bg-muted/40 font-semibold'
                )}
              >
                <span className={cn('text-sm', row.invert && 'text-muted-foreground')}>{row.label}</span>
                <span className="text-sm tabular-num">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Trend */}
        <section className="mt-5">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tendencia
          </h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={50} />
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
                            <span>{formatCurrency(Number(p.value))}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Ventas" stroke="hsl(152 60% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="MP" stroke="hsl(35 85% 55%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Costo op." stroke="hsl(220 15% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EBITDA" stroke="hsl(240 65% 55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  )
}
