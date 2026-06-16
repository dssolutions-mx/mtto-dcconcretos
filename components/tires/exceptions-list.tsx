'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TireException, TireExceptionCounts, TireExceptionPriority } from '@/lib/tires/exceptions'
import { EXCEPTION_TYPE_LABELS } from '@/lib/tires/exceptions'

const DISMISS_STORAGE_KEY = 'tire-exceptions-dismissed'

const PRIORITY_BADGE: Record<TireExceptionPriority, 'destructive' | 'default' | 'secondary'> = {
  P1: 'destructive',
  P2: 'default',
  P3: 'secondary',
}

interface PriorityStyle {
  label: string
  icon: LucideIcon
  /** Left accent + icon color. */
  accent: string
  iconColor: string
  chip: string
}

const PRIORITY_STYLES: Record<TireExceptionPriority, PriorityStyle> = {
  P1: {
    label: 'Crítica',
    icon: AlertOctagon,
    accent: 'before:bg-red-500',
    iconColor: 'text-red-600 dark:text-red-400',
    chip: 'data-[active=true]:border-red-500 data-[active=true]:bg-red-50 dark:data-[active=true]:bg-red-950/40',
  },
  P2: {
    label: 'Atención',
    icon: AlertTriangle,
    accent: 'before:bg-amber-500',
    iconColor: 'text-amber-600 dark:text-amber-400',
    chip: 'data-[active=true]:border-amber-500 data-[active=true]:bg-amber-50 dark:data-[active=true]:bg-amber-950/40',
  },
  P3: {
    label: 'Informativa',
    icon: Info,
    accent: 'before:bg-slate-400',
    iconColor: 'text-slate-500 dark:text-slate-400',
    chip: 'data-[active=true]:border-slate-400 data-[active=true]:bg-slate-50 dark:data-[active=true]:bg-slate-900/40',
  },
}

function loadDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]))
}

function buildWorkOrderHref(ex: TireException): string {
  const params = new URLSearchParams()
  if (ex.asset_id) params.set('assetId', ex.asset_id)
  const parts = [
    'Alerta de llantas',
    ex.title,
    ex.description,
    ex.position_label ? `Posición: ${ex.position_label}` : null,
  ].filter(Boolean)
  params.set('description', parts.join(' — '))
  return `/ordenes/crear?${params.toString()}`
}

interface ExceptionsListProps {
  showFilters?: boolean
  compact?: boolean
}

export function ExceptionsList({ showFilters = true, compact = false }: ExceptionsListProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [exceptions, setExceptions] = useState<TireException[]>([])
  const [counts, setCounts] = useState<TireExceptionCounts>({ P1: 0, P2: 0, P3: 0, total: 0 })
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = priorityFilter !== 'all' ? `?priority=${priorityFilter}` : ''
      const res = await fetch(`/api/tires/exceptions${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar excepciones')
      setExceptions(data.exceptions ?? [])
      setCounts(data.counts ?? { P1: 0, P2: 0, P3: 0, total: 0 })
    } finally {
      setLoading(false)
    }
  }, [priorityFilter])

  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleExceptions = useMemo(
    () => exceptions.filter((ex) => !dismissed.has(ex.id)),
    [exceptions, dismissed]
  )

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    setDismissed(next)
    saveDismissed(next)
  }

  const assetHref = (ex: TireException) => {
    if (!ex.asset_id) return null
    const base = `/activos/${ex.asset_id}/llantas`
    return ex.position_code ? `${base}?position=${ex.position_code}` : base
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PriorityChip
            label="Todas"
            count={counts.total}
            active={priorityFilter === 'all'}
            onClick={() => setPriorityFilter('all')}
          />
          {(['P1', 'P2', 'P3'] as TireExceptionPriority[]).map((p) => {
            const style = PRIORITY_STYLES[p]
            const Icon = style.icon
            return (
              <button
                key={p}
                type="button"
                data-active={priorityFilter === p}
                onClick={() => setPriorityFilter(priorityFilter === p ? 'all' : p)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:bg-muted/50',
                  style.chip
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', style.iconColor)} />
                  <span className="text-sm font-medium">
                    {p} {style.label}
                  </span>
                </span>
                <span className="text-base font-semibold tabular-num">{counts[p]}</span>
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visibleExceptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            <p className="font-medium">Sin excepciones pendientes</p>
            <p className="text-sm text-muted-foreground">
              Toda la flota está dentro de los parámetros configurados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleExceptions.map((ex) => {
            const style = PRIORITY_STYLES[ex.priority]
            const Icon = style.icon
            return (
            <Card
              key={ex.id}
              className={cn(
                'relative overflow-hidden pl-1 before:absolute before:inset-y-0 before:left-0 before:w-1',
                style.accent
              )}
            >
              <CardContent className={`${compact ? 'py-3' : 'py-4'} space-y-3`}>
                <div className="flex items-start gap-3">
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconColor)} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={PRIORITY_BADGE[ex.priority]}>{ex.priority}</Badge>
                      <Badge variant="outline">{EXCEPTION_TYPE_LABELS[ex.type]}</Badge>
                    </div>
                    <p className="font-medium">{ex.title}</p>
                    <p className="text-sm text-muted-foreground">{ex.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Acción sugerida: {ex.suggested_action}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-8">
                  {assetHref(ex) && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={assetHref(ex)!}>Ver activo</Link>
                    </Button>
                  )}
                  {ex.tire_id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/activos/llantas/${ex.tire_id}`}>Ver llanta</Link>
                    </Button>
                  )}
                  {ex.type === 'no_layout' && ex.asset_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/activos/llantas/configuracion')}
                    >
                      Asignar layout
                    </Button>
                  )}
                  {ex.type === 'incomplete_coverage' && ex.asset_id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/activos/${ex.asset_id}/llantas`}>Completar montaje</Link>
                    </Button>
                  )}
                  {ex.asset_id && ex.type !== 'no_layout' && ex.type !== 'incomplete_coverage' && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={buildWorkOrderHref(ex)}>Crear OT</Link>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDismiss(ex.id)}>
                    Marcar revisado
                  </Button>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PriorityChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:bg-muted/50',
        'data-[active=true]:border-primary data-[active=true]:bg-primary/5'
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-base font-semibold tabular-num">{count}</span>
    </button>
  )
}

export function useTireExceptionCounts() {
  const [counts, setCounts] = useState<TireExceptionCounts>({ P1: 0, P2: 0, P3: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tires/exceptions')
        const data = await res.json()
        if (!cancelled && res.ok) {
          setCounts(data.counts ?? { P1: 0, P2: 0, P3: 0, total: 0 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { counts, loading }
}
