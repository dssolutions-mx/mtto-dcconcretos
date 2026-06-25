'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  DollarSign,
  Shield,
  Sparkles,
  UserX,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { SecurityTalkReportsPayload } from '@/types/bonus-decision-hub'
import { MONTH_OPTIONS } from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import { RhReportPageShell } from './rh-report-page-shell'
import { RhMonthPeriodFilters } from './rh-month-period-filters'
import { RhReportMetricStrip } from './rh-report-metric-strip'
import { RhReportPanel } from './rh-report-panel'
import { RhReportEmpty, RhReportError, RhReportLoading } from './rh-report-states'
import { useRhOrgFilters } from './use-rh-org-filters'
import {
  SecurityTalkOperatorDetailSheet,
  SecurityTalkSessionDetailSheet,
} from './security-talk-session-detail-sheet'
import { cn } from '@/lib/utils'

function RelatedReports({
  year,
  month,
  plantQuery,
}: {
  year: number
  month: number
  plantQuery: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/bonos?year=${year}&month=${month}${plantQuery}`}>
          <DollarSign className="h-3.5 w-3.5" />
          Bonos
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/puntualidad?year=${year}&month=${month}${plantQuery}`}>
          <Clock className="h-3.5 w-3.5" />
          Puntualidad
        </Link>
      </Button>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
        <Link href={`/rh/limpieza?year=${year}&month=${month}${plantQuery}`}>
          <Sparkles className="h-3.5 w-3.5" />
          Limpieza
        </Link>
      </Button>
    </div>
  )
}

