'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const config: Record<string, { label: string; className: string }> = {
  on_time: {
    label: 'A tiempo',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  late: {
    label: 'Tarde',
    className: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100',
  },
  absent: {
    label: 'Ausente',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200',
  },
}

export function PunctualityStatusBadge({ status }: { status: string }) {
  const item = config[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground',
  }
  return (
    <Badge variant="outline" className={cn('tabular-nums font-medium', item.className)}>
      {item.label}
    </Badge>
  )
}

export function punctualityLabel(status: string): string {
  return config[status]?.label ?? status
}
