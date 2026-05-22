'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { CostAnalysisResponse } from '@/lib/reports/cost-analysis-aggregate'
import { useCostAnalysisData } from './hooks/use-cost-analysis-data'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

import { FilterBar } from './filters/filter-bar'
import {
  buildMonthsForApi,
  computeMonthPreset,
  computePresetRange,
  formatRangeLabel,
  type MonthPreset,
  type RangeMode,
  type RangePreset,
  type ViewMode,
} from './filters/view-mode'
import { CommandCenter } from './command-center/command-center'
import { RevenueCompositionChart } from './revenue/revenue-composition-chart'
import { PriceVolumeChart } from './revenue/price-volume-chart'
import { PlantRevenueRanking } from './revenue/plant-revenue-ranking'
import { CostStackChart } from './cost-structure/cost-stack-chart'
import { UnitCostChart } from './cost-structure/unit-cost-chart'
import { IndirectExplorer } from './cost-structure/indirect-explorer'
import { NominaExplorer } from './cost-structure/nomina-explorer'
import { ManttoTypeSplit } from './cost-structure/mantto-type-split'
import { formatCurrency, formatMonthLabel } from './formatters'
import { EbitdaWaterfall } from './profitability/ebitda-waterfall'
import { MarginLadderChart } from './profitability/margin-ladder-chart'
import { PlantMatrix } from './plant-matrix/plant-matrix'
import { MetricDrilldownSheet } from './drilldown/metric-drilldown-sheet'
import { useMetricDrilldown } from './drilldown/use-metric-drilldown'
import type { DrilldownMetric } from './drilldown/drilldown-types'

type FilterOptions = {
  businessUnits: Array<{ id: string; name: string; code: string }>
  plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

function SectionSkeleton({ height = 320 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl border border-border/40 bg-card"
      style={{ height }}
    />
  )
}

function DrillButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClick}>
      {label}
    </Button>
  )
}

