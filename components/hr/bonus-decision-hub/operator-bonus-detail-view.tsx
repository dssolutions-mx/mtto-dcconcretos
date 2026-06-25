'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import type { BonusDecisionSummaryPayload } from '@/types/bonus-decision-hub'
import type {
  PunctualityReportsPayload,
  SecurityTalkReportsPayload,
} from '@/types/bonus-decision-hub'
import type { BonusHubFilters } from './bonus-decision-hub'
import { ClosureBadge, formatPct, TrafficLightBadge } from './bonus-hub-shared'
import { RhReportPanel } from '@/components/hr/reports/rh-report-panel'
import { RhReportError, RhReportLoading } from '@/components/hr/reports/rh-report-states'

type OperatorBonusDetailViewProps = {
  filters: BonusHubFilters
  selectedOperatorId: string | null
  onOperatorChange: (value: string | null) => void
}

type WeeklyEval = {
  event_date: string
  status: string
  metadata?: Record<string, unknown> | null
}

function statusIcon(status: string) {
  if (status === 'on_time' || status === 'pass' || status === 'eligible' || status === 'attended') {
    return <CheckCircle2 className="h-4 w-4 text-green-600" />
  }
  if (status === 'late' || status === 'fail' || status === 'ineligible') {
    return <XCircle className="h-4 w-4 text-red-600" />
  }
  return <Clock className="h-4 w-4 text-orange-500" />
}

function punctualityLabel(status: string): string {
  switch (status) {
    case 'on_time':
      return 'A tiempo'
    case 'late':
      return 'Tarde'
    case 'absent':
      return 'Ausente'
    default:
      return status
  }
}

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
    return <p className="text-sm text-muted-foreground">Sin evidencia adjunta.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            className="block overflow-hidden rounded-lg border bg-muted/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Evidencia" className="h-28 w-full object-cover" />
          </a>
        )
      })}
    </div>
  )
}