export function SecurityTalkReportsView() {
  const searchParams = useSearchParams()
  const now = new Date()
  const org = useRhOrgFilters()
  const { setPlant } = org
  const [year, setYear] = useState(() => {
    const param = searchParams.get('year')
    const parsed = param ? parseInt(param, 10) : NaN
    return Number.isFinite(parsed) ? parsed : now.getUTCFullYear()
  })
  const [month, setMonth] = useState(() => {
    const param = searchParams.get('month')
    const parsed = param ? parseInt(param, 10) : NaN
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12
      ? parsed
      : now.getUTCMonth() + 1
  })
  const [data, setData] = useState<SecurityTalkReportsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [activeTab, setActiveTab] = useState<'sessions' | 'operators'>('sessions')

  useEffect(() => {
    const plantParam = searchParams.get('plant')
    if (plantParam) setPlant(plantParam)
  }, [searchParams, setPlant])

  useEffect(() => {
    if (org.loading) return

    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
        })
        if (org.filters.businessUnit !== 'all') {
          params.set('business_unit', org.filters.businessUnit)
        }
        if (org.filters.plant !== 'all') {
          params.set('plant', org.filters.plant)
        }

        const response = await fetch(`/api/hr/security-talk-reports?${params}`)
        if (!response.ok) throw new Error('Error al cargar charlas de seguridad')
        const payload = (await response.json()) as SecurityTalkReportsPayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) {
          console.error('[security-talk-reports-view]', err)
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [year, month, org.filters.businessUnit, org.filters.plant, org.loading, reloadToken])

  const metrics = useMemo(() => {
    const summary = data?.summary
    if (!summary) return []

    const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
    const attendanceAccent =
      summary.attendance_rate_pct === null
        ? 'default'
        : summary.attendance_rate_pct >= 90
          ? 'positive'
          : summary.attendance_rate_pct >= 75
            ? 'warning'
            : 'negative'

    return [
      {
        id: 'talks',
        label: 'Charlas registradas',
        value: String(summary.talks_logged),
        hint: `En ${monthLabel} ${year}`,
        icon: Shield,
        accent: 'default' as const,
      },
      {
        id: 'days',
        label: 'Días con charla',
        value: String(summary.unique_production_days_with_talk),
        hint: 'Planta y fecha únicos',
        icon: CalendarDays,
        accent: 'default' as const,
      },
      {
        id: 'attendance',
        label: 'Tasa de asistencia',
        value: summary.attendance_rate_pct !== null ? `${summary.attendance_rate_pct}%` : '—',
        hint: 'Asistencias / días con producción',
        icon: Users,
        accent: attendanceAccent,
      },
      {
        id: 'gaps',
        label: 'Operadores con brechas',
        value: String(summary.operators_with_gaps),
        hint: 'Sin charla en algún día productivo',
        icon: UserX,
        accent: summary.operators_with_gaps > 0 ? ('warning' as const) : ('positive' as const),
      },
    ]
  }, [data, month, year])

  const periodLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
  const plantQuery = org.filters.plant !== 'all' ? `&plant=${org.filters.plant}` : ''
  const sessions = data?.sessions ?? []
  const operators = data?.operators ?? []

  return (
    <RhReportPageShell
      variant="security"
      title="Charlas de seguridad"
      description="Monitoreo de cumplimiento: qué charlas se registraron, quién asistió y enlace al checklist PLANTA de origen. No afecta el semáforo de bonos."
      filters={
        <RhMonthPeriodFilters
          businessUnit={org.filters.businessUnit}
          plant={org.filters.plant}
          year={year}
          month={month}
          businessUnits={org.businessUnits}
          plants={org.plants}
          orgLoading={org.loading}
          onBusinessUnitChange={org.setBusinessUnit}
          onPlantChange={org.setPlant}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
      }
      metrics={!loading && !error && data?.summary ? <RhReportMetricStrip metrics={metrics} /> : null}
    >
      {org.error ? <RhReportError message={org.error} /> : null}
      {error ? (
        <RhReportError message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Periodo: <span className="font-medium text-foreground">{periodLabel} {year}</span>
        </p>
        <RelatedReports year={year} month={month} plantQuery={plantQuery} />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'sessions' | 'operators')}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 sm:grid-cols-2">
          <TabsTrigger value="sessions" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Charlas por día
          </TabsTrigger>
          <TabsTrigger value="operators" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Asistencia por operador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <RhReportPanel
            title="Sesiones de charla"
            description="Una fila por checklist PLANTA con sección de seguridad completada."
            count={sessions.length}
          >
            {loading ? (
              <RhReportLoading rows={6} />
            ) : sessions.length === 0 ? (
              <div className="p-4 sm:p-5">
                <RhReportEmpty
                  title="Sin charlas registradas"
                  description="No hay charlas de seguridad para los filtros seleccionados. Verifica que el dosificador haya completado la sección en el checklist diario PLANTA."
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Fecha</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead>Tema</TableHead>
                        <TableHead className="text-right tabular-nums">Asistentes</TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.source_completion_id}>
                          <TableCell className="tabular-nums font-medium">
                            {format(new Date(`${session.event_date}T12:00:00Z`), 'dd MMM yyyy', {
                              locale: es,
                            })}
                          </TableCell>
                          <TableCell>{session.plant_name}</TableCell>
                          <TableCell className="max-w-[16rem] truncate">
                            {session.topic?.trim() || (
                              <span className="text-muted-foreground italic">Sin tema</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {session.attendee_count}
                          </TableCell>
                          <TableCell className="text-right">
                            <SecurityTalkSessionDetailSheet session={session} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {sessions.map((session) => (
                    <div
                      key={session.source_completion_id}
                      className="rounded-xl border border-orange-200/50 bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold tabular-nums">
                            {format(new Date(`${session.event_date}T12:00:00Z`), 'dd MMM yyyy', {
                              locale: es,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">{session.plant_name}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-800"
                        >
                          {session.attendee_count} asistente{session.attendee_count === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <p className="text-sm">
                        {session.topic?.trim() || (
                          <span className="text-muted-foreground italic">Sin tema registrado</span>
                        )}
                      </p>
                      <div className="flex justify-end border-t border-border/40 pt-3">
                        <SecurityTalkSessionDetailSheet session={session} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </RhReportPanel>
        </TabsContent>

        <TabsContent value="operators">
          <RhReportPanel
            title="Operadores"
            description="Brechas = días con producción (puntualidad) sin charla registrada ese día."
            count={operators.length}
          >
            {loading ? (
              <RhReportLoading rows={6} />
            ) : operators.length === 0 ? (
              <div className="p-4 sm:p-5">
                <RhReportEmpty
                  title="Sin operadores en el periodo"
                  description="No hay días con producción ni asistencias registradas para los filtros seleccionados."
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Operador</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Planta</TableHead>
                        <TableHead className="text-right tabular-nums">Días prod.</TableHead>
                        <TableHead className="text-right tabular-nums">Asistió</TableHead>
                        <TableHead className="text-right tabular-nums">Sin charla</TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operators.map((operator) => (
                        <TableRow key={operator.operator_id}>
                          <TableCell className="font-medium">{operator.operator_name}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {operator.employee_code ?? '—'}
                          </TableCell>
                          <TableCell>{operator.plant_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {operator.production_days}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-700">
                            {operator.talks_attended}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums font-medium',
                              operator.gap_days > 0 ? 'text-amber-700' : 'text-muted-foreground'
                            )}
                          >
                            {operator.gap_days}
                          </TableCell>
                          <TableCell className="text-right">
                            <SecurityTalkOperatorDetailSheet operator={operator} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {operators.map((operator) => (
                    <div
                      key={operator.operator_id}
                      className="rounded-xl border border-border/60 bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{operator.operator_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {operator.plant_name}
                            {operator.employee_code ? ` · ${operator.employee_code}` : ''}
                          </p>
                        </div>
                        {operator.gap_days > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-300 bg-amber-50 text-amber-800 shrink-0"
                          >
                            {operator.gap_days} brecha{operator.gap_days === 1 ? '' : 's'}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-800 shrink-0"
                          >
                            Al día
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-muted/40 px-2 py-2">
                          <p className="font-semibold tabular-nums">{operator.production_days}</p>
                          <p className="text-muted-foreground">Prod.</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-2 py-2">
                          <p className="font-semibold tabular-nums text-emerald-700">
                            {operator.talks_attended}
                          </p>
                          <p className="text-muted-foreground">Asistió</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 px-2 py-2">
                          <p className="font-semibold tabular-nums text-amber-700">
                            {operator.gap_days}
                          </p>
                          <p className="text-muted-foreground">Sin charla</p>
                        </div>
                      </div>
                      <div className="flex justify-end border-t border-border/40 pt-3">
                        <SecurityTalkOperatorDetailSheet operator={operator} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </RhReportPanel>
        </TabsContent>
      </Tabs>
    </RhReportPageShell>
  )
}