export function CostAnalysisDashboard() {
  const { toast } = useToast()
  const ytd = computePresetRange('ytd')
  const thisMonth = computeMonthPreset('this_month')

  const [rangeMode, setRangeMode] = useState<RangeMode>('range')
  const [preset, setPreset] = useState<RangePreset>('ytd')
  const [monthPreset, setMonthPreset] = useState<MonthPreset>('this_month')
  const [monthFrom, setMonthFrom] = useState(ytd.from)
  const [monthTo, setMonthTo] = useState(ytd.to)
  const [focusMonth, setFocusMonth] = useState(thisMonth)
  const [businessUnitId, setBusinessUnitId] = useState<string>('')
  const [plantId, setPlantId] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('absolute')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [displayedRangeLabel, setDisplayedRangeLabel] = useState<string | null>(null)
  const filterOptionsLoaded = useRef(false)

  const { data, loading, error, load, pendingParams } = useCostAnalysisData()
  const drill = useMetricDrilldown()

  const { apiMonths } = useMemo(
    () => buildMonthsForApi({ rangeMode, monthFrom, monthTo, focusMonth }),
    [rangeMode, monthFrom, monthTo, focusMonth]
  )

  const pendingRangeLabel = useMemo(() => {
    if (pendingParams?.months?.length) {
      const sorted = [...pendingParams.months].sort()
      return formatRangeLabel(sorted[0]!, sorted[sorted.length - 1]!)
    }
    if (rangeMode === 'month') return focusMonth.slice(0, 7)
    return formatRangeLabel(monthFrom, monthTo)
  }, [pendingParams, rangeMode, focusMonth, monthFrom, monthTo])

  useEffect(() => {
    if (preset === 'custom') return
    const r = computePresetRange(preset)
    setMonthFrom(r.from)
    setMonthTo(r.to)
  }, [preset])

  useEffect(() => {
    if (monthPreset === 'pick_month') return
    setFocusMonth(computeMonthPreset(monthPreset))
  }, [monthPreset])

  const refreshFilters = useCallback(async () => {
    try {
      const r = await fetch('/api/reports/gerencial/scope-filters')
      const j = await r.json()
      if (r.ok && j.businessUnits && j.plants) {
        setFilterOptions({
          businessUnits: j.businessUnits as FilterOptions['businessUnits'],
          plants: j.plants as FilterOptions['plants'],
        })
        filterOptionsLoaded.current = true
      }
    } catch {
      /* ignore */
    }
  }, [])

  const requestFilterOptions = useCallback(() => {
    if (!filterOptionsLoaded.current) void refreshFilters()
  }, [refreshFilters])

  const scopePlantIds = useMemo(() => {
    const plants = filterOptions?.plants || []
    const filtered = businessUnitId
      ? plants.filter(p => p.business_unit_id === businessUnitId)
      : plants
    if (plantId) return filtered.filter(p => p.id === plantId).map(p => p.id)
    return filtered.map(p => p.id)
  }, [filterOptions, businessUnitId, plantId])

  const runLoad = useCallback(() => {
    if (apiMonths.length === 0) {
      toast({ variant: 'destructive', title: 'Rango inválido', description: 'Seleccione un rango o mes válido.' })
      return
    }
    void load({
      months: apiMonths,
      businessUnitId: businessUnitId || null,
      plantId: plantId || null,
    })
  }, [load, apiMonths, businessUnitId, plantId, toast])

  useEffect(() => {
    runLoad()
  }, [runLoad])

  useEffect(() => {
    if (data && !loading) {
      const label =
        rangeMode === 'month'
          ? focusMonth.slice(0, 7)
          : formatRangeLabel(data.months[0] ?? monthFrom, data.months[data.months.length - 1] ?? monthTo)
      setDisplayedRangeLabel(label)
      if (data.months.includes(focusMonth.slice(0, 7))) return
      const last = data.months[data.months.length - 1]
      if (last) setFocusMonth(last)
    }
  }, [data, loading, rangeMode, focusMonth, monthFrom, monthTo])

  const handleDrilldown = useCallback(
    (metric: DrilldownMetric) => {
      const month = focusMonth.slice(0, 7)
      const reconcileManttoByPlant =
        metric === 'mantto' && data
          ? Object.fromEntries(
              data.byPlant
                .filter(
                  p =>
                    scopePlantIds.length === 0 || scopePlantIds.includes(p.plantId)
                )
                .map(p => [p.plantId, p.manttoTotal[month] ?? 0])
            )
          : undefined
      void drill.openDrilldown(metric, month, scopePlantIds, reconcileManttoByPlant)
    },
    [drill, data, focusMonth, scopePlantIds]
  )

  const showLoadingShell = loading && !data
  const showRefetchOverlay = loading && !!data

  return (
    <div className="space-y-8">
      <FilterBar
        rangeMode={rangeMode}
        onRangeModeChange={setRangeMode}
        monthFrom={monthFrom}
        monthTo={monthTo}
        onMonthFromChange={setMonthFrom}
        onMonthToChange={setMonthTo}
        focusMonth={focusMonth}
        onFocusMonthChange={v => {
          setFocusMonth(v)
          setMonthPreset('pick_month')
        }}
        preset={preset}
        onPresetChange={setPreset}
        monthPreset={monthPreset}
        onMonthPresetChange={setMonthPreset}
        businessUnitId={businessUnitId}
        onBusinessUnitChange={setBusinessUnitId}
        plantId={plantId}
        onPlantChange={setPlantId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterOptions={filterOptions}
        loading={loading}
        onRefresh={runLoad}
        onRequestFilterOptions={requestFilterOptions}
        lastUpdatedAt={data?.dataFreshness?.manualAdjustments?.lastUpdatedAt ?? null}
        displayedRangeLabel={displayedRangeLabel}
        pendingRangeLabel={loading ? pendingRangeLabel : null}
      />

      {showRefetchOverlay && (
        <div className="sticky top-[7.5rem] z-20 flex items-center gap-2 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span>
            Cargando datos para <span className="font-medium tabular-nums">{pendingRangeLabel}</span>…
          </span>
        </div>
      )}

      {error && (
        <div className="callout-critical">
          <p className="text-sm font-medium">Error al cargar datos</p>
          <p className="mt-0.5 text-xs opacity-80">{error}</p>
        </div>
      )}

      {showLoadingShell && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[136px] animate-pulse rounded-2xl border border-border/40 bg-card" />
            ))}
          </div>
          <SectionSkeleton height={360} />
          <SectionSkeleton height={360} />
        </div>
      )}

      {data && data.months.length > 0 && (
        <div
          className={cn(
            'space-y-8 transition-opacity',
            showRefetchOverlay && 'pointer-events-none opacity-50'
          )}
        >
          <section className="space-y-3">
            <CommandCenter
              data={data}
              viewMode={viewMode}
              focusMonth={focusMonth}
              onDrilldown={handleDrilldown}
            />
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Ingresos"
              title="Ventas y volumen"
              description="Concreto, bombeo y dinámica precio–volumen."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Composición de ingresos</CardTitle>
                  <CardDescription className="text-xs">Concreto + bombeo por mes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <RevenueCompositionChart data={data} onMonthClick={setFocusMonth} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Precio vs volumen</CardTitle>
                  <CardDescription className="text-xs">Precio unitario y m³ entregados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PriceVolumeChart data={data} onMonthClick={setFocusMonth} />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de plantas · ingresos</CardTitle>
                <CardDescription className="text-xs">
                  Mes foco: {formatMonthLabel(focusMonth)}. Click en KPIs para desglose.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PlantRevenueRanking data={data} focusMonth={focusMonth} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Gastos"
              title="Estructura de costos"
              description="Composición y evolución de cada componente del costo."
            />

            {data.reconciliation && (
              <ReconciliationCallout reconciliation={data.reconciliation} months={data.months} />
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">Costos por mes</CardTitle>
                    <CardDescription className="text-xs">Materia prima + operativos por categoría.</CardDescription>
                  </div>
                  <DrillButton label="Ver detalle" onClick={() => handleDrilldown('costo_op')} />
                </CardHeader>
                <CardContent>
                  <CostStackChart data={data} onMonthClick={setFocusMonth} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">Costo unitario ($ / m³)</CardTitle>
                    <CardDescription className="text-xs">Economía por m³ de cada componente.</CardDescription>
                  </div>
                  <DrillButton label="Ver detalle" onClick={() => handleDrilldown('costo_op')} />
                </CardHeader>
                <CardContent>
                  <UnitCostChart data={data} onMonthClick={setFocusMonth} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Mantenimiento · correctivo vs preventivo</CardTitle>
                  <CardDescription className="text-xs">
                    Gasto clasificado por tipo de orden de trabajo.
                  </CardDescription>
                </div>
                <DrillButton label="Por activo" onClick={() => handleDrilldown('mantto')} />
              </CardHeader>
              <CardContent>
                <ManttoTypeSplit data={data} onMonthClick={setFocusMonth} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Gasto indirecto · explorador</CardTitle>
                  <CardDescription className="text-xs">Categorías y subcategorías.</CardDescription>
                </div>
                <DrillButton label="Ver detalle" onClick={() => handleDrilldown('otros')} />
              </CardHeader>
              <CardContent>
                <IndirectExplorer data={data} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Nómina · explorador por departamento</CardTitle>
                  <CardDescription className="text-xs">Efectivo vs no efectivo en el desglose.</CardDescription>
                </div>
                <DrillButton label="Efectivo / no efectivo" onClick={() => handleDrilldown('nomina')} />
              </CardHeader>
              <CardContent>
                <NominaExplorer data={data} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Rentabilidad"
              title="De ventas a EBITDA"
              description={`Mes foco: ${formatMonthLabel(focusMonth)}.`}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div>
                    <CardTitle className="text-base">Cascada del EBITDA</CardTitle>
                    <CardDescription className="text-xs">{formatMonthLabel(focusMonth)}.</CardDescription>
                  </div>
                  <DrillButton label="Ver cascada" onClick={() => handleDrilldown('waterfall')} />
                </CardHeader>
                <CardContent>
                  <EbitdaWaterfall data={data} focusMonth={focusMonth} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Escalera de márgenes</CardTitle>
                  <CardDescription className="text-xs">Spread vs EBITDA como % de ventas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarginLadderChart data={data} />
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow="Investigación"
              title="Matriz de plantas"
              description="Cada planta, cada métrica. Click en una fila para abrir su P&L."
            />
            <PlantMatrix data={data} focusMonth={focusMonth} />
          </section>

          {data.reconciliation && (
            <div className="flex flex-wrap items-center gap-4 border-t border-border/50 pt-4 text-xs text-muted-foreground">
              <ReconciliationBadge
                ok={data.reconciliation.nominaDepartmentSumMatchesSummary}
                label="Nómina: suma por departamento = total"
              />
              <ReconciliationBadge
                ok={data.reconciliation.otrosCategorySumMatchesSummary}
                label="Otros indirectos: suma por categoría = total"
              />
            </div>
          )}
        </div>
      )}

      {data && data.months.length === 0 && !loading && (
        <div className="callout-attention">
          <p className="text-sm">No hay meses en el rango seleccionado.</p>
        </div>
      )}

      <MetricDrilldownSheet
        open={drill.open}
        metric={drill.metric}
        focusMonth={drill.focusMonth || focusMonth}
        onFocusMonthChange={m => {
          setFocusMonth(m)
          if (!drill.metric) return
          const monthKey = m.slice(0, 7)
          const reconcileManttoByPlant =
            drill.metric === 'mantto' && data
              ? Object.fromEntries(
                  data.byPlant
                    .filter(
                      p =>
                        scopePlantIds.length === 0 ||
                        scopePlantIds.includes(p.plantId)
                    )
                    .map(p => [p.plantId, p.manttoTotal[monthKey] ?? 0])
                )
              : undefined
          void drill.openDrilldown(
            drill.metric,
            m,
            scopePlantIds,
            reconcileManttoByPlant
          )
        }}
        data={data}
        scopePlantIds={scopePlantIds}
        operationalLoading={drill.operationalLoading}
        operationalError={drill.operationalError}
        dieselDetails={drill.dieselDetails}
        manttoDetails={drill.manttoDetails}
        onClose={drill.close}
      />
    </div>
  )
}

