'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import type { NominaConceptId } from '@/lib/reports/nomina-concept-classifier'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Download, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatCurrencyCompact, formatMonthLabel, formatMonthShort, formatPercent } from '../formatters'

type Props = {
  data: CostAnalysisResponse
}

type ViewMode = 'concepto' | 'departamento'

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
}

function formatRelativeDays(d: number | null): string {
  if (d === null) return 'sin capturas'
  if (d === 0) return 'hoy'
  if (d === 1) return 'hace 1 día'
  return `hace ${d} días`
}

function deltaTone(delta: number): string {
  if (delta > 0) return 'text-rose-600 dark:text-rose-400'
  if (delta < 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-muted-foreground'
}

export function NominaExplorer({ data }: Props) {
  const { months, byDepartment, byNominaConcept = [], dataFreshness, summary } = data
  const nominaDepts = useMemo(() => byDepartment.filter(d => d.type === 'nomina'), [byDepartment])
  const hasMonths = months.length > 0
  const last = hasMonths ? months[months.length - 1] : ''

  const effectiveMonth = useMemo(() => {
    if (!hasMonths) return ''
    for (let i = months.length - 1; i >= 0; i--) {
      const m = months[i]
      const sum = nominaDepts.reduce((s, d) => s + (d.monthlyTotals[m] || 0), 0)
      if (sum > 0) return m
    }
    return last
  }, [months, nominaDepts, hasMonths, last])

  const prev = useMemo(() => {
    if (!effectiveMonth) return null
    const idx = months.indexOf(effectiveMonth)
    return idx > 0 ? months[idx - 1] : null
  }, [months, effectiveMonth])

  const showEmptyBanner = hasMonths && last && effectiveMonth && last !== effectiveMonth

  const [viewMode, setViewMode] = useState<ViewMode>('concepto')
  const [selectedConceptId, setSelectedConceptId] = useState<NominaConceptId | null>(null)

  const conceptCards = useMemo(() => {
    return byNominaConcept.map(c => {
      const current = effectiveMonth ? (c.monthlyTotals[effectiveMonth] || 0) : 0
      const previous = prev ? (c.monthlyTotals[prev] || 0) : 0
      const delta = current - previous
      const deltaPct = previous > 0 ? (delta / previous) * 100 : null
      const pctOfNomina = effectiveMonth ? (c.pctOfNomina[effectiveMonth] || 0) : 0
      const total = months.reduce((s, m) => s + (c.monthlyTotals[m] || 0), 0)
      return { ...c, current, previous, delta, deltaPct, pctOfNomina, total }
    }).sort((a, b) => b.current - a.current || b.total - a.total)
  }, [byNominaConcept, effectiveMonth, prev, months])

  const activeConcept =
    conceptCards.find(c => c.conceptId === selectedConceptId) || conceptCards[0] || null

  const rankedDepts = useMemo(() => {
    return nominaDepts
      .map(d => {
        const current = effectiveMonth ? (d.monthlyTotals[effectiveMonth] || 0) : 0
        const previous = prev ? (d.monthlyTotals[prev] || 0) : 0
        const delta = current - previous
        const deltaPct = previous > 0 ? (delta / previous) * 100 : null
        const total = months.reduce((s, m) => s + (d.monthlyTotals[m] || 0), 0)
        return { ...d, current, previous, delta, deltaPct, total }
      })
      .filter(d => d.total > 0)
      .sort((a, b) => b.current - a.current || b.total - a.total)
  }, [nominaDepts, effectiveMonth, prev, months])

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const selectedDeptRow = rankedDepts.find(d => d.department === selectedDept) || rankedDepts[0]

  const lastUpdatedDays = daysSince(dataFreshness?.manualAdjustments?.lastUpdatedAt ?? null)
  const rowsThisMonth = effectiveMonth
    ? (dataFreshness?.manualAdjustments?.rowCountByMonth?.[effectiveMonth] ?? 0)
    : 0
  const nominaTotalThisMonth = effectiveMonth ? (summary.nomina[effectiveMonth] || 0) : 0

  const apoyoTrend = useMemo(() => {
    const apoyo = byNominaConcept.find(c => c.conceptId === 'apoyo')
    if (!apoyo) return []
    return months.map(m => ({
      month: formatMonthShort(m),
      pct: apoyo.pctOfNomina[m] || 0,
      amount: apoyo.monthlyTotals[m] || 0,
    }))
  }, [byNominaConcept, months])

  const exportCsv = () => {
    const header = ['Concepto', ...months.map(formatMonthLabel)].join(',')
    const lines = byNominaConcept.map(c => {
      const vals = months.map(m => (c.monthlyTotals[m] || 0).toFixed(2))
      return [c.conceptLabel, ...vals].join(',')
    })
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nomina-conceptos-${months[0]}-${months[months.length - 1]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!hasMonths) {
    return <p className="text-sm text-muted-foreground">Sin datos de nómina en el rango.</p>
  }

  if (conceptCards.length === 0 && rankedDepts.length === 0) {
    return (
      <div className="space-y-3">
        {showEmptyBanner && <EmptyMonthBanner latestMonth={last} effectiveMonth={effectiveMonth} />}
        <p className="text-sm text-muted-foreground">Sin datos de nómina en el rango.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showEmptyBanner && <EmptyMonthBanner latestMonth={last} effectiveMonth={effectiveMonth} />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Última captura: {formatRelativeDays(lastUpdatedDays)}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="tabular-nums">
            {rowsThisMonth} ajuste{rowsThisMonth === 1 ? '' : 's'} en {formatMonthLabel(effectiveMonth)}
          </span>
          <span className="text-muted-foreground/60">·</span>
          <span className="tabular-nums">Total nómina: {formatCurrency(nominaTotalThisMonth)}</span>
        </div>
        {byNominaConcept.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={exportCsv}>
            <Download className="mr-1.5 h-3 w-3" />
            Exportar CSV
          </Button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg border border-border/60 p-0.5 w-fit">
        {(['concepto', 'departamento'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              viewMode === mode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {mode === 'concepto' ? 'Por concepto' : 'Por departamento'}
          </button>
        ))}
      </div>

      {viewMode === 'concepto' && activeConcept && (
        <ConceptView
          months={months}
          effectiveMonth={effectiveMonth}
          concepts={conceptCards}
          active={activeConcept}
          onSelectConcept={setSelectedConceptId}
          apoyoTrend={apoyoTrend}
        />
      )}

      {viewMode === 'departamento' && selectedDeptRow && (
        <DepartmentView
          months={months}
          effectiveMonth={effectiveMonth}
          ranked={rankedDepts}
          selected={selectedDeptRow}
          onSelectDept={setSelectedDept}
        />
      )}
    </div>
  )
}

type ConceptCard = CostAnalysisResponse['byNominaConcept'][number] & {
  current: number
  previous: number
  delta: number
  deltaPct: number | null
  pctOfNomina: number
  total: number
}

function ConceptView({
  months,
  effectiveMonth,
  concepts,
  active,
  onSelectConcept,
  apoyoTrend,
}: {
  months: string[]
  effectiveMonth: string
  concepts: ConceptCard[]
  active: ConceptCard
  onSelectConcept: (id: NominaConceptId) => void
  apoyoTrend: Array<{ month: string; pct: number; amount: number }>
}) {
  const max = concepts[0]?.current || 0
  const chartRows = months.map(m => ({
    month: formatMonthShort(m),
    value: active.monthlyTotals[m] || 0,
    pct: active.pctOfNomina[m] || 0,
  }))

  const deptRows = active.byDepartment
    .map(d => ({
      ...d,
      current: effectiveMonth ? (d.monthlyTotals[effectiveMonth] || 0) : 0,
    }))
    .filter(d => d.current > 0)
    .sort((a, b) => b.current - a.current)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {concepts.map(c => {
          const selected = c.conceptId === active.conceptId
          const Arrow = c.delta > 0 ? ArrowUpRight : c.delta < 0 ? ArrowDownRight : Minus
          return (
            <button
              key={c.conceptId}
              type="button"
              onClick={() => onSelectConcept(c.conceptId)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                selected ? 'border-indigo-400/60 bg-indigo-500/5' : 'border-border/50 hover:bg-muted/40'
              )}
            >
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {c.conceptLabel}
              </p>
              <p className="mt-0.5 text-base font-semibold tabular-nums">{formatCurrencyCompact(c.current)}</p>
              <div className="mt-1 flex items-center justify-between gap-1 text-[10px]">
                <span className="text-muted-foreground tabular-nums">{formatPercent(c.pctOfNomina)} del total</span>
                <span className={cn('inline-flex items-center tabular-nums', deltaTone(c.delta))}>
                  <Arrow className="h-2.5 w-2.5" />
                  {c.deltaPct !== null ? `${c.deltaPct > 0 ? '+' : ''}${c.deltaPct.toFixed(0)}%` : '—'}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Departamentos · {active.conceptLabel} · {formatMonthShort(effectiveMonth)}
          </p>
          <div className="max-h-[280px] overflow-y-auto pr-1">
            {deptRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin desglose por departamento.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {deptRows.map(d => {
                  const pct = max > 0 ? (d.current / max) * 100 : 0
                  return (
                    <div key={d.department} className="px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">{d.department}</p>
                        <p className="flex-shrink-0 text-sm font-semibold tabular-nums">
                          {formatCurrencyCompact(d.current)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 lg:col-span-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Serie temporal</p>
            <h3 className="text-lg font-semibold">{active.conceptLabel}</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              Total en rango: {formatCurrency(active.total)}
            </p>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="concept-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(270 55% 55%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(270 55% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={60} />
                <Tooltip
                  content={({ active: isActive, payload, label }) => {
                    if (!isActive || !payload?.length) return null
                    const row = payload[0]?.payload as { value: number; pct: number }
                    return (
                      <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                        <p className="mb-1 font-medium">{label}</p>
                        <p className="tabular-nums">{formatCurrency(row.value)}</p>
                        <p className="text-muted-foreground tabular-nums">{formatPercent(row.pct)} del total nómina</p>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(270 55% 55%)" strokeWidth={2} fill="url(#concept-trend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {apoyoTrend.some(r => r.amount > 0) && (
        <div className="rounded-xl border border-border/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Apoyos como % del costo de nómina
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tendencia mensual para medir el concepto de apoyos en el tiempo.
          </p>
          <div className="mt-3 h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={apoyoTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tickLine={false} axisLine={false} className="text-xs" width={44} />
                <Tooltip
                  content={({ active: isActive, payload, label }) => {
                    if (!isActive || !payload?.length) return null
                    const row = payload[0]?.payload as { pct: number; amount: number }
                    return (
                      <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                        <p className="mb-1 font-medium">{label}</p>
                        <p className="tabular-nums">{formatPercent(row.pct)} · {formatCurrency(row.amount)}</p>
                      </div>
                    )
                  }}
                />
                <Line type="monotone" dataKey="pct" stroke="hsl(32 85% 50%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="h-[180px] w-full">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Comparativo mensual por concepto
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={months.map(m => {
              const row: Record<string, string | number> = { month: formatMonthShort(m) }
              for (const c of concepts) {
                row[c.conceptId] = c.monthlyTotals[m] || 0
              }
              return row
            })}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
            <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={56} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            {concepts.map((c, i) => (
              <Bar
                key={c.conceptId}
                dataKey={c.conceptId}
                name={c.conceptLabel}
                stackId="nomina"
                fill={`hsl(${(240 + i * 36) % 360} 55% 55%)`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

type DeptRow = CostAnalysisResponse['byDepartment'][number] & {
  current: number
  previous: number
  delta: number
  deltaPct: number | null
  total: number
}

function DepartmentView({
  months,
  effectiveMonth,
  ranked,
  selected,
  onSelectDept,
}: {
  months: string[]
  effectiveMonth: string
  ranked: DeptRow[]
  selected: DeptRow
  onSelectDept: (dept: string) => void
}) {
  const max = ranked[0]?.current || 0
  const chartRows = months.map(m => ({
    month: formatMonthShort(m),
    value: selected.monthlyTotals[m] || 0,
  }))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Departamentos · {formatMonthShort(effectiveMonth)}
        </p>
        <div className="max-h-[420px] overflow-y-auto pr-1">
          <div className="divide-y divide-border/40">
            {ranked.map(d => {
              const active = d.department === selected.department
              const pct = max > 0 ? (d.current / max) * 100 : 0
              const Arrow = d.delta > 0 ? ArrowUpRight : d.delta < 0 ? ArrowDownRight : Minus
              return (
                <button
                  key={d.department}
                  type="button"
                  onClick={() => onSelectDept(d.department)}
                  className={cn(
                    'w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40',
                    active && 'bg-muted/60'
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">{d.department}</p>
                    <p className="flex-shrink-0 text-sm font-semibold tabular-nums">{formatCurrencyCompact(d.current)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-400/70" style={{ width: `${pct}%` }} />
                    </div>
                    <div className={cn('flex min-w-[56px] items-center justify-end gap-0.5 text-[11px] tabular-nums', deltaTone(d.delta))}>
                      <Arrow className="h-3 w-3" />
                      <span>{d.deltaPct !== null ? `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(0)}%` : '—'}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3 lg:col-span-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tendencia de nómina</p>
          <h3 className="text-lg font-semibold">{selected.department}</h3>
          <p className="text-xs text-muted-foreground tabular-nums">Total en rango: {formatCurrency(selected.total)}</p>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nom-trend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(240 55% 55%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(240 55% 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} className="text-xs" width={60} />
              <Tooltip
                content={({ active: isActive, payload, label }) => {
                  if (!isActive || !payload?.length) return null
                  return (
                    <div className="rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                      <p className="mb-1 font-medium">{label}</p>
                      <p className="tabular-nums">{formatCurrency(Number(payload[0].value))}</p>
                    </div>
                  )
                }}
              />
              <Area type="monotone" dataKey="value" stroke="hsl(240 55% 55%)" strokeWidth={2} fill="url(#nom-trend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function EmptyMonthBanner({ latestMonth, effectiveMonth }: { latestMonth: string; effectiveMonth: string }) {
  return (
    <div className="callout-attention flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium">{formatMonthLabel(latestMonth)}</span>
          {' '}aún sin captura de nómina. Mostrando{' '}
          <span className="font-medium">{formatMonthLabel(effectiveMonth)}</span>.
        </div>
      </div>
      <Link
        href={`/reportes/gerencial/manual-costs?month=${latestMonth}`}
        className="text-xs font-medium underline-offset-2 hover:underline"
      >
        Capturar ahora →
      </Link>
    </div>
  )
}
