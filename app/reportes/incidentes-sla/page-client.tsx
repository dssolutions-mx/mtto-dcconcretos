'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, RefreshCw } from 'lucide-react'
import { IncidentSlaKpiStrip } from '@/components/reports/incident-sla/kpi-strip'
import { IncidentSlaDepartmentRanking } from '@/components/reports/incident-sla/department-ranking'
import { IncidentSlaTrendChart } from '@/components/reports/incident-sla/trend-chart'
import { IncidentSlaBreachesTable } from '@/components/reports/incident-sla/breaches-table'
import type {
  IncidentSlaRow,
  SlaDepartmentRanking,
  SlaKpiSummary,
  SlaMetricKind,
  SlaMonthlyTrend,
} from '@/lib/reports/incident-sla-metrics'
import { aggregateSlaKpis, filterBreachedRows } from '@/lib/reports/incident-sla-metrics'

function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const from = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10)
  return { from, to }
}

function downloadCsv(filename: string, header: string[], lines: (string | number | null | undefined)[][]) {
  const esc = (cell: string | number | null | undefined) => {
    const s = cell == null ? '' : String(cell)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const body = [header.join(','), ...lines.map((row) => row.map(esc).join(','))].join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function IncidentSlaDashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const defaults = defaultDateRange()

  const [from, setFrom] = useState(searchParams.get('from') ?? defaults.from)
  const [to, setTo] = useState(searchParams.get('to') ?? defaults.to)
  const [plantId, setPlantId] = useState<string | null>(searchParams.get('plantId'))
  const [departmentId, setDepartmentId] = useState<string | null>(searchParams.get('departmentId'))
  const [breachMetric, setBreachMetric] = useState<SlaMetricKind | 'any'>(
    (searchParams.get('breach') as SlaMetricKind | 'any') ?? 'any',
  )

  const [kpis, setKpis] = useState<SlaKpiSummary | null>(null)
  const [departments, setDepartments] = useState<SlaDepartmentRanking[]>([])
  const [trend, setTrend] = useState<SlaMonthlyTrend[]>([])
  const [breachRows, setBreachRows] = useState<IncidentSlaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [plants, setPlants] = useState<{ id: string; name: string }[]>([])
  const [deptOptions, setDeptOptions] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/plants').then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
    ])
      .then(([plantJson, deptJson]) => {
        setPlants(plantJson.plants ?? [])
        setDeptOptions(deptJson.departments ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('from', from)
    params.set('to', to)
    if (plantId) params.set('plantId', plantId)
    if (departmentId) params.set('departmentId', departmentId)
    if (breachMetric !== 'any') params.set('breach', breachMetric)
    router.replace(`?${params.toString()}`, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, plantId, departmentId, breachMetric])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ from, to, mode: 'export' })
      if (plantId) params.set('plantId', plantId)
      if (departmentId) params.set('departmentId', departmentId)

      const response = await fetch(`/api/reports/incident-sla?${params.toString()}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Error al cargar datos')

      const rows = (json.rows ?? []) as IncidentSlaRow[]
      setKpis(json.kpis ?? aggregateSlaKpis(rows))
      setDepartments(json.departments ?? [])
      setTrend(json.trend ?? [])
      setBreachRows(filterBreachedRows(rows, breachMetric))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [from, to, plantId, departmentId, breachMetric])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleExport = () => {
    downloadCsv(
      `sla-incidencias-${from}-${to}.csv`,
      [
        'incident_id',
        'fecha',
        'tipo',
        'impacto',
        'departamento',
        'mtta_h',
        'mttr_h',
        'cumple_atencion',
        'cumple_programacion',
        'cumple_resolucion',
        'incumple_enrutamiento',
      ],
      breachRows.map((row) => [
        row.incident_id,
        row.reported_at.slice(0, 10),
        row.incident_type,
        row.impact,
        row.department_name,
        row.hours_to_acknowledge,
        row.hours_to_resolve,
        row.met_ack_target,
        row.met_schedule_target,
        row.met_resolve_target,
        row.routing_sla_breached,
      ]),
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cumplimiento SLA de incidencias</h1>
          <p className="text-muted-foreground mt-1">
            MTTA, MTTR y cumplimiento por departamento y responsable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!breachRows.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar incumplidas
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="block border rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="block border rounded-md px-3 py-2 text-sm"
          />
        </label>
        <div className="w-48">
          <p className="text-sm text-muted-foreground mb-1">Planta</p>
          <Select
            value={plantId ?? 'all'}
            onValueChange={(value) => setPlantId(value === 'all' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-52">
          <p className="text-sm text-muted-foreground mb-1">Departamento</p>
          <Select
            value={departmentId ?? 'all'}
            onValueChange={(value) => setDepartmentId(value === 'all' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {deptOptions.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <p className="text-sm text-muted-foreground mb-1">Tipo de incumplimiento</p>
          <Select
            value={breachMetric}
            onValueChange={(value) => setBreachMetric(value as SlaMetricKind | 'any')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Todos</SelectItem>
              <SelectItem value="ack">Atención (MTTA)</SelectItem>
              <SelectItem value="schedule">Programación</SelectItem>
              <SelectItem value="resolve">Resolución (MTTR)</SelectItem>
              <SelectItem value="routing">Enrutamiento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading || !kpis ? (
        <p className="text-sm text-muted-foreground">Cargando métricas SLA…</p>
      ) : (
        <>
          <IncidentSlaKpiStrip kpis={kpis} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <IncidentSlaTrendChart trend={trend} />
            <IncidentSlaDepartmentRanking departments={departments} />
          </div>
          <IncidentSlaBreachesTable rows={breachRows} metric={breachMetric} />
        </>
      )}
    </div>
  )
}

export default function IncidentSlaReportPageClient() {
  return (
    <Suspense fallback={<div className="container mx-auto py-6">Cargando…</div>}>
      <IncidentSlaDashboardContent />
    </Suspense>
  )
}