function ReconciliationBadge({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : AlertCircle
  return (
    <div className={cn('flex items-center gap-1.5 tabular-num', ok ? 'text-emerald-600' : 'text-amber-600')}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  )
}

type ReconciliationShape = CostAnalysisResponse['reconciliation']

function ReconciliationCallout({
  reconciliation,
  months,
}: {
  reconciliation: ReconciliationShape
  months: string[]
}) {
  if (!reconciliation) return null
  const EPS = 0.02
  const flagged: Array<{ month: string; kind: 'otros' | 'nomina'; delta: number }> = []
  for (const m of months) {
    const otros = reconciliation.otrosDiffByMonth?.[m] ?? 0
    if (Math.abs(otros) > EPS) flagged.push({ month: m, kind: 'otros', delta: otros })
    const nomina = reconciliation.nominaDiffByMonth?.[m] ?? 0
    if (Math.abs(nomina) > EPS) flagged.push({ month: m, kind: 'nomina', delta: nomina })
  }
  if (flagged.length === 0) return null

  flagged.sort((a, b) => (a.month < b.month ? 1 : -1))
  const visible = flagged.slice(0, 3)

  return (
    <div className="callout-attention">
      <p className="text-sm font-medium">Diferencia detectada entre desglose y total</p>
      <p className="mt-0.5 text-xs opacity-80">
        Algunas sumas por categoría o departamento no coinciden con el total mensual.
      </p>
      <ul className="mt-2 space-y-0.5 text-xs tabular-num">
        {visible.map(f => (
          <li key={`${f.month}-${f.kind}`} className="flex items-center gap-2">
            <span className="font-medium">{formatMonthLabel(f.month)}</span>
            <span className="text-muted-foreground">
              {f.kind === 'otros' ? 'Otros indirectos' : 'Nómina'}
            </span>
            <span className={cn(f.delta > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              Δ {f.delta > 0 ? '+' : ''}{formatCurrency(f.delta)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
