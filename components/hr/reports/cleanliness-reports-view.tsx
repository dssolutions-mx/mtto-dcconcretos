'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Clock, DollarSign, Shield, Sparkles, TrendingUp, Truck, Users } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MONTH_OPTIONS } from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import { RhReportPageShell } from './rh-report-page-shell'
import { RhMonthPeriodFilters } from './rh-month-period-filters'
import { useRhOrgFilters } from './use-rh-org-filters'
import { RhReportMetricStrip } from './rh-report-metric-strip'
import { RhReportPanel } from './rh-report-panel'
import { RhReportEmpty, RhReportError, RhReportLoading } from './rh-report-states'
import {
  CleanlinessEvaluationDetailSheet,
  CleanlinessScoreInline,
} from './cleanliness-evaluation-detail-sheet'
import {
  CleanlinessSectionBadge,
} from './cleanliness-status-badge'

interface CleanlinessReport {
  id: string
  asset_name: string
  asset_code: string
  technician_name: string
  completed_date: string
  interior_status: 'pass' | 'fail'
  exterior_status: 'pass' | 'fail'
  interior_notes: string
  exterior_notes: string
  overall_score: number
  passed_both: boolean
  primary_operator_name?: string
  primary_operator_code?: string
  secondary_operator_name?: string
}

interface CleanlinessStats {
  total_evaluations: number
  pass_rate: number
  passed_count: number
  top_performers: Array<{
    technician: string
    score: number
    evaluations: number
  }>
}