export function OperatorBonusDetailView({
  filters,
  selectedOperatorId,
  onOperatorChange,
}: OperatorBonusDetailViewProps) {
  const [summary, setSummary] = useState<BonusDecisionSummaryPayload | null>(null)
  const [punctuality, setPunctuality] = useState<PunctualityReportsPayload | null>(null)
  const [securityTalks, setSecurityTalks] = useState<SecurityTalkReportsPayload | null>(null)
  const [weeklyEvals, setWeeklyEvals] = useState<WeeklyEval[]>([])
  const [closureEvent, setClosureEvent] = useState<{
    status: string
    reason: string | null
    evidence: unknown
    event_date: string
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const operatorOptions = useMemo(() => summary?.rows ?? [], [summary])

  const selectedRow = useMemo(
    () => operatorOptions.find((r) => r.operator_id === selectedOperatorId) ?? null,
    [operatorOptions, selectedOperatorId]
  )

  const fetchSummary = useCallback(async () => {
    const params = new URLSearchParams({
      year: String(filters.year),
      month: String(filters.month),
    })
    if (filters.businessUnit !== 'all') params.set('business_unit', filters.businessUnit)
    if (filters.plant !== 'all') params.set('plant', filters.plant)

    const response = await fetch(`/api/hr/bonus-decision-summary?${params}`)
    if (!response.ok) throw new Error('Error al cargar operadores')
    return (await response.json()) as BonusDecisionSummaryPayload
  }, [filters])

  const fetchDetail = useCallback(async () => {
    if (!selectedOperatorId) {
      setPunctuality(null)
      setSecurityTalks(null)
      setWeeklyEvals([])
      setClosureEvent(null)
      return
    }

    const baseParams = new URLSearchParams({
      operator_id: selectedOperatorId,
      limit: '500',
    })
    if (filters.plant !== 'all') baseParams.set('plant_id', filters.plant)

    const { from, to } = (() => {
      const lastDay = new Date(Date.UTC(filters.year, filters.month, 0)).getUTCDate()
      return {
        from: `${filters.year}-${String(filters.month).padStart(2, '0')}-01`,
        to: `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      }
    })()

    const [punctRes, talksRes, eventsRes] = await Promise.all([
      fetch(
        `/api/hr/punctuality-reports?${new URLSearchParams({
          year: String(filters.year),
          month: String(filters.month),
          operator_id: selectedOperatorId,
          ...(filters.businessUnit !== 'all' ? { business_unit: filters.businessUnit } : {}),
          ...(filters.plant !== 'all' ? { plant: filters.plant } : {}),
        })}`
      ),
      fetch(
        `/api/hr/security-talk-reports?${new URLSearchParams({
          year: String(filters.year),
          month: String(filters.month),
          operator_id: selectedOperatorId,
          ...(filters.businessUnit !== 'all' ? { business_unit: filters.businessUnit } : {}),
          ...(filters.plant !== 'all' ? { plant: filters.plant } : {}),
        })}`
      ),
      fetch(`/api/hr/operator-evaluations?${baseParams}`),
    ])

    if (!punctRes.ok) throw new Error('Error al cargar puntualidad')
    if (!talksRes.ok) throw new Error('Error al cargar charlas')

    const punctData = (await punctRes.json()) as PunctualityReportsPayload
    const talksData = (await talksRes.json()) as SecurityTalkReportsPayload
    setPunctuality(punctData)
    setSecurityTalks(talksData)

    if (eventsRes.ok) {
      const eventsJson = await eventsRes.json()
      const events = (eventsJson.events ?? []).filter(
        (e: { event_date: string; event_type: string; period_year?: number | null; period_month?: number | null }) => {
          if (e.event_type === 'cleanliness_closure') {
            return e.period_year === filters.year && e.period_month === filters.month
          }
          return e.event_date >= from && e.event_date <= to
        }
      )
      setWeeklyEvals(
        events
          .filter((e: { event_type: string }) => e.event_type === 'cleanliness_weekly')
          .map((e: WeeklyEval) => e)
      )
      const closure = events.find(
        (e: { event_type: string }) => e.event_type === 'cleanliness_closure'
      )
      setClosureEvent(
        closure
          ? {
              status: closure.status,
              reason: closure.reason,
              evidence: closure.evidence,
              event_date: closure.event_date,
            }
          : null
      )
    }
  }, [selectedOperatorId, filters])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const summaryData = await fetchSummary()
        setSummary(summaryData)
        if (!selectedOperatorId && summaryData.rows.length > 0) {
          onOperatorChange(summaryData.rows[0].operator_id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [fetchSummary, selectedOperatorId, onOperatorChange])

  useEffect(() => {
    async function loadDetail() {
      if (!selectedOperatorId) return
      try {
        setLoading(true)
        setError(null)
        await fetchDetail()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [fetchDetail, selectedOperatorId])

  const punctOperator = punctuality?.operators[0] ?? null
  const punctualityHref = `/rh/puntualidad?year=${filters.year}&month=${filters.month}${
    filters.plant !== 'all' ? `&plant=${filters.plant}` : ''
  }`
  const cleanlinessHref = `/rh/limpieza?year=${filters.year}&month=${filters.month}${
    filters.plant !== 'all' ? `&plant=${filters.plant}` : ''
  }`

  return (
    <div className="space-y-4">
      <RhReportPanel title="Operador" description="Selecciona un operador para ver la línea de tiempo del mes.">
        <div className="p-4 sm:p-5">
          <div className="space-y-2 max-w-md">
            <Label>Operador</Label>
            <Select
              value={selectedOperatorId ?? ''}
              onValueChange={(v) => onOperatorChange(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona operador" />
              </SelectTrigger>
              <SelectContent>
                {operatorOptions.map((op) => (
                  <SelectItem key={op.operator_id} value={op.operator_id}>
                    {op.operator_name}
                    {op.employee_code ? ` (${op.employee_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </RhReportPanel>

      {error ? <RhReportError message={error} /> : null}

      {selectedRow && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedRow.operator_name}</CardTitle>
            <CardDescription>
              {selectedRow.plant_name} · {formatPct(selectedRow.punctuality_pct)} puntualidad ·{' '}
              {formatPct(selectedRow.cleanliness_pass_rate)} limpieza
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <TrafficLightBadge light={selectedRow.traffic_light} />
            <ClosureBadge value={selectedRow.closure_official} />
          </CardContent>
        </Card>
      )}

      {loading && !selectedRow ? (
        <RhReportLoading rows={4} />
      ) : selectedOperatorId ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" />
                Puntualidad diaria
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={punctualityHref}>Reporte</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {!punctOperator || punctOperator.days.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin registros de puntualidad.</p>
              ) : (
                punctOperator.days.map((day) => (
                  <div
                    key={day.event_date}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {statusIcon(day.status)}
                      <span>
                        {format(new Date(`${day.event_date}T12:00:00Z`), 'dd MMM', { locale: es })}
                      </span>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{punctualityLabel(day.status)}</Badge>
                      {day.reason && (
                        <p className="mt-1 text-xs text-muted-foreground">{day.reason}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                Evaluaciones semanales de limpieza
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={cleanlinessHref}>Reporte</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {weeklyEvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin evaluaciones semanales.</p>
              ) : (
                weeklyEvals.map((ev, idx) => (
                  <div
                    key={`${ev.event_date}-${idx}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {statusIcon(ev.status)}
                      <span>
                        {format(new Date(`${ev.event_date}T12:00:00Z`), 'dd MMM', { locale: es })}
                      </span>
                    </div>
                    <Badge variant={ev.status === 'pass' ? 'default' : 'destructive'}>
                      {ev.status === 'pass' ? 'Aprobado' : 'No aprobado'}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Charlas de seguridad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {!securityTalks || securityTalks.talks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin asistencia registrada.</p>
              ) : (
                securityTalks.talks.map((talk) => (
                  <div key={talk.id} className="rounded-lg border px-3 py-2 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span>
                        {format(new Date(`${talk.event_date}T12:00:00Z`), 'dd MMM yyyy', {
                          locale: es,
                        })}
                      </span>
                      <Badge className="bg-green-100 text-green-800">Asistió</Badge>
                    </div>
                    {talk.topic && (
                      <p className="text-xs text-muted-foreground">Tema: {talk.topic}</p>
                    )}
                    <EvidenceGallery evidence={talk.evidence} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4" />
                Decisión de cierre mensual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!closureEvent ? (
                <p className="text-sm text-muted-foreground">Cierre pendiente para este periodo.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Estado</span>
                    <Badge
                      variant={closureEvent.status === 'eligible' ? 'default' : 'destructive'}
                    >
                      {closureEvent.status === 'eligible' ? 'Apto' : 'No apto'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fecha</span>
                    <span>
                      {format(new Date(`${closureEvent.event_date}T12:00:00Z`), 'dd MMM yyyy', {
                        locale: es,
                      })}
                    </span>
                  </div>
                  {closureEvent.reason && (
                    <p className="text-sm text-muted-foreground">{closureEvent.reason}</p>
                  )}
                  <div>
                    <p className="mb-2 text-sm font-medium">Evidencia</p>
                    <EvidenceGallery evidence={closureEvent.evidence} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          Selecciona un operador para ver su línea de tiempo.
        </p>
      )}
    </div>
  )
}
