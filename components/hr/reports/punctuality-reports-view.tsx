'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, DollarSign, Eye, Shield, Sparkles, TrendingUp, Users, UserX } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PunctualityOperatorReport, PunctualityReportsPayload } from '@/types/bonus-decision-hub'
import { MONTH_OPTIONS } from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import { RhReportPageShell } from './rh-report-page-shell'
import { RhMonthPeriodFilters } from './rh-month-period-filters'
import { RhReportMetricStrip } from './rh-report-metric-strip'
import { RhReportPanel } from './rh-report-panel'
import { RhReportEmpty, RhReportError, RhReportLoading } from './rh-report-states'
import { PunctualityStatusBadge } from './punctuality-status-badge'
import { useRhOrgFilters } from './use-rh-org-filters'
import { cn } from '@/lib/utils'

function OperatorDetailSheet({
  operator,
  year,
  month,
  plant,
}: {
  operator: PunctualityOperatorReport
  year: number
  month: number
  plant?: string
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
          <Eye className="h-3.5 w-3.5" />
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
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">% Puntualidad</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{operator.punctuality_pct}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Días registrados</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{operator.days_total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">A tiempo</p>
              <p className="mt-1 font-semibold tabular-nums text-emerald-700">{operator.days_on_time}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarde / ausente</p>
              <p className="mt-1 font-semibold tabular-nums text-amber-700">
                {operator.days_late + operator.days_absent}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registro diario
            </p>
            {operator.days.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin días registrados.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {operator.days.map((day) => (
                  <div
                    key={day.event_date}
                    className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="tabular-nums">
                      {format(new Date(`${day.event_date}T12:00:00Z`), 'dd MMM yyyy', { locale: es })}
                    </span>
                    <div className="text-right">
                      <PunctualityStatusBadge status={day.status} />
                      {day.reason ? (
                        <p className="mt-1 max-w-[12rem] text-xs text-muted-foreground">{day.reason}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link
              href={`/rh/bonos?year=${year}&month=${month}${
                plant && plant !== 'all' ? `&plant=${plant}` : ''
              }`}
            >
              Ir al centro de bonos
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function OperatorMobileCard({
  operator,
  year,
  month,
  plant,
}: {
  operator: PunctualityOperatorReport
  year: number
  month: number
  plant?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{operator.operator_name}</p>
          <p className="text-xs text-muted-foreground">
            {operator.plant_name}
            {operator.employee_code ? ` · ${operator.employee_code}` : ''}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums text-sky-700 dark:text-sky-400">
          {operator.punctuality_pct}%
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="font-semibold tabular-nums text-emerald-700">{operator.days_on_time}</p>
          <p className="text-muted-foreground">A tiempo</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="font-semibold tabular-nums text-amber-700">{operator.days_late}</p>
          <p className="text-muted-foreground">Tarde</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2 py-2">
          <p className="font-semibold tabular-nums text-red-700">{operator.days_absent}</p>
          <p className="text-muted-foreground">Ausente</p>
        </div>
      </div>
      <div className="flex justify-end">
        <OperatorDetailSheet operator={operator} year={year} month={month} plant={plant} />
      </div>
    </div>
  )
}

export function PunctualityReportsView() {
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
  const [data, setData] = useState<PunctualityReportsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reloadToken, setReloadToken] = useState(0)

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

        const response = await fetch(`/api/hr/punctuality-reports?${params}`)
        if (!response.ok) throw new Error('Error al cargar reportes de puntualidad')
        const payload = (await response.json()) as PunctualityReportsPayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) {
          console.error('[punctuality-reports-view]', err)
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
    const operators = data?.operators ?? []
    if (operators.length === 0) return []

    const totalDays = operators.reduce((sum, op) => sum + op.days_total, 0)
    const totalOnTime = operators.reduce((sum, op) => sum + op.days_on_time, 0)
    const totalLateAbsent = operators.reduce(
      (sum, op) => sum + op.days_late + op.days_absent,
      0
    )
    const avgPct =
      operators.length > 0
        ? Math.round(
            (operators.reduce((sum, op) => sum + op.punctuality_pct, 0) / operators.length) * 10
          ) / 10
        : 0

    const monthLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)

    return [
      {
        id: 'operators',
        label: 'Operadores',
        value: String(operators.length),
        hint: `Con registro en ${monthLabel} ${year}`,
        icon: Users,
      },
      {
        id: 'avg',
        label: 'Promedio puntualidad',
        value: `${avgPct}%`,
        hint: 'Media simple entre operadores',
        icon: TrendingUp,
        accent: avgPct >= 90 ? 'positive' : avgPct >= 75 ? 'warning' : 'negative',
      } as const,
      {
        id: 'on-time',
        label: 'Días a tiempo',
        value: String(totalOnTime),
        hint: `De ${totalDays} días registrados`,
        icon: Clock,
        accent: 'positive' as const,
      },
      {
        id: 'issues',
        label: 'Tarde o ausente',
        value: String(totalLateAbsent),
        hint: 'Incidencias en el periodo',
        icon: UserX,
        accent: totalLateAbsent > 0 ? 'warning' : 'default',
      } as const,
    ]
  }, [data, month, year])

  const periodLabel = MONTH_OPTIONS.find((m) => m.value === month)?.label ?? String(month)
  const plantFilter = org.filters.plant
  const plantQuery = plantFilter !== 'all' ? `&plant=${plantFilter}` : ''

  return (
    <RhReportPageShell
      variant="punctuality"
      title="Reporte de puntualidad"
      description="Señales diarias por operador y planta para validar elegibilidad de bono. Cruza con el centro de decisión para el cierre mensual."
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
      metrics={!loading && !error && data ? <RhReportMetricStrip metrics={metrics} /> : null}
    >
      {org.error ? <RhReportError message={org.error} /> : null}
      {error ? (
        <RhReportError message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Periodo: <span className="font-medium text-foreground">{periodLabel} {year}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/rh/bonos?year=${year}&month=${month}${plantQuery}`}>
              <DollarSign className="h-3.5 w-3.5" />
              Bonos
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/rh/limpieza?year=${year}&month=${month}${plantQuery}`}>
              <Sparkles className="h-3.5 w-3.5" />
              Limpieza
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href={`/rh/charlas?year=${year}&month=${month}${plantQuery}`}>
              <Shield className="h-3.5 w-3.5" />
              Charlas
            </Link>
          </Button>
        </div>
      </div>

      <RhReportPanel
        title="Operadores por planta"
        description={`Periodo: ${periodLabel} ${year}. Porcentaje = días a tiempo / días registrados.`}
        count={data?.operators.length}
      >
        {loading ? (
          <RhReportLoading rows={6} />
        ) : !data || data.operators.length === 0 ? (
          <div className="p-4 sm:p-5">
            <RhReportEmpty
              title="Sin registros de puntualidad"
              description="No hay eventos de puntualidad para los filtros seleccionados. Verifica planta, mes o que el dosificador haya registrado la sección diaria."
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
                    <TableHead className="text-right tabular-nums">%</TableHead>
                    <TableHead className="text-right tabular-nums">A tiempo</TableHead>
                    <TableHead className="text-right tabular-nums">Tarde</TableHead>
                    <TableHead className="text-right tabular-nums">Ausente</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.operators.map((operator) => (
                    <TableRow key={operator.operator_id}>
                      <TableCell className="font-medium">{operator.operator_name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {operator.employee_code ?? '—'}
                      </TableCell>
                      <TableCell>{operator.plant_name}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold tabular-nums',
                          operator.punctuality_pct >= 90
                            ? 'text-emerald-700'
                            : operator.punctuality_pct >= 75
                              ? 'text-amber-700'
                              : 'text-red-700'
                        )}
                      >
                        {operator.punctuality_pct}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{operator.days_on_time}</TableCell>
                      <TableCell className="text-right tabular-nums">{operator.days_late}</TableCell>
                      <TableCell className="text-right tabular-nums">{operator.days_absent}</TableCell>
                      <TableCell className="text-right">
                        <OperatorDetailSheet
                          operator={operator}
                          year={year}
                          month={month}
                          plant={plantFilter}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {data.operators.map((operator) => (
                <OperatorMobileCard
                  key={operator.operator_id}
                  operator={operator}
                  year={year}
                  month={month}
                  plant={plantFilter}
                />
              ))}
            </div>
          </>
        )}
      </RhReportPanel>
    </RhReportPageShell>
  )
}
