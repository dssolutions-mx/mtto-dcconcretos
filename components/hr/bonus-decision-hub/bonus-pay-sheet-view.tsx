'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Eye, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
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
import type { BonusDecisionSummaryPayload } from '@/types/bonus-decision-hub'
import type { BonusHubFilters } from '@/components/hr/bonus-decision-hub/bonus-decision-hub'
import {
  ClosureBadge,
  formatPct,
  RecommendationBadge,
  TrafficLightBadge,
} from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import { RhReportMetricStrip } from '@/components/hr/reports/rh-report-metric-strip'
import { RhReportPanel } from '@/components/hr/reports/rh-report-panel'
import { RhReportEmpty, RhReportError, RhReportLoading } from '@/components/hr/reports/rh-report-states'

type BonusPaySheetViewProps = {
  filters: BonusHubFilters
  onDrillDown: (operatorId: string) => void
}

export function BonusPaySheetView({ filters, onDrillDown }: BonusPaySheetViewProps) {
  const [data, setData] = useState<BonusDecisionSummaryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({
      year: String(filters.year),
      month: String(filters.month),
    })
    if (filters.businessUnit !== 'all') params.set('business_unit', filters.businessUnit)
    if (filters.plant !== 'all') params.set('plant', filters.plant)

    const response = await fetch(`/api/hr/bonus-decision-summary?${params}`)
    if (!response.ok) throw new Error('Error al cargar la nómina de bonos')
    return (await response.json()) as BonusDecisionSummaryPayload
  }, [filters])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchData()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          console.error('[bonus-pay-sheet]', err)
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
  }, [fetchData, reloadToken])

  const handleExport = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams({
        year: String(filters.year),
        month: String(filters.month),
      })
      if (filters.businessUnit !== 'all') params.set('business_unit', filters.businessUnit)
      if (filters.plant !== 'all') params.set('plant', filters.plant)

      const response = await fetch(`/api/hr/bonus-decision-export?${params}`)
      if (!response.ok) throw new Error('Error al exportar')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `nomina-bonos-${filters.year}-${String(filters.month).padStart(2, '0')}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[bonus-pay-sheet] export', err)
      setError(err instanceof Error ? err.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const metrics = useMemo(() => {
    if (!data) return []
    const { summary } = data
    return [
      {
        id: 'operators',
        label: 'Operadores',
        value: String(summary.total_operators),
        hint: 'En planta(s) seleccionada(s)',
        icon: Users,
      },
      {
        id: 'closures',
        label: 'Cierres registrados',
        value: String(summary.closure_completed),
        hint: `${summary.closure_eligible} aptos por dosificador`,
        icon: Users,
        accent:
          summary.closure_completed > 0 && summary.closure_eligible === summary.closure_completed
            ? 'positive'
            : summary.closure_completed > 0
              ? 'warning'
              : 'default',
      } as const,
      {
        id: 'punctuality',
        label: 'Puntualidad promedio',
        value: formatPct(summary.avg_punctuality_pct),
        hint: 'Media entre operadores con registro',
        accent:
          summary.avg_punctuality_pct != null && summary.avg_punctuality_pct >= 85
            ? 'positive'
            : summary.avg_punctuality_pct != null && summary.avg_punctuality_pct < 70
              ? 'negative'
              : 'warning',
      } as const,
      {
        id: 'cleanliness',
        label: 'Limpieza promedio',
        value: formatPct(summary.avg_cleanliness_pass_rate),
        hint: 'Umbral de cierre: 80%',
        accent:
          summary.avg_cleanliness_pass_rate != null && summary.avg_cleanliness_pass_rate >= 80
            ? 'positive'
            : summary.avg_cleanliness_pass_rate != null && summary.avg_cleanliness_pass_rate < 60
              ? 'negative'
              : 'warning',
      } as const,
    ]
  }, [data])

  const punctualityHref = `/rh/puntualidad?year=${filters.year}&month=${filters.month}${
    filters.plant !== 'all' ? `&plant=${filters.plant}` : ''
  }`
  const cleanlinessHref = `/rh/limpieza?year=${filters.year}&month=${filters.month}${
    filters.plant !== 'all' ? `&plant=${filters.plant}` : ''
  }`

  return (
    <div className="space-y-4">
      {error ? (
        <RhReportError message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : null}

      {!loading && !error && data ? <RhReportMetricStrip metrics={metrics} /> : null}

      <RhReportPanel
        title="Nómina de bonos"
        description="Estado del mes por operador — decisión de elegibilidad y semáforo de riesgo."
        count={data?.rows.length}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExport()}
            disabled={exporting || loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        }
      >
        {loading ? (
          <RhReportLoading rows={6} />
        ) : !data || data.rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <RhReportEmpty
              title="Sin operadores en el periodo"
              description="No hay operadores de planta ni evaluaciones para los filtros seleccionados. Verifica planta/mes o que el dosificador haya registrado puntualidad y cierre."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Operador</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead className="text-right tabular-nums">% Puntualidad</TableHead>
                  <TableHead className="text-right tabular-nums">% Limpieza</TableHead>
                  <TableHead>Cierre oficial</TableHead>
                  <TableHead>Recomendación</TableHead>
                  <TableHead>Semáforo</TableHead>
                  <TableHead className="text-right">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.operator_id}>
                    <TableCell className="font-medium">{row.operator_name}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.employee_code ?? '—'}
                    </TableCell>
                    <TableCell>{row.plant_name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPct(row.punctuality_pct)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPct(row.cleanliness_pass_rate)}
                    </TableCell>
                    <TableCell>
                      <ClosureBadge value={row.closure_official} />
                    </TableCell>
                    <TableCell>
                      <RecommendationBadge recommendation={row.system_recommendation} />
                    </TableCell>
                    <TableCell>
                      <TrafficLightBadge light={row.traffic_light} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Ver</span>
                          </Button>
                        </SheetTrigger>
                        <SheetContent className="overflow-y-auto sm:max-w-md">
                          <SheetHeader>
                            <SheetTitle>{row.operator_name}</SheetTitle>
                          </SheetHeader>
                          <div className="mt-6 space-y-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Código</span>
                              <span>{row.employee_code ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Planta</span>
                              <span>{row.plant_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Puntualidad</span>
                              <span>
                                {formatPct(row.punctuality_pct)} ({row.punctuality_days_on_time}/
                                {row.punctuality_days_total} días)
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Limpieza</span>
                              <span>
                                {formatPct(row.cleanliness_pass_rate)} ({row.cleanliness_evals_passed}/
                                {row.cleanliness_evals_total} eval.)
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Cierre oficial</span>
                              <ClosureBadge value={row.closure_official} />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Semáforo</span>
                              <TrafficLightBadge light={row.traffic_light} />
                            </div>
                            <div className="grid grid-cols-1 gap-2 pt-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={punctualityHref}>Ver puntualidad del mes</Link>
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <Link href={cleanlinessHref}>Ver limpieza del mes</Link>
                              </Button>
                              <Button className="w-full" onClick={() => onDrillDown(row.operator_id)}>
                                Abrir detalle completo
                              </Button>
                            </div>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </RhReportPanel>
    </div>
  )
}
