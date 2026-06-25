'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

export function RhReportLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="border-b border-border/50 px-4 py-3 sm:px-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
      </div>
      <div className="divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 sm:px-5">
            <div className="h-4 w-24 animate-pulse rounded bg-muted/50" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted/40" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando datos…
      </div>
    </div>
  )
}

export function RhReportEmpty({
  title = 'Sin registros',
  description,
  children,
}: {
  title?: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
          <Inbox className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  )
}

export function RhReportError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="rounded-xl">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error al cargar el reporte</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>{message}</span>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'shrink-0 text-sm font-medium underline underline-offset-4',
              'hover:no-underline'
            )}
          >
            Reintentar
          </button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
