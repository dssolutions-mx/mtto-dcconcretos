'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RhReportMetric = {
  id: string
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  accent?: 'default' | 'positive' | 'warning' | 'negative'
}

const accentClasses: Record<NonNullable<RhReportMetric['accent']>, string> = {
  default: 'text-foreground',
  positive: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  negative: 'text-red-700 dark:text-red-400',
}

export function RhReportMetricStrip({ metrics }: { metrics: RhReportMetric[] }) {
  if (metrics.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <div
            key={metric.id}
            className="rounded-xl border border-border/60 bg-card px-4 py-3 sm:px-4 sm:py-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </p>
              {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" /> : null}
            </div>
            <p
              className={cn(
                'mt-2 text-2xl font-semibold tabular-nums leading-none',
                accentClasses[metric.accent ?? 'default']
              )}
            >
              {metric.value}
            </p>
            {metric.hint ? (
              <p className="mt-2 text-xs text-muted-foreground leading-snug">{metric.hint}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
