'use client'

import { useMemo } from 'react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyCompact, formatMonthShort, formatPercent } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

type BucketKey = 'corrective' | 'preventive' | 'inspection' | 'other'

const BUCKET_CONFIG: Record<BucketKey, { label: string; color: string; tone: string }> = {
  corrective: {
    label: 'Correctivo',
    color: 'hsl(350 70% 55%)',
    tone: 'Reactivo — apaga incendios',
  },
  preventive: {
    label: 'Preventivo',
    color: 'hsl(152 60% 42%)',
    tone: 'Planeado — mantiene salud',
  },
  inspection: {
    label: 'Inspección',
    color: 'hsl(220 15% 55%)',
    tone: 'Base — vigilancia',
  },
  other: {
    label: 'Otros',
    color: 'hsl(220 10% 70%)',
    tone: 'Sin tipo registrado',
  },
}

export function ManttoTypeSplit({ data }: Props) {
  const { months, manttoByType } = data

  const chartRows = useMemo(() => {
    return months.map(m => {
      const b = manttoByType?.[m] || { corrective: 0, preventive: 0, inspection: 0, other: 0 }
      return {
        month: formatMonthShort(m),
        _ym: m,
        correctivo: b.corrective,
        preventivo: b.preventive,
        inspeccion: b.inspection,
        otros: b.other,
      }
    })
  }, [months, manttoByType])

  // Find latest month with any mantto data, fall back to last month in range.
  const { current, previous } = useMemo(() => {
    if (months.length === 0) {
      const empty = { corrective: 0, preventive: 0, inspection: 0, other: 0 }
      return { current: { ym: '', bucket: empty }, previous: { ym: '', bucket: empty } }
    }
    const hasData = (m: string) => {
      const b = manttoByType?.[m]
      if (!b) return false
      return b.corrective + b.preventive + b.inspection + b.other > 0
    }
    let currIdx = months.length - 1
    for (let i = months.length - 1; i >= 0; i--) {
      if (hasData(months[i])) {
        currIdx = i
        break
      }
    }
    const prevIdx = currIdx > 0 ? currIdx - 1 : -1
    const emptyBucket = { corrective: 0, preventive: 0, inspection: 0, other: 0 }
    return {
      current: { ym: months[currIdx], bucket: manttoByType?.[months[currIdx]] || emptyBucket },
      previous: prevIdx >= 0
        ? { ym: months[prevIdx], bucket: manttoByType?.[months[prevIdx]] || emptyBucket }
        : { ym: '', bucket: emptyBucket },
    }
  }, [months, manttoByType])

  const currentTotal =
    current.bucket.corrective + current.bucket.preventive + current.bucket.inspection + current.bucket.other
  const hasOther = current.bucket.other > 0

  const anyData = useMemo(
    () =>
      Object.values(manttoByType || {}).some(
        b => b.corrective + b.preventive + b.inspection + b.other > 0
      ),
    [manttoByType]
  )

  if (!anyData) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Sin órdenes de compra vinculadas a órdenes de trabajo en el rango seleccionado.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 3-tile summary */}
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', hasOther && 'sm:grid-cols-4')}>
        <BucketTile
          bucket="corrective"
          current={current.bucket.corrective}
          previous={previous.bucket.corrective}
          totalCurrent={currentTotal}
        />
        <BucketTile
          bucket="preventive"
          current={current.bucket.preventive}
          previous={previous.bucket.preventive}
          totalCurrent={currentTotal}
        />
        <BucketTile
          bucket="inspection"
          current={current.bucket.inspection}
          previous={previous.bucket.inspection}
          totalCurrent={currentTotal}
        />
        {hasOther && (
          <BucketTile
            bucket="other"
            current={current.bucket.other}
            previous={previous.bucket.other}
            totalCurrent={currentTotal}
          />
        )}
      </div>

      {/* Stacked bar by month */}
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis
              tickFormatter={formatCurrencyCompact}
              tickLine={false}
              axisLine={false}
              className="text-xs"
              width={60}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const sum = payload.reduce((s, p) => s + Number(p.value || 0), 0)
                return (
                  <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                    <p className="mb-1 font-medium">{label}</p>
                    {payload.map(p => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-3 tabular-num">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                          {String(p.name)}
                        </span>
                        <span>{formatCurrency(Number(p.value || 0))}</span>
                      </div>
                    ))}
                    <div className="mt-1 border-t border-border/40 pt-1 flex items-center justify-between gap-3 text-muted-foreground tabular-num">
                      <span>Total</span>
                      <span>{formatCurrency(sum)}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="correctivo" stackId="m" name={BUCKET_CONFIG.corrective.label} fill={BUCKET_CONFIG.corrective.color} radius={[0, 0, 0, 0]} />
            <Bar dataKey="preventivo" stackId="m" name={BUCKET_CONFIG.preventive.label} fill={BUCKET_CONFIG.preventive.color} radius={[0, 0, 0, 0]} />
            <Bar dataKey="inspeccion" stackId="m" name={BUCKET_CONFIG.inspection.label} fill={BUCKET_CONFIG.inspection.color} radius={[4, 4, 0, 0]} />
            {hasOther && (
              <Bar dataKey="otros" stackId="m" name={BUCKET_CONFIG.other.label} fill={BUCKET_CONFIG.other.color} radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function BucketTile({
  bucket,
  current,
  previous,
  totalCurrent,
}: {
  bucket: BucketKey
  current: number
  previous: number
  totalCurrent: number
}) {
  const cfg = BUCKET_CONFIG[bucket]
  const delta = current - previous
  const deltaPct = previous > 0 ? (delta / previous) * 100 : null
  const share = totalCurrent > 0 ? (current / totalCurrent) * 100 : 0
  // For corrective, "up" is bad (rose). For preventive, "up" is good (emerald).
  const isExpenseBucket = bucket === 'corrective' || bucket === 'other'
  const hasDelta = delta !== 0
  const goodDirection = isExpenseBucket ? delta < 0 : delta > 0
  const tone = !hasDelta
    ? 'text-muted-foreground'
    : goodDirection
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400'
  const Arrow = !hasDelta ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3">
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: cfg.color }} />
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{cfg.label}</p>
        <span className="text-[11px] text-muted-foreground tabular-num">{formatPercent(share, 0)}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-num leading-none tracking-tight">
        {formatCurrencyCompact(current)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{cfg.tone}</p>
      <div className={cn('mt-2 flex items-center gap-1 text-xs tabular-num', tone)}>
        <Arrow className="h-3.5 w-3.5" />
        {hasDelta ? (
          <>
            <span>{delta > 0 ? '+' : ''}{formatCurrencyCompact(delta)}</span>
            {deltaPct !== null && (
              <span className="text-muted-foreground">({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(0)}%)</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">sin cambio</span>
        )}
      </div>
    </div>
  )
}
