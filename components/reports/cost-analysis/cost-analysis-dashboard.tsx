'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, RefreshCw } from 'lucide-react'
import { shiftMonthString } from '@/lib/reports/month-utils'
import { useCostAnalysisData } from './hooks/use-cost-analysis-data'
import { CostKpiCards } from './cost-kpi-cards'
import { MonthTrendChart } from './month-trend-chart'
import { CategoryBreakdownChart } from './category-breakdown-chart'
import { CategoryDetailTable } from './category-detail-table'
import { DepartmentDistribution } from './department-distribution'
import { PlantComparisonTable } from './plant-comparison-table'
import { useToast } from '@/hooks/use-toast'

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

type FilterOptions = {
  businessUnits: Array<{ id: string; name: string; code: string }>
  plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
}

export function CostAnalysisDashboard() {
  const { toast } = useToast()
  const now = new Date()
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const defaultFrom = shiftMonthString(defaultTo, -5)

  const [monthFrom, setMonthFrom] = useState(defaultFrom)
  const [monthTo, setMonthTo] = useState(defaultTo)
  const [businessUnitId, setBusinessUnitId] = useState<string>('')
  const [plantId, setPlantId] = useState<string>('')
  const [perM3, setPerM3] = useState(false)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  const { data, loading, error, load } = useCostAnalysisData()

  const months = useMemo(() => monthsInclusiveRange(monthFrom, monthTo), [monthFrom, monthTo])

  const refreshFilters = useCallback(async () => {
    try {
      const r = await fetch('/api/reports/gerencial/ingresos-gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: monthTo,
          skipPreviousMonth: true,
        }),
      })
      const j = await r.json()
      if (r.ok && j.filters) {
        setFilterOptions(j.filters as FilterOptions)
      }
    } catch {
      /* ignore */
    }
  }, [monthTo])

  useEffect(() => {
    void refreshFilters()
  }, [refreshFilters])

  const availablePlants =
    filterOptions?.plants.filter(p => !businessUnitId || p.business_unit_id === businessUnitId) || []

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

  return (
    <div className="space-y-10">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Rango de meses, unidad de negocio y planta (mismos criterios que Ingresos vs Gastos).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="from">Desde</Label>
              <Input id="from" type="month" value={monthFrom} onChange={e => setMonthFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" type="month" value={monthTo} onChange={e => setMonthTo(e.target.value)} />
            </div>
            <div>
              <Label>Unidad de negocio</Label>
              <Select
                value={businessUnitId || 'all'}
                onValueChange={v => {
                  setBusinessUnitId(v === 'all' ? '' : v)
                  setPlantId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {(filterOptions?.businessUnits || []).map(bu => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Planta</Label>
              <Select value={plantId || 'all'} onValueChange={v => setPlantId(v === 'all' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {availablePlants.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Switch id="perm3" checked={perM3} onCheckedChange={setPerM3} />
              <Label htmlFor="perm3" className="cursor-pointer">
                Ver unitarios (/ m³)
              </Label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runLoad} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar análisis
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {data && data.months.length > 0 && (
        <>
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Resumen</h2>
            <CostKpiCards data={data} perM3={perM3} />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Evolución de costos</h2>
            <Card>
              <CardContent className="pt-6">
                <MonthTrendChart data={data} perM3={perM3} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Gastos indirectos por categoría</h2>
            <p className="text-sm text-muted-foreground">
              Montos por clasificación de costos manuales (puede excluir autoconsumo del cotizador, que no tiene categoría
              aquí).
            </p>
            <Card>
              <CardContent className="pt-6">
                <CategoryBreakdownChart data={data} onCategoryClick={id => setExpandedCategoryId(id)} />
              </CardContent>
            </Card>
            <CategoryDetailTable
              data={data}
              expandedCategoryId={expandedCategoryId}
              onExpandedCategoryId={setExpandedCategoryId}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Nómina por departamento</h2>
            <Card>
              <CardContent className="pt-6">
                <DepartmentDistribution data={data} />
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">Comparativo por planta</h2>
            <Card>
              <CardContent className="pt-6">
                <PlantComparisonTable data={data} />
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {data && data.months.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">No hay meses en el rango seleccionado.</p>
      )}
    </div>
  )
}
