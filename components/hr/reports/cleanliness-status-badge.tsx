'use client'

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function CleanlinessSectionBadge({
  status,
  notes,
}: {
  status: 'pass' | 'fail'
  notes?: string
}) {
  if (status === 'pass') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <CheckCircle className="mr-1 h-3 w-3" />
        Aprobado
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      {notes?.trim() ? 'Observación' : 'No aprobado'}
    </Badge>
  )
}

export function CleanlinessItemBadge({ status }: { status: 'pass' | 'fail' | 'flag' }) {
  if (status === 'pass') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-100 text-emerald-800 border-emerald-200"
      >
        <CheckCircle className="mr-1 h-3 w-3" />
        Aprobado
      </Badge>
    )
  }
  if (status === 'flag') {
    return (
      <Badge
        variant="outline"
        className="bg-amber-100 text-amber-900 border-amber-200"
      >
        <AlertTriangle className="mr-1 h-3 w-3" />
        Observación
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 h-3 w-3" />
      Falló
    </Badge>
  )
}

export function CleanlinessScoreBadge({ score }: { score: number }) {
  const passed = score >= 75
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
        passed
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
          : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'
      )}
    >
      {score}%
    </span>
  )
}
