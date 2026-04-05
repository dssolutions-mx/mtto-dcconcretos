'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react'
import {
  buildExecutiveReportRollup,
  grayscaleForIndex,
  type GerencialAssetForRollup,
  type GerencialSummaryForRollup,
} from '@/lib/reports/executive-report-rollup'
import './executive-report-print.css'

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

const fmtMoneyFull = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtNum = (n: number, d = 0) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)

const fmtPct = (n: number) => `${fmtNum(n, 1)}%`

function shortMoneyK(n: number): string {
  if (n >= 1_000_000) return `${fmtNum(n / 1_000_000, 1)}M`
  if (n >= 1_000) return `${fmtNum(n / 1_000, 1)}K`
  return fmtNum(n, 0)
}

function shortM3(n: number): string {
  if (n >= 1_000_000) return `${fmtNum(n / 1_000_000, 1)}M`
  if (n >= 1_000) return `${fmtNum(n / 1_000, 1)}K`
  return fmtNum(n, 0)
}

type GerencialJson = {
  summary: GerencialSummaryForRollup & { totalSales?: number }
  assets: GerencialAssetForRollup[]
  filters: {
    businessUnits: { id: string; name: string }[]
    plants: { id: string; name: string; business_unit_id: string }[]
  }
}

export function ExecutiveAnalyticalReportClient() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [businessUnitId, setBusinessUnitId] = useState('')
  const [plantId, setPlantId] = useState('')
  /** Default false: gerencial's "hide zero" drops assets with no diesel/hours even if they have maintenance cost in period. */
  const [hideZero, setHideZero] = useState(false)
  const [loading, setLoading] = useState(false)
  const [raw, setRaw] = useState<GerencialJson | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setDateFrom(first.toISOString().slice(0, 10))
    setDateTo(last.toISOString().slice(0, 10))
  }, [])

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/reports/gerencial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          businessUnitId: businessUnitId || null,
          plantId: plantId || null,
          hideZeroActivity: hideZero,
        }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Error al cargar el reporte')
      setRaw(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setRaw(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, businessUnitId, plantId, hideZero])

  useEffect(() => {
    if (!dateFrom || !dateTo) return
    load()
  }, [dateFrom, dateTo, businessUnitId, plantId, hideZero, load])

  const rollup = useMemo(() => {
    if (!raw?.assets || !raw.summary) return null
    return buildExecutiveReportRollup(
      raw.assets,
      {
        totalSales: raw.summary.totalSales ?? 0,
        totalMaintenanceCost: raw.summary.totalMaintenanceCost,
        totalPreventiveCost: raw.summary.totalPreventiveCost,
        totalCorrectiveCost: raw.summary.totalCorrectiveCost,
        totalConcreteM3: raw.summary.totalConcreteM3,
      },
      { dateFrom, dateTo }
    )
  }, [raw, dateFrom, dateTo])

  const pieMaintenance = useMemo(() => {
    if (!rollup) return []
    const rows: { name: string; value: number }[] = rollup.categories_by_maintenance_desc
      .filter((c) => c.maintenance_cost > 0)
      .map((c) => ({ name: c.id, value: c.maintenance_cost }))
    if (rollup.unallocated_maintenance > 0.01) {
      rows.push({ name: 'Sin asignar a activo', value: rollup.unallocated_maintenance })
    }
    rows.sort((a, b) => b.value - a.value)
    return rows.map((r, i) => ({
      ...r,
      fill: grayscaleForIndex(i, rows.length),
    }))
  }, [rollup])

  const pieHours = useMemo(() => {
    if (!rollup) return []
    const list = rollup.hours_by_category_desc.filter((c) => c.hours_worked > 0)
    return list.map((c, i) => ({
      name: c.id,
      value: c.hours_worked,
      fill: grayscaleForIndex(i, list.length),
    }))
  }, [rollup])

  const top3Hours = useMemo(() => {
    if (!rollup) return []
    const total = rollup.summary.total_hours
    if (total <= 0) return []
    return rollup.hours_by_category_desc
      .filter((c) => c.hours_worked > 0)
      .slice(0, 3)
      .map((c) => ({
        name: c.id,
        hours: c.hours_worked,
        pct: (c.hours_worked / total) * 100,
      }))
  }, [rollup])

  const ratioBars = useMemo(() => {
    if (!rollup) return []
    return [...rollup.categories]
      .filter((c) => c.maintenance_cost > 0 && c.corrective_to_preventive_ratio != null)
      .sort((a, b) => (b.corrective_to_preventive_ratio || 0) - (a.corrective_to_preventive_ratio || 0))
      .slice(0, 6)
  }, [rollup])

  const maxRatioBar = useMemo(() => {
    if (!ratioBars.length) return 1
    return Math.max(...ratioBars.map((r) => r.corrective_to_preventive_ratio || 0), 0.001)
  }, [ratioBars])

  const categoryNarrative = useMemo(() => {
    if (!rollup || pieMaintenance.length === 0) return ''
    const [a, b] = pieMaintenance
    const t = rollup.summary.total_maintenance
    const p1 = t > 0 ? (a.value / t) * 100 : 0
    const p2 = b && b.name !== a.name ? (b.value / t) * 100 : 0
    const n = rollup.summary.asset_count
    const catCount = rollup.categories.filter((c) => c.maintenance_cost > 0).length
    const extra =
      rollup.unallocated_maintenance > 0.01
        ? ' Parte del gasto corresponde a órdenes no vinculadas a un activo en el periodo.'
        : ''
    return `${a.name} concentra el mayor gasto (${fmtPct(p1)} del total)${
      b && b.name !== a.name ? `; le sigue ${b.name} (${fmtPct(p2)})` : ''
    }. El análisis cubre ${n} unidades con costo por activo${
      catCount > 0 ? ` en ${catCount} categorías de equipo` : ''
    }.${extra}`
  }, [rollup, pieMaintenance])

  const availablePlants = useMemo(() => {
    if (!raw?.filters?.plants) return []
    return raw.filters.plants.filter((p) => !businessUnitId || p.business_unit_id === businessUnitId)
  }, [raw, businessUnitId])

  const topAssetsByHours = useMemo(() => {
    if (!raw?.assets) return []
    return [...raw.assets]
      .sort((a, b) => Number(b.hours_worked || 0) - Number(a.hours_worked || 0))
      .slice(0, 3)
  }, [raw])

  const handlePrint = () => window.print()

  return (
    <div
      data-executive-analytical-report
      className="executive-analytical-report max-w-5xl mx-auto px-4 py-8 md:px-8 text-[#1a1a1a]"
      style={
        {
          ['--er-canvas' as string]: '#fafafa',
          ['--er-muted' as string]: '#737373',
          ['--er-accent' as string]: '#609df7',
          ['--er-border' as string]: 'rgba(0,0,0,0.08)',
          ['--er-card-tint' as string]: '#f5f0e8',
        } as React.CSSProperties
      }
    >
      <div className="executive-report-no-print flex flex-wrap items-center gap-3 justify-between mb-10">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/reportes/gerencial">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Reporte gerencial
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>
        <Button size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="executive-report-no-print rounded-lg border border-[var(--er-border)] bg-white p-4 md:p-6 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div>
            <Label htmlFor="er-from">Desde</Label>
            <Input
              id="er-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="er-to">Hasta</Label>
            <Input id="er-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <Label>Unidad de negocio</Label>
            <Select
              value={businessUnitId || 'all'}
              onValueChange={(v) => {
                setBusinessUnitId(v === 'all' ? '' : v)
                setPlantId('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {(raw?.filters.businessUnits || []).map((bu) => (
                  <SelectItem key={bu.id} value={bu.id}>
                    {bu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Planta</Label>
            <Select value={plantId || 'all'} onValueChange={(v) => setPlantId(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {availablePlants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox
              id="er-hide"
              checked={hideZero}
              onCheckedChange={(c) => setHideZero(c === true)}
            />
            <Label htmlFor="er-hide" className="text-sm font-normal cursor-pointer">
              Ocultar activos sin actividad
            </Label>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-6" role="alert">
          {error}
        </p>
      )}

      {loading && !rollup && (
        <p className="text-[var(--er-muted)]">Cargando informe…</p>
      )}

      {rollup && (
        <div className="space-y-16">
          {/* Cabecera */}
          <header className="executive-report-avoid-break border-b border-[var(--er-border)] pb-8">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--er-muted)] mb-2">
              DC Concretos
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111]">
              Análisis de mantenimiento
            </h1>
            <p className="mt-2 text-sm text-[var(--er-muted)]">
              Periodo: {rollup.period.dateFrom} — {rollup.period.dateTo}
            </p>
          </header>

          {/* Métricas generales */}
          <section className="executive-report-avoid-break space-y-8">
            <h2 className="text-xl font-semibold tracking-tight">Métricas generales</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
              <Kpi
                value={shortMoneyK(rollup.summary.total_maintenance)}
                label="Gasto total"
                sub="MXN en mantenimiento"
              />
              <Kpi
                value={shortM3(rollup.summary.total_concrete_m3)}
                label="Producción"
                sub="metros cúbicos"
              />
              <Kpi
                value={
                  rollup.summary.cost_per_m3 != null ? fmtNum(rollup.summary.cost_per_m3, 2) : '—'
                }
                label="Costo por m³"
                sub="MXN por metro cúbico"
              />
              <Kpi value={String(rollup.summary.asset_count)} label="Equipos" sub="unidades en el análisis" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="rounded-lg border border-[var(--er-border)] p-6"
                style={{ background: 'var(--er-accent)' }}
              >
                <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4">Distribución de gastos (mantenimiento)</h3>
                <ul className="space-y-2 text-sm text-[#262626]">
                  <li>
                    Correctivo: {fmtMoneyFull(rollup.summary.total_corrective)} (
                    {rollup.summary.total_maintenance > 0
                      ? fmtPct((rollup.summary.total_corrective / rollup.summary.total_maintenance) * 100)
                      : '0%'}
                    )
                  </li>
                  <li>
                    Preventivo: {fmtMoneyFull(rollup.summary.total_preventive)} (
                    {rollup.summary.total_maintenance > 0
                      ? fmtPct((rollup.summary.total_preventive / rollup.summary.total_maintenance) * 100)
                      : '0%'}
                    )
                  </li>
                  <li className="pt-2 font-medium">
                    Ratio correctivo/preventivo:{' '}
                    {rollup.summary.corrective_to_preventive_ratio != null
                      ? `${fmtNum(rollup.summary.corrective_to_preventive_ratio, 2)}:1`
                      : 'N/D'}
                  </li>
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--er-border)] bg-white p-6">
                <h3 className="text-sm font-semibold text-[#111] mb-4">Operación</h3>
                <ul className="space-y-2 text-sm text-[var(--er-muted)]">
                  <li>
                    Total de horas trabajadas:{' '}
                    <span className="text-[#111] font-medium tabular-nums">
                      {fmtNum(rollup.summary.total_hours, 0)} horas
                    </span>
                  </li>
                  <li>
                    Equipos en el análisis:{' '}
                    <span className="text-[#111] font-medium">{rollup.summary.asset_count} unidades</span>
                  </li>
                  <li title="Indicador pendiente de definición en el sistema">
                    Cobertura de horas: <span className="text-[#111] font-medium">N/D</span>
                    <span className="block text-xs mt-1 text-[var(--er-muted)]">
                      Métrica por definir (fórmula operativa pendiente).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Distribución por categoría */}
          <section className="executive-report-avoid-break space-y-6 executive-report-break-after">
            <h2 className="text-xl font-semibold tracking-tight">Distribución por categoría</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-72 w-full">
                {pieMaintenance.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieMaintenance}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        stroke="#fff"
                        strokeWidth={1}
                      >
                        {pieMaintenance.map((e) => (
                          <Cell key={e.name} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--er-muted)]">Sin gastos de mantenimiento en el periodo.</p>
                )}
              </div>
              <div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {pieMaintenance.map((s) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: s.fill }}
                      />
                      <span className="text-[#262626]">{s.name}</span>
                    </li>
                  ))}
                </ul>
                {categoryNarrative && (
                  <p className="mt-6 text-sm leading-relaxed text-[var(--er-muted)] border-l-2 border-[var(--er-border)] pl-4">
                    {categoryNarrative}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Análisis detallado por categoría */}
          <section className="executive-report-avoid-break space-y-6">
            <h2 className="text-xl font-semibold tracking-tight">Análisis por categoría</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {rollup.categories_by_maintenance_desc.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-[var(--er-border)] p-5"
                  style={{ background: 'var(--er-card-tint)' }}
                >
                  <p className="font-semibold text-[#111]">{c.id}</p>
                  <p className="mt-2 text-lg tabular-nums font-medium">
                    {fmtMoney(c.maintenance_cost)}
                    <span className="text-sm font-normal text-[var(--er-muted)] ml-2">
                      (
                      {rollup.summary.total_maintenance > 0
                        ? fmtPct((c.maintenance_cost / rollup.summary.total_maintenance) * 100)
                        : '0%'}
                      )
                    </span>
                  </p>
                  <ul className="mt-3 text-sm text-[var(--er-muted)] space-y-1">
                    <li>{c.asset_count} unidades</li>
                    <li>
                      Ratio c/p:{' '}
                      {c.corrective_to_preventive_ratio != null
                        ? `${fmtNum(c.corrective_to_preventive_ratio, 2)}:1`
                        : 'N/D'}
                    </li>
                    <li>{fmtNum(c.hours_worked, 0)} horas</li>
                  </ul>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rollup.categories_by_maintenance_desc.slice(3).map((c) => (
                <div key={c.id} className="rounded-lg border border-[var(--er-border)] bg-white p-4">
                  <p className="font-semibold text-[#111] text-sm">{c.id}</p>
                  <p className="text-sm tabular-nums mt-1">
                    {fmtMoney(c.maintenance_cost)} · {c.asset_count} u. · {fmtNum(c.hours_worked, 0)} h
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Horas */}
          <section className="executive-report-avoid-break space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-tight">Distribución de horas trabajadas</h2>
              <p className="text-sm text-[var(--er-muted)] tabular-nums">
                Total: {fmtNum(rollup.summary.total_hours, 0)} horas
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="h-64 lg:col-span-1">
                {pieHours.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieHours}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        stroke="#fff"
                        strokeWidth={1}
                      >
                        {pieHours.map((e) => (
                          <Cell key={e.name} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtNum(Number(v), 0) + ' h'} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--er-muted)]">Sin horas registradas.</p>
                )}
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {top3Hours.map((t) => (
                  <div
                    key={t.name}
                    className="flex flex-col items-center justify-center rounded-lg border border-[var(--er-border)] py-6 px-3 bg-white"
                  >
                    <span className="text-2xl font-semibold tabular-nums text-[#111]">
                      {fmtPct(t.pct)}
                    </span>
                    <span className="text-xs font-medium text-[var(--er-muted)] mt-2 text-center">{t.name}</span>
                    <span className="text-sm tabular-nums text-[#444] mt-1">{fmtNum(t.hours, 0)} horas</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Top 10 gasto */}
          <section className="executive-report-avoid-break space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Top 10 equipos por gasto (mantenimiento)</h2>
            <ol className="space-y-4">
              {rollup.top10_by_maintenance.map((r, i) => (
                <li key={r.id} className="flex gap-4">
                  <span
                    className={`shrink-0 flex h-8 w-8 items-center justify-center rounded border border-[var(--er-border)] text-sm tabular-nums ${
                      i < 5 ? 'bg-neutral-100 text-[#111]' : 'text-[var(--er-muted)]'
                    }`}
                  >
                    {i < 5 ? i + 1 : '•'}
                  </span>
                  <div>
                    <p className="font-semibold text-[#111]">{r.asset_code || r.asset_name}</p>
                    <p className="text-sm text-[var(--er-muted)] tabular-nums">
                      {fmtMoney(r.maintenance_cost)}
                      {r.cost_per_hour != null
                        ? ` · ${fmtMoneyFull(r.cost_per_hour)} /h · ${fmtNum(r.hours_worked, 0)} h`
                        : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Ollas bar */}
          <section className="executive-report-avoid-break space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Ollas revolvedoras — concentración de gasto</h2>
            {rollup.mixer_bar_rows.length > 0 ? (
              <>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rollup.mixer_bar_rows}
                      layout="vertical"
                      margin={{ left: 16, right: 16 }}
                    >
                      <XAxis type="number" tickFormatter={(v) => fmtMoney(Number(v))} />
                      <YAxis type="category" dataKey="code" width={88} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmtMoney(v)} />
                      <Bar dataKey="maintenance_cost" radius={[0, 4, 4, 0]}>
                        {rollup.mixer_bar_rows.map((row, i) => (
                          <Cell
                            key={row.code}
                            fill={grayscaleForIndex(i, rollup.mixer_bar_rows.length)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border border-[var(--er-border)] p-5 bg-white">
                  <h3 className="text-sm font-semibold mb-2">Concentración de gastos</h3>
                  <p className="text-sm text-[var(--er-muted)] leading-relaxed">
                    El top {rollup.mixer_bar_rows.length} de ollas revolvedoras representa{' '}
                    {fmtMoney(rollup.mixer_concentration.top10_sum)}
                    {rollup.mixer_concentration.pct_of_category != null && (
                      <>
                        , equivalente al {fmtPct(rollup.mixer_concentration.pct_of_category)} del gasto en esta
                        categoría
                      </>
                    )}
                    .
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--er-muted)]">Sin datos de ollas en el periodo.</p>
            )}
          </section>

          {/* Ratio */}
          <section className="executive-report-avoid-break space-y-6">
            <h2 className="text-xl font-semibold tracking-tight">Ratio correctivo vs preventivo por categoría</h2>
            <div className="space-y-4">
              {ratioBars.map((r) => {
                const val = r.corrective_to_preventive_ratio || 0
                const w = maxRatioBar > 0 ? (val / maxRatioBar) * 100 : 0
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-[#111]">{r.id}</span>
                      <span className="tabular-nums text-[var(--er-muted)]">{fmtNum(val, 2)}:1</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-200 overflow-hidden">
                      <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="rounded-lg border border-[var(--er-border)] bg-neutral-50 p-6">
              <p className="text-sm font-semibold text-[#111]">
                Promedio general:{' '}
                {rollup.summary.corrective_to_preventive_ratio != null
                  ? `${fmtNum(rollup.summary.corrective_to_preventive_ratio, 2)}:1`
                  : 'N/D'}
              </p>
              <p className="mt-3 text-sm text-[var(--er-muted)] leading-relaxed">
                Un ratio por debajo de 2:1 suele indicar balance saludable entre correctivo y preventivo. Las
                categorías con mayor ratio pueden requerir refuerzo de mantenimiento preventivo.
              </p>
            </div>
          </section>

          {/* Operativas + metadatos */}
          <section className="executive-report-avoid-break space-y-8">
            <h2 className="text-xl font-semibold tracking-tight">Métricas operativas y resumen</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Kpi
                value={rollup.summary.cost_per_m3 != null ? fmtNum(rollup.summary.cost_per_m3, 2) : '—'}
                label="Costo por m³"
                sub="MXN por metro cúbico"
              />
              <Kpi
                value={
                  rollup.summary.cost_per_hour_global != null
                    ? fmtNum(rollup.summary.cost_per_hour_global, 2)
                    : '—'
                }
                label="Costo por hora"
                sub="MXN (mantenimiento / horas)"
              />
              <Kpi
                value={
                  rollup.summary.production_per_hour != null
                    ? fmtNum(rollup.summary.production_per_hour, 2)
                    : '—'
                }
                label="Producción por hora"
                sub="m³/h"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-3">Mayor utilización (horas)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {topAssetsByHours.map((a, idx) => (
                    <div
                      key={a.id}
                      className={`rounded-lg border border-[var(--er-border)] p-4 ${
                        idx === 2 ? 'col-span-2' : ''
                      }`}
                      style={{ background: 'var(--er-card-tint)' }}
                    >
                      <p className="font-semibold">{a.asset_code}</p>
                      <p className="text-sm text-[var(--er-muted)] tabular-nums">
                        {fmtNum(Number(a.hours_worked || 0), 0)} horas
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="rounded-lg border border-[var(--er-border)] p-6"
                style={{ background: 'var(--er-accent)' }}
              >
                <h3 className="text-sm font-semibold text-[#1a1a1a] mb-4">Información del análisis</h3>
                <dl className="space-y-2 text-sm text-[#262626]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#404040]">Periodo</dt>
                    <dd className="font-medium tabular-nums text-right">
                      {rollup.period.dateFrom} — {rollup.period.dateTo}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#404040]">Equipos</dt>
                    <dd className="font-medium text-right">{rollup.summary.asset_count} unidades</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#404040]">Categorías</dt>
                    <dd className="font-medium text-right">7 tipos</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#404040]">Cobertura horas</dt>
                    <dd className="font-medium text-right">N/D</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#404040]">Fuente</dt>
                    <dd className="font-medium text-right">Reporte gerencial</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* Costo por hora top */}
          <section className="executive-report-avoid-break space-y-4 pb-12">
            <h2 className="text-xl font-semibold tracking-tight">Costo por hora — top 10 equipos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {rollup.top10_by_cost_per_hour.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--er-border)] bg-neutral-50 p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--er-muted)]">Equipo</p>
                  <p className="font-semibold text-[#111] mt-1">{r.asset_code}</p>
                  <p className="mt-3 text-lg tabular-nums font-medium">
                    {r.cost_per_hour != null ? fmtMoneyFull(r.cost_per_hour) : '—'}
                    <span className="text-sm font-normal text-[var(--er-muted)]"> /h</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {rollup.top10_by_cost_per_hour.slice(3).map((r) => (
                <div key={r.id} className="flex justify-between border-b border-[var(--er-border)] py-2">
                  <span className="text-[#444]">{r.asset_code}</span>
                  <span className="tabular-nums text-[#111]">
                    {r.cost_per_hour != null ? fmtMoneyFull(r.cost_per_hour) : '—'} /h
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-[var(--er-muted)] border-l-2 border-[var(--er-border)] pl-4">
              Los equipos con mayor costo por hora conviene monitorearlos para optimizar costos operativos y
              priorizar acciones preventivas.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}

function Kpi({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div>
      <p className="text-3xl md:text-4xl font-semibold tracking-tight text-[#111] tabular-nums">{value}</p>
      <p className="mt-2 text-sm font-semibold text-[#262626]">{label}</p>
      <p className="text-xs text-[var(--er-muted)] mt-0.5">{sub}</p>
    </div>
  )
}
