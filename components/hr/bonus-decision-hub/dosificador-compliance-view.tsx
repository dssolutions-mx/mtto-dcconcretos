'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChecklistDosificadorViewPayload } from '@/types/checklist-dosificador-view'
import type { BonusDecisionSummaryPayload } from '@/types/bonus-decision-hub'
import type { BonusHubFilters } from './bonus-decision-hub'
import { RhReportError, RhReportLoading } from '@/components/hr/reports/rh-report-states'
import { RhReportPanel } from '@/components/hr/reports/rh-report-panel'

type DosificadorComplianceViewProps = {
  filters: BonusHubFilters
}

type DayCell = {
  dayKey: string
  hadProduction: boolean
  controlRegistered: boolean
}

type DosificadorComplianceData = {
  dosificadorData: ChecklistDosificadorViewPayload
  summary: BonusDecisionSummaryPayload
  productionDaysByPlant: Map<string, Set<string>>
}

function monthDateKeys(year: number, month: number): { from: string; to: string; days: string[] } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const days: string[] = []
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return {
    from: days[0],
    to: days[days.length - 1],
    days,
  }
}

function dayOfMonth(dayKey: string): number {
  return parseInt(dayKey.split('-')[2], 10)
}

export function DosificadorComplianceView({ filters }: DosificadorComplianceViewProps) {
  const [dosificadorData, setDosificadorData] = useState<ChecklistDosificadorViewPayload | null>(null)
  const [summary, setSummary] = useState<BonusDecisionSummaryPayload | null>(null)
  const [productionDaysByPlant, setProductionDaysByPlant] = useState<Map<string, Set<string>>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const periodDays = useMemo(
    () => monthDateKeys(filters.year, filters.month),
    [filters.year, filters.month]
  )

  const fetchComplianceData = useCallback(async (): Promise<DosificadorComplianceData> => {
    const params = new URLSearchParams({
      from: periodDays.from,
      to: periodDays.to,
      year: String(filters.year),
      month: String(filters.month),
    })
    if (filters.businessUnit !== 'all') params.set('business_unit', filters.businessUnit)
    if (filters.plant !== 'all') params.set('plant', filters.plant)

    const summaryParams = new URLSearchParams({
      year: String(filters.year),
      month: String(filters.month),
    })
    if (filters.businessUnit !== 'all') summaryParams.set('business_unit', filters.businessUnit)
    if (filters.plant !== 'all') summaryParams.set('plant', filters.plant)

    const [dosRes, summaryRes, punctRes] = await Promise.all([
      fetch(`/api/hr/checklist-dosificador-view?${params}`),
      fetch(`/api/hr/bonus-decision-summary?${summaryParams}`),
      fetch(`/api/hr/punctuality-reports?${summaryParams}`),
    ])

    if (!dosRes.ok) throw new Error('Error al cargar control dosificador')
    if (!summaryRes.ok) throw new Error('Error al cargar cierres')

    const dosificadorData = (await dosRes.json()) as ChecklistDosificadorViewPayload
    const summary = (await summaryRes.json()) as BonusDecisionSummaryPayload

    const productionDaysByPlant = new Map<string, Set<string>>()
    if (punctRes.ok) {
      const punctData = await punctRes.json()
      for (const op of punctData.operators ?? []) {
        const set = productionDaysByPlant.get(op.plant_id) ?? new Set<string>()
        for (const day of op.days ?? []) {
          set.add(day.event_date)
        }
        productionDaysByPlant.set(op.plant_id, set)
      }
    }

    return { dosificadorData, summary, productionDaysByPlant }
  }, [filters, periodDays])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchComplianceData()
        if (!cancelled) {
          setDosificadorData(result.dosificadorData)
          setSummary(result.summary)
          setProductionDaysByPlant(result.productionDaysByPlant)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[dosificador-compliance]', err)
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setDosificadorData(null)
          setSummary(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [fetchComplianceData, reloadToken])

  const plantHeatmaps = useMemo(() => {
    if (!dosificadorData) return []

    return dosificadorData.plants.map((plant) => {
      const controlByDay = new Map<string, boolean>()
      for (const day of plant.days) {
        const completed = day.summary.completed > 0
        controlByDay.set(day.dayKey, completed)
      }

      const productionDays = productionDaysByPlant.get(plant.plantId) ?? new Set<string>()

      const cells: DayCell[] = periodDays.days.map((dayKey) => ({
        dayKey,
        hadProduction: productionDays.has(dayKey),
        controlRegistered: controlByDay.get(dayKey) ?? false,
      }))

      return {
        plantId: plant.plantId,
        plantName: plant.plantName,
        businessUnitName: plant.businessUnitName,
        cells,
      }
    })
  }, [dosificadorData, productionDaysByPlant, periodDays.days])

  const closureByPlant = useMemo(() => {
    const map = new Map<
      string,
      { total: number; completed: number; eligible: number }
    >()
    for (const row of summary?.rows ?? []) {
      const bucket = map.get(row.plant_id) ?? { total: 0, completed: 0, eligible: 0 }
      bucket.total += 1
      if (row.closure_official != null) bucket.completed += 1
      if (row.closure_official === true) bucket.eligible += 1
      map.set(row.plant_id, bucket)
    }
    return map
  }, [summary])


  return (
    <div className="space-y-4">
      {error ? (
        <RhReportError message={error} onRetry={() => setReloadToken((token) => token + 1)} />
      ) : null}

      {loading ? (
        <RhReportLoading rows={4} />
      ) : (
        <>
          <RhReportPanel
            title="Cierre mensual por planta"
            description="Operadores con decisión de cierre registrada por el dosificador."
            count={plantHeatmaps.length}
          >
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
              {plantHeatmaps.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full">
                  Sin plantas en el filtro seleccionado.
                </p>
              ) : (
                plantHeatmaps.map((plant) => {
                  const closure = closureByPlant.get(plant.plantId)
                  const completed = closure?.completed ?? 0
                  const total = closure?.total ?? 0
                  const eligible = closure?.eligible ?? 0
                  const isComplete = total > 0 && completed === total

                  return (
                    <div key={plant.plantId} className="rounded-lg border p-4 space-y-2">
                      <p className="font-semibold">{plant.plantName}</p>
                      <p className="text-xs text-muted-foreground">{plant.businessUnitName}</p>
                      <Badge variant={isComplete ? 'default' : 'secondary'}>
                        {isComplete ? 'Cierre completo' : 'Cierre pendiente'}
                      </Badge>
                      <p className="text-sm">
                        {completed}/{total} operadores con cierre · {eligible} aptos
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </RhReportPanel>

          {plantHeatmaps.map((plant) => (
            <RhReportPanel
              key={plant.plantId}
              title={`${plant.plantName} — calendario`}
              description="Verde: producción con control · Amarillo: producción sin control · Gris: sin producción"
            >
              <div className="grid grid-cols-7 gap-1 p-4 sm:gap-2 sm:p-5">
                  {plant.cells.map((cell) => {
                    let tone = 'bg-muted/40 text-muted-foreground'
                    if (cell.hadProduction && cell.controlRegistered) {
                      tone = 'bg-green-100 text-green-900 border-green-200'
                    } else if (cell.hadProduction && !cell.controlRegistered) {
                      tone = 'bg-yellow-100 text-yellow-900 border-yellow-200'
                    }

                    return (
                      <div
                        key={cell.dayKey}
                        title={`${cell.dayKey}: producción ${cell.hadProduction ? 'sí' : 'no'}, control ${cell.controlRegistered ? 'sí' : 'no'}`}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-md border text-xs font-medium',
                          tone
                        )}
                      >
                        {dayOfMonth(cell.dayKey)}
                      </div>
                    )
                  })}
                </div>
            </RhReportPanel>
          ))}
        </>
      )}
    </div>
  )
}
