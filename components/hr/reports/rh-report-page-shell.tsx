'use client'

import type { ReactNode } from 'react'
import { Clock, DollarSign, Shield, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RhReportVariant = 'punctuality' | 'cleanliness' | 'bonus' | 'security'

const variantConfig: Record<
  RhReportVariant,
  { icon: typeof Clock; accentClass: string; label: string }
> = {
  punctuality: {
    icon: Clock,
    accentClass: 'border-l-sky-600/70 bg-sky-50/40 dark:bg-sky-950/20',
    label: 'Puntualidad',
  },
  cleanliness: {
    icon: Sparkles,
    accentClass: 'border-l-emerald-600/70 bg-emerald-50/40 dark:bg-emerald-950/20',
    label: 'Limpieza',
  },
  bonus: {
    icon: DollarSign,
    accentClass: 'border-l-violet-600/70 bg-violet-50/40 dark:bg-violet-950/20',
    label: 'Bonos',
  },
  security: {
    icon: Shield,
    accentClass: 'border-l-orange-600/70 bg-orange-50/40 dark:bg-orange-950/20',
    label: 'Charlas de seguridad',
  },
}

type RhReportPageShellProps = {
  variant: RhReportVariant
  title: string
  description: string
  filters?: ReactNode
  metrics?: ReactNode
  children: ReactNode
}

export function RhReportPageShell({
  variant,
  title,
  description,
  filters,
  metrics,
  children,
}: RhReportPageShellProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div className="space-y-6">
      <header
        className={cn(
          'rounded-xl border border-border/60 border-l-4 px-4 py-4 sm:px-6 sm:py-5',
          config.accentClass
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
            <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Reporte RH · {config.label}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </header>

      {filters ? <div className="space-y-4">{filters}</div> : null}
      {metrics ? <div>{metrics}</div> : null}
      <div className="space-y-4">{children}</div>
    </div>
  )
}
