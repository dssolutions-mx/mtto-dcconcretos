'use client'

import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

export function PlantRevenueRanking({ data }: Props) {
  const { months, byPlant } = data
  if (months.length === 0) return null
  const last = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : null

  const rows = byPlant
    .map(p => {
      const current = (p.ventasTotal[last] || 0) + (p.ingresosBombeoTotal[last] || 0)
      const previous = prev ? (p.ventasTotal[prev] || 0) + (p.ingresosBombeoTotal[prev] || 0) : 0
      const delta = current - previous
      const deltaPct = previous > 0 ? (delta / previous) * 100 : null
      return { ...p, current, previous, delta, deltaPct }
    })
    .filter(r => r.current > 0)
    .sort((a, b) => b.current - a.current)

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin ventas en el mes seleccionado.</p>
  }

  const max = rows[0].current

  return (
    <div className="divide-y divide-border/50">
      {rows.map(r => {
        const pct = max > 0 ? (r.current / max) * 100 : 0
        const Arrow = r.delta > 0 ? ArrowUpRight : r.delta < 0 ? ArrowDownRight : Minus
        const tone =
          r.delta > 0 ? 'text-emerald-600 dark:text-emerald-400' :
          r.delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
        return (
          <div key={r.plantId} className="flex items-center gap-3 py-2">
            <div className="w-10 flex-shrink-0 text-xs font-medium text-muted-foreground tabular-num">
              {r.plantCode}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{r.plantName}</p>
                <p className="text-sm font-semibold tabular-num">{formatCurrency(r.current)}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className={cn('flex min-w-[60px] items-center justify-end gap-1 text-xs tabular-num', tone)}>
                  <Arrow className="h-3 w-3" />
                  <span>{r.deltaPct !== null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
