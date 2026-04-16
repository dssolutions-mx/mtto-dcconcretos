'use client'

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sparkline } from './sparkline'
import { formatDelta } from '../formatters'

type Accent = 'revenue' | 'cost' | 'material' | 'margin' | 'volume' | 'indirect'

const ACCENT_STYLES: Record<Accent, { bar: string; stroke: string }> = {
  revenue: { bar: 'from-emerald-500/80 to-emerald-400/50', stroke: 'hsl(152 60% 42%)' },
  cost: { bar: 'from-slate-600/80 to-slate-500/40', stroke: 'hsl(220 10% 40%)' },
  material: { bar: 'from-amber-500/80 to-amber-400/50', stroke: 'hsl(35 85% 50%)' },
  margin: { bar: 'from-indigo-500/80 to-indigo-400/50', stroke: 'hsl(240 65% 55%)' },
  volume: { bar: 'from-sky-500/80 to-sky-400/50', stroke: 'hsl(205 75% 48%)' },
  indirect: { bar: 'from-rose-500/80 to-rose-400/50', stroke: 'hsl(350 70% 55%)' },
}

type Props = {
  label: string
  value: string
  subValue?: string
  delta?: number
  deltaPct?: number | null
  deltaIsPercent?: boolean
  /** If true, a positive delta is colored red and negative green (for expense metrics). */
  invertDeltaColor?: boolean
  series?: number[]
  accent?: Accent
}

export function KpiTile({
  label,
  value,
  subValue,
  delta,
  deltaPct,
  deltaIsPercent,
  invertDeltaColor = false,
  series,
  accent = 'revenue',
}: Props) {
  const styles = ACCENT_STYLES[accent]
  const hasDelta = delta !== undefined && delta !== 0
  const goodDirection = invertDeltaColor ? (delta ?? 0) < 0 : (delta ?? 0) > 0
  const deltaClass = !hasDelta
    ? 'text-muted-foreground'
    : goodDirection
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-600 dark:text-rose-400'
  const Arrow = !hasDelta ? Minus : (delta ?? 0) > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className="relative flex min-h-[136px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-3.5 sm:px-5 sm:py-4">
      <div className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', styles.bar)} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>

      <p
        className="mt-1.5 font-semibold tabular-num leading-none tracking-tight"
        style={{ fontSize: 'clamp(1.4rem, 3.2vw, 2.1rem)' }}
      >
        {value}
      </p>

      {subValue && <p className="mt-1 text-xs text-muted-foreground tabular-num">{subValue}</p>}

      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className={cn('flex items-center gap-1 text-xs font-medium tabular-num', deltaClass)}>
          <Arrow className="h-3.5 w-3.5" />
          {hasDelta ? (
            <>
              <span>{formatDelta(delta ?? 0, deltaIsPercent)}</span>
              {deltaPct !== null && deltaPct !== undefined && !deltaIsPercent && (
                <span className="text-muted-foreground">({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">sin cambio</span>
          )}
        </div>

        {series && series.length > 1 && (
          <div className="flex-shrink-0" style={{ width: 96 }}>
            <Sparkline data={series} stroke={styles.stroke} height={32} />
          </div>
        )}
      </div>
    </div>
  )
}
