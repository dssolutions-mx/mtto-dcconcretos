'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ExternalLink, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { SecurityTalkSessionReport } from '@/types/bonus-decision-hub'

function EvidenceGallery({ evidence }: { evidence: unknown }) {
  const items = useMemo(() => {
    if (!evidence) return []
    if (Array.isArray(evidence)) {
      return evidence.filter((item) => item && typeof item === 'object')
    }
    if (typeof evidence === 'object' && evidence !== null) {
      const record = evidence as Record<string, unknown>
      if (typeof record.photo_url === 'string') return [record]
      if (Array.isArray(record.photos)) return record.photos
    }
    return []
  }, [evidence])

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin evidencia fotográfica.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, index) => {
        const record = item as Record<string, unknown>
        const url = typeof record.photo_url === 'string' ? record.photo_url : null
        if (!url) return null
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-orange-200/60 bg-muted/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Evidencia de charla" className="h-28 w-full object-cover" />
          </a>
        )
      })}
    </div>
  )
}

export function SecurityTalkSessionDetailSheet({
  session,
}: {
  session: SecurityTalkSessionReport
}) {
  const formattedDate = format(new Date(`${session.event_date}T12:00:00Z`), 'dd MMM yyyy', {
    locale: es,
  })

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-orange-700 hover:text-orange-800">
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Detalle</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-600" />
            Charla de seguridad
          </SheetTitle>
          <SheetDescription>
            {formattedDate} · {session.plant_name}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-orange-200/60 bg-orange-50/30 px-4 py-3 dark:bg-orange-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tema
            </p>
            <p className="mt-1 text-sm font-medium">
              {session.topic?.trim() || 'Sin tema registrado'}
            </p>
          </div>

          {session.reflection ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reflexión
              </p>
              <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm leading-relaxed">
                {session.reflection}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Asistentes ({session.attendee_count})
            </p>
            {session.attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin asistentes registrados.</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {session.attendees.map((attendee) => (
                  <div
                    key={attendee.operator_id}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{attendee.operator_name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {attendee.employee_code ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidencia
            </p>
            <EvidenceGallery evidence={session.evidence} />
          </div>

          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href={`/checklists/completado/${session.source_completion_id}`}>
              <ExternalLink className="h-4 w-4" />
              Ver checklist origen
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function SecurityTalkOperatorDetailSheet({
  operator,
}: {
  operator: {
    operator_name: string
    employee_code: string | null
    plant_name: string
    production_days: number
    talks_attended: number
    gap_days: number
    attended_dates: string[]
    missed_dates: string[]
  }
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <Shield className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Detalle</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{operator.operator_name}</SheetTitle>
          <SheetDescription>
            {operator.plant_name}
            {operator.employee_code ? ` · ${operator.employee_code}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Días prod.</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{operator.production_days}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Asistió</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
                {operator.talks_attended}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sin charla</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-amber-700">
                {operator.gap_days}
              </p>
            </div>
          </div>

          {operator.missed_dates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Días con producción sin charla
              </p>
              <div className="flex flex-wrap gap-2">
                {operator.missed_dates.map((date) => (
                  <Badge
                    key={date}
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800"
                  >
                    {format(new Date(`${date}T12:00:00Z`), 'dd MMM', { locale: es })}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {operator.attended_dates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Días con asistencia registrada
              </p>
              <div className="flex flex-wrap gap-2">
                {operator.attended_dates.map((date) => (
                  <Badge
                    key={date}
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-800"
                  >
                    {format(new Date(`${date}T12:00:00Z`), 'dd MMM', { locale: es })}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
