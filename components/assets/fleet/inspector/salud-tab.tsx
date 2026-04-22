'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UseFleetQuickviewResult } from '@/hooks/useFleetQuickview'
import { toast } from 'sonner'
import { getTrackedReadingFieldsForModelUnit } from '@/lib/utils/maintenance-units'
import { Loader2, AlertTriangle, CalendarClock, ClipboardList, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SaludTab({
  assetId,
  canEdit,
  onVerified,
  quickview,
}: {
  assetId: string
  canEdit: boolean
  onVerified: () => void
  quickview: UseFleetQuickviewResult
}) {
  const { data, loading, error, refresh } = quickview

  async function confirmReading() {
    if (!canEdit || !data) return
    const fields = getTrackedReadingFieldsForModelUnit(data.reading.unit)
    if (fields.length === 0) {
      toast.message('Este modelo no usa medidor')
      return
    }
    try {
      for (const field of fields) {
        const res = await fetch('/api/assets/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'field', asset_id: assetId, field }),
        })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error || 'Error')
        }
      }
      toast.success('Lectura confirmada')
      onVerified()
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando salud operativa…
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-xs text-muted-foreground">
        {error ?? 'No se pudo cargar el resumen.'}
      </p>
    )
  }

  const u = data.reading.unit
  const readingLabel =
    u === 'kilometers'
      ? 'Odómetro'
      : u === 'both'
        ? 'Horas / km'
        : u === 'none'
          ? 'Sin medidor'
          : 'Horómetro'
  const readingDisplay =
    u === 'kilometers'
      ? `${data.reading.kilometers ?? '—'} km`
      : u === 'both'
        ? `${data.reading.hours ?? '—'} h · ${data.reading.kilometers ?? '—'} km`
        : u === 'none'
          ? '—'
          : `${data.reading.hours ?? '—'} h`

  const prev = data.preventive
  let prevSubtitle = 'Sin plan preventivo registrado'
  if (prev.next_name && prev.next_due_date) {
    const d = prev.days_until
    if (d != null) {
      if (d < 0) prevSubtitle = `Vencido hace ${Math.abs(d)} d · ${prev.next_name}`
      else if (d === 0) prevSubtitle = `Vence hoy · ${prev.next_name}`
      else prevSubtitle = `En ${d} d · ${prev.next_name}`
    } else prevSubtitle = prev.next_name
  } else if (prev.next_name) {
    prevSubtitle = prev.next_name
  }

  const prevTone =
    prev.status === 'overdue'
      ? 'border-destructive/40 bg-destructive/5'
      : prev.status === 'upcoming'
        ? 'border-amber-500/40 bg-amber-500/5'
        : 'border-border'

  return (
    <div className="space-y-3 pb-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              Lectura actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            <p className="text-[11px] text-muted-foreground">{readingLabel}</p>
            <p className="font-mono text-lg font-semibold tabular-nums">{readingDisplay}</p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              disabled={!canEdit || u === 'none'}
              onClick={confirmReading}
            >
              Confirmar lectura
            </Button>
          </CardContent>
        </Card>

        <Card className={cn('shadow-sm', prevTone)}>
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              Próximo preventivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            <p className="text-xs leading-snug text-foreground">{prevSubtitle}</p>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href={`/activos/${assetId}/mantenimiento`}>Ver mantenimiento</Link>
            </Button>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'shadow-sm',
            data.incidents.open_count > 0 && 'border-destructive/40 bg-destructive/5'
          )}
        >
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
              Incidentes abiertos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {data.incidents.open_count}
            </p>
            {data.incidents.worst_impact ? (
              <p className="text-[11px] text-muted-foreground">
                Impacto: {data.incidents.worst_impact}
              </p>
            ) : null}
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href={`/activos/${assetId}/incidentes`}>Ver incidentes</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="space-y-0 p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
              Checklists pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li>
                Atrasados:{' '}
                <span className="font-medium text-foreground">{data.schedules.overdue}</span>
              </li>
              <li>
                Hoy:{' '}
                <span className="font-medium text-foreground">{data.schedules.today}</span>
              </li>
              <li>
                Próx. 7 d:{' '}
                <span className="font-medium text-foreground">{data.schedules.upcoming}</span>
              </li>
            </ul>
            <Button size="sm" variant="outline" className="w-full" asChild>
              <Link href={`/activos/${assetId}/historial-checklists`}>Ver checklists</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Button variant="default" size="sm" className="w-full" asChild>
        <Link href={`/activos/${assetId}`}>Ver detalle completo del activo</Link>
      </Button>
    </div>
  )
}
