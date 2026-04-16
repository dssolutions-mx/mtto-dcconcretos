'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { shiftMonthString } from '@/lib/reports/month-utils'
import { useCostAnalysisData } from './hooks/use-cost-analysis-data'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

import { FilterBar } from './filters/filter-bar'
import { computePresetRange, type RangePreset, type ViewMode } from './filters/view-mode'
import { CommandCenter } from './command-center/command-center'
import { RevenueCompositionChart } from './revenue/revenue-composition-chart'
import { PriceVolumeChart } from './revenue/price-volume-chart'
import { PlantRevenueRanking } from './revenue/plant-revenue-ranking'
import { CostStackChart } from './cost-structure/cost-stack-chart'
import { UnitCostChart } from './cost-structure/unit-cost-chart'
import { IndirectExplorer } from './cost-structure/indirect-explorer'
import { NominaExplorer } from './cost-structure/nomina-explorer'
import { EbitdaWaterfall } from './profitability/ebitda-waterfall'
import { MarginLadderChart } from './profitability/margin-ladder-chart'
import { PlantMatrix } from './plant-matrix/plant-matrix'

type FilterOptions = {
  businessUnits: Array<{ id: string; name: string; code: string }>
  plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
}

function monthsInclusiveRange(fromYm: string, toYm: string): string[] {
  let a = fromYm.slice(0, 7)
  let b = toYm.slice(0, 7)
  if (a > b) [a, b] = [b, a]
  const out: string[] = []
  let cur = a
  for (let i = 0; i < 120; i++) {
    out.push(cur)
    if (cur === b) break
    cur = shiftMonthString(cur, 1)
  }
  return out
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

export function CostAnalysisDashboard() {
  const { toast } = useToast()
  const ytd = computePresetRange('ytd')

  const [preset, setPreset] = useState<RangePreset>('ytd')
  const [monthFrom, setMonthFrom] = useState(ytd.from)
  const [monthTo, setMonthTo] = useState(ytd.to)
  const [businessUnitId, setBusinessUnitId] = useState<string>('')
  const [plantId, setPlantId] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('absolute')
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  const { data, loading, error, load } = useCostAnalysisData()

  const months = useMemo(() => monthsInclusiveRange(monthFrom, monthTo), [monthFrom, monthTo])

  // Apply preset whenever it changes (non-custom)
  useEffect(() => {
    if (preset === 'custom') return
    const r = computePresetRange(preset)
    setMonthFrom(r.from)
    setMonthTo(r.to)
  }, [preset])

  const refreshFilters = useCallback(async () => {
    try {
      const r = await fetch('/api/reports/gerencial/ingresos-gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthTo, skipPreviousMonth: true }),
      })
      const j = await r.json()
      if (r.ok && j.filters) setFilterOptions(j.filters as FilterOptions)
    } catch {
      /* ignore */
    }
  }, [monthTo])

  useEffect(() => {
    void refreshFilters()
  }, [refreshFilters])

  const runLoad = useCallback(() => {
    if (months.length === 0) {
      toast({ variant: 'destructive', title: 'Rango inválido', description: 'Seleccione mes desde / hasta.' })
      return
    }
    void load({
      months,
      businessUnitId: businessUnitId || null,
      plantId: plantId || null,
    })
  }, [load, months, businessUnitId, plantId, toast])

  useEffect(() => {
    runLoad()
  }, [runLoad])

  const showLoadingShell = loading && !data

  return (
    <div className="space-y-8">
      <FilterBar
        monthFrom={monthFrom}
        monthTo={monthTo}
        onMonthFromChange={setMonthFrom}
        onMonthToChange={setMonthTo}
        preset={preset}
        onPresetChange={setPreset}
        businessUnitId={businessUnitId}
        onBusinessUnitChange={setBusinessUnitId}
        plantId={plantId}
        onPlantChange={setPlantId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterOptions={filterOptions}
        loading={loading}
        onRefresh={runLoad}
      />

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
        <>
          {/* §2 Command Center */}
          <section className="space-y-3">
            <CommandCenter data={data} viewMode={viewMode} />
          </section>

          {/* §3 Ingresos */}
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
                  <RevenueCompositionChart data={data} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Precio vs volumen</CardTitle>
                  <CardDescription className="text-xs">Precio unitario y m³ entregados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <PriceVolumeChart data={data} />
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de plantas · ingresos</CardTitle>
                <CardDescription className="text-xs">Ordenado por ventas del último mes, con variación vs mes anterior.</CardDescription>
              </CardHeader>
              <CardContent>
                <PlantRevenueRanking data={data} />
              </CardContent>
            </Card>
          </section>

          {/* §4 Estructura de costos */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Gastos"
              title="Estructura de costos"
              description="Composición y evolución de cada componente del costo."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Costos por mes</CardTitle>
                  <CardDescription className="text-xs">Materia prima + operativos por categoría.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CostStackChart data={data} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Costo unitario ($ / m³)</CardTitle>
                  <CardDescription className="text-xs">Economía por m³ de cada componente.</CardDescription>
                </CardHeader>
                <CardContent>
                  <UnitCostChart data={data} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gasto indirecto · explorador</CardTitle>
                <CardDescription className="text-xs">Seleccione una categoría para ver su tendencia y subcategorías.</CardDescription>
              </CardHeader>
              <CardContent>
                <IndirectExplorer data={data} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nómina · explorador por departamento</CardTitle>
                <CardDescription className="text-xs">Departamentos ordenados por nómina del último mes.</CardDescription>
              </CardHeader>
              <CardContent>
                <NominaExplorer data={data} />
              </CardContent>
            </Card>
          </section>

          {/* §5 Rentabilidad */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Rentabilidad"
              title="De ventas a EBITDA"
              description="Cómo se convierte cada peso de ventas en margen operativo."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cascada del EBITDA</CardTitle>
                  <CardDescription className="text-xs">Mes actual. Cada deducción y adición al resultado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <EbitdaWaterfall data={data} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Escalera de márgenes</CardTitle>
                  <CardDescription className="text-xs">Spread vs EBITDA como % de ventas, por mes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarginLadderChart data={data} />
                </CardContent>
              </Card>
            </div>
          </section>

          {/* §6 Plant Matrix */}
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Investigación"
              title="Matriz de plantas"
              description="Cada planta, cada métrica. Click en una fila para abrir su P&L."
            />
            <PlantMatrix data={data} />
          </section>

          {/* Reconciliation footer */}
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
        </>
      )}

      {data && data.months.length === 0 && !loading && (
        <div className="callout-attention">
          <p className="text-sm">No hay meses en el rango seleccionado.</p>
        </div>
      )}
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