function ReportMobileCard({ report }: { report: CleanlinessReport }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold tabular-nums">{report.asset_code}</p>
          <p className="truncate text-xs text-muted-foreground">{report.asset_name}</p>
        </div>
        <CleanlinessScoreInline score={report.overall_score} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Operador</p>
          <p className="mt-0.5 font-medium">
            {report.primary_operator_name ?? (
              <span className="text-muted-foreground italic">Sin asignar</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Técnico</p>
          <p className="mt-0.5 font-medium">{report.technician_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Fecha</p>
          <p className="mt-0.5 tabular-nums">
            {new Date(report.completed_date).toLocaleDateString('es-MX')}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Interior / Exterior</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <CleanlinessSectionBadge status={report.interior_status} notes={report.interior_notes} />
            <CleanlinessSectionBadge status={report.exterior_status} notes={report.exterior_notes} />
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-border/40 pt-3">
        <CleanlinessEvaluationDetailSheet reportId={report.id} />
      </div>
    </div>
  )
}

export function CleanlinessReportsView() {
  const searchParams = useSearchParams()
  const org = useRhOrgFilters()
  const { setPlant } = org
  const now = new Date()
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
  const [reports, setReports] = useState<CleanlinessReport[]>([])
  const [stats, setStats] = useState<CleanlinessStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [technicianFilter, setTechnicianFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')

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
          period: 'calendar_month',
          year: String(year),
          month: String(month),
          ...(technicianFilter !== 'all' && { technician: technicianFilter }),
          ...(appliedSearch && { search: appliedSearch }),
        })
        if (org.filters.businessUnit !== 'all') {
          params.set('business_unit', org.filters.businessUnit)
        }
        if (org.filters.plant !== 'all') {
          params.set('plant', org.filters.plant)
        }

        const response = await fetch(`/api/hr/cleanliness-reports?${params}`)
        if (!response.ok) throw new Error('Error al cargar reportes de limpieza')
        const data = await response.json()
        if (!cancelled) {
          setReports(data.reports ?? [])
          setStats(data.stats ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[cleanliness-reports-view]', err)
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setReports([])
          setStats(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    year,
    month,
    org.filters.businessUnit,
    org.filters.plant,
    org.loading,
    technicianFilter,
    appliedSearch,
    reloadToken,
  ])

  const uniqueTechnicians = useMemo(
    () => Array.from(new Set(reports.map((r) => r.technician_name))).sort((a, b) => a.localeCompare(b, 'es')),
    [reports]
  )

  const metrics = useMemo(() => {
    if (!stats) return []
    const top = stats.top_performers[0]
    return [
      {
        id: 'total',
        label: 'Evaluaciones',
        value: String(stats.total_evaluations),
        hint: 'Checklists semanales con sección de limpieza',
        icon: Truck,
      },
      {
        id: 'pass-rate',
        label: 'Tasa de aprobación',
        value: `${stats.pass_rate.toFixed(1)}%`,
        hint: `${stats.passed_count} de ${stats.total_evaluations} aprobaron ambas secciones`,
        icon: TrendingUp,
        accent:
          stats.pass_rate >= 90 ? 'positive' : stats.pass_rate >= 75 ? 'warning' : 'negative',
      } as const,
      {
        id: 'passed',
        label: 'Aprobadas',
        value: String(stats.passed_count),
        hint: 'Interior y exterior en verde',
        icon: Sparkles,
        accent: 'positive' as const,
      },
      {
        id: 'top',
        label: 'Mejor operador',
        value: top?.technician ?? 'N/A',
        hint: top
          ? `${top.score.toFixed(1)}% · ${top.evaluations} eval.`
          : 'Sin operador asignado en el periodo',
        icon: Users,
      },
    ]
  }, [stats])

  return (
    <RhReportPageShell
      variant="cleanliness"
      title="Reportes de limpieza"
      description="Evaluaciones semanales por unidad y operador asignado. Contrasta evidencia del mes antes del cierre de bono."
      filters={
        <div className="space-y-4">
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
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Técnico</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={technicianFilter}
                  onChange={(e) => setTechnicianFilter(e.target.value)}
                >
                  <option value="all">Todos</option>
                  {uniqueTechnicians.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Buscar unidad u operador</Label>
                <div className="flex gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Código, nombre…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setAppliedSearch(searchTerm)
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setAppliedSearch(searchTerm)}
                  >
                    Buscar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
      metrics={!loading && !error && stats ? <RhReportMetricStrip metrics={metrics} /> : null}
    >
      {org.error ? <RhReportError message={org.error} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Periodo:{' '}
          <span className="font-medium text-foreground">
            {MONTH_OPTIONS.find((m) => m.value === month)?.label ?? month} {year}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link
              href={`/rh/bonos?year=${year}&month=${month}${
                org.filters.plant !== 'all' ? `&plant=${org.filters.plant}` : ''
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Bonos
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link
              href={`/rh/puntualidad?year=${year}&month=${month}${
                org.filters.plant !== 'all' ? `&plant=${org.filters.plant}` : ''
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Puntualidad
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link
              href={`/rh/charlas?year=${year}&month=${month}${
                org.filters.plant !== 'all' ? `&plant=${org.filters.plant}` : ''
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Charlas
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <RhReportError message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : null}

      <RhReportPanel
        title="Evaluaciones de limpieza"
        description="Ordenadas por fecha de completado. Puntuación general ≥75% es aprobatoria."
        count={reports.length}
      >
        {loading ? (
          <RhReportLoading rows={6} />
        ) : reports.length === 0 ? (
          <div className="p-4 sm:p-5">
            <RhReportEmpty
              title="Sin evaluaciones"
              description="No hay checklists semanales con limpieza en el mes seleccionado. Ajusta planta, mes o filtros de búsqueda."
            />
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Unidad</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right tabular-nums">Puntuación</TableHead>
                    <TableHead>Interior</TableHead>
                    <TableHead>Exterior</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <p className="font-medium tabular-nums">{report.asset_code}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[10rem]">
                          {report.asset_name}
                        </p>
                      </TableCell>
                      <TableCell>
                        {report.primary_operator_name ? (
                          <>
                            <p className="text-sm">{report.primary_operator_name}</p>
                            {report.primary_operator_code ? (
                              <p className="text-xs text-muted-foreground tabular-nums">
                                {report.primary_operator_code}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{report.technician_name}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {new Date(report.completed_date).toLocaleDateString('es-MX')}
                      </TableCell>
                      <TableCell className="text-right">
                        <CleanlinessScoreInline score={report.overall_score} />
                      </TableCell>
                      <TableCell>
                        <CleanlinessSectionBadge
                          status={report.interior_status}
                          notes={report.interior_notes}
                        />
                      </TableCell>
                      <TableCell>
                        <CleanlinessSectionBadge
                          status={report.exterior_status}
                          notes={report.exterior_notes}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <CleanlinessEvaluationDetailSheet reportId={report.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {reports.map((report) => (
                <ReportMobileCard key={report.id} report={report} />
              ))}
            </div>
          </>
        )}
      </RhReportPanel>
    </RhReportPageShell>
  )
}
