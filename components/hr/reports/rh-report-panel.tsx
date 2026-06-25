'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type RhReportPanelProps = {
  title: string
  description?: string
  count?: number
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function RhReportPanel({
  title,
  description,
  count,
  actions,
  children,
  className,
}: RhReportPanelProps) {
  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-border/60 bg-card', className)}
    >
      <div className="flex flex-col gap-3 border-b border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {typeof count === 'number' ? (
              <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground">
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-0 py-0">{children}</div>
    </section>
  )
}
