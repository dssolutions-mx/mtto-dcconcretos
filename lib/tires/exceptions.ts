import { computeCostPerKm, computeTireTotalCost } from '@/lib/tires/cost-report'
import {
  DEFAULT_MIN_TREAD_MM,
  isPressureOutOfRange,
  isTreadLow,
  resolvePressureRange,
} from '@/lib/tires/positions'
import type {
  AssetTireInstallation,
  Tire,
  TireEvent,
  TireReading,
  TireThresholds,
} from '@/types/tires'

export type TireExceptionPriority = 'P1' | 'P2' | 'P3'

export type TireExceptionType =
  | 'tread_critical'
  | 'pressure_critical'
  | 'no_reading'
  | 'incomplete_coverage'
  | 'no_layout'
  | 'anomalous_cost'

export interface TireException {
  id: string
  priority: TireExceptionPriority
  type: TireExceptionType
  title: string
  description: string
  suggested_action: string
  asset_id?: string
  asset_name?: string
  asset_code?: string | null
  tire_id?: string
  installation_id?: string
  position_code?: string
  position_label?: string
  tread_mm?: number | null
  min_tread_mm?: number
  pressure_psi?: number | null
  days_since_reading?: number
  coverage_pct?: number
  reading_at?: string | null
  cost_per_km?: number | null
}

export interface TireExceptionCounts {
  P1: number
  P2: number
  P3: number
  total: number
}

export const EXCEPTION_PRIORITY_ORDER: Record<TireExceptionPriority, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
}

export const DEFAULT_DAYS_WITHOUT_READING = 14

export const EXCEPTION_TYPE_LABELS: Record<TireExceptionType, string> = {
  tread_critical: 'Banda crítica',
  pressure_critical: 'Presión crítica',
  no_reading: 'Sin lectura',
  incomplete_coverage: 'Cobertura incompleta',
  no_layout: 'Sin layout',
  anomalous_cost: 'Costo anómalo',
}

export function resolveThresholds(thresholds?: TireThresholds): {
  daysWithoutReading: number
  defaultMinTreadMm: number
  pressureMinPsi: number
  pressureMaxPsi: number
} {
  const pressure = resolvePressureRange(thresholds)
  return {
    daysWithoutReading: thresholds?.days_without_reading ?? DEFAULT_DAYS_WITHOUT_READING,
    defaultMinTreadMm: thresholds?.min_tread_mm ?? DEFAULT_MIN_TREAD_MM,
    pressureMinPsi: pressure.min,
    pressureMaxPsi: pressure.max,
  }
}

export function daysSinceDate(isoDate: string | null | undefined, now = new Date()): number | null {
  if (!isoDate) return null
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return null
  const diffMs = now.getTime() - then.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

export function isReadingStale(
  daysSince: number | null,
  thresholdDays = DEFAULT_DAYS_WITHOUT_READING
): boolean {
  if (daysSince == null) return true
  return daysSince > thresholdDays
}

export function buildExceptionId(parts: {
  type: TireExceptionType
  asset_id?: string
  tire_id?: string
  position_code?: string
}): string {
  return [parts.type, parts.asset_id ?? '', parts.tire_id ?? '', parts.position_code ?? ''].join(':')
}

export function detectInstallationExceptions(input: {
  installation: AssetTireInstallation & { latest_reading?: TireReading | null }
  asset_name: string
  asset_code?: string | null
  thresholds?: TireThresholds
  now?: Date
}): TireException[] {
  const { installation, asset_name, asset_code, thresholds, now } = input
  const tire = installation.tire
  if (!tire) return []

  const { daysWithoutReading, defaultMinTreadMm } = resolveThresholds(thresholds)
  const minTread = tire.min_tread_mm ?? defaultMinTreadMm
  const reading = installation.latest_reading ?? null
  const exceptions: TireException[] = []

  const base = {
    asset_id: installation.asset_id,
    asset_name,
    asset_code: asset_code ?? null,
    tire_id: installation.tire_id,
    installation_id: installation.id,
    position_code: installation.position_code,
    position_label: installation.position_label,
    reading_at: reading?.read_at ?? null,
  }

  if (isTreadLow(reading?.tread_depth_mm, minTread)) {
    exceptions.push({
      id: buildExceptionId({
        type: 'tread_critical',
        asset_id: installation.asset_id,
        tire_id: installation.tire_id,
        position_code: installation.position_code,
      }),
      priority: 'P1',
      type: 'tread_critical',
      title: `${asset_name} · ${installation.position_label}`,
      description: `Banda ${reading?.tread_depth_mm ?? '—'} mm (mín. ${minTread})`,
      suggested_action: 'Programar cambio',
      tread_mm: reading?.tread_depth_mm ?? null,
      min_tread_mm: minTread,
      ...base,
    })
  }

  if (isPressureOutOfRange(reading?.pressure_psi, thresholds)) {
    const { pressureMinPsi, pressureMaxPsi } = resolveThresholds(thresholds)
    exceptions.push({
      id: buildExceptionId({
        type: 'pressure_critical',
        asset_id: installation.asset_id,
        tire_id: installation.tire_id,
        position_code: installation.position_code,
      }),
      priority: 'P1',
      type: 'pressure_critical',
      title: `${asset_name} · ${installation.position_label}`,
      description: `Presión ${reading?.pressure_psi ?? '—'} psi fuera de rango (${pressureMinPsi}–${pressureMaxPsi})`,
      suggested_action: 'Verificar / ajustar',
      pressure_psi: reading?.pressure_psi ?? null,
      ...base,
    })
  }

  const daysSince = daysSinceDate(reading?.read_at ?? installation.installed_at, now)
  if (isReadingStale(daysSince, daysWithoutReading)) {
    exceptions.push({
      id: buildExceptionId({
        type: 'no_reading',
        asset_id: installation.asset_id,
        tire_id: installation.tire_id,
        position_code: installation.position_code,
      }),
      priority: 'P2',
      type: 'no_reading',
      title: `${asset_name} · ${installation.position_label}`,
      description:
        daysSince == null
          ? 'Sin lecturas registradas en posición montada'
          : `Sin lectura hace ${daysSince} días (umbral ${daysWithoutReading})`,
      suggested_action: 'Solicitar checklist',
      days_since_reading: daysSince ?? undefined,
      ...base,
    })
  }

  return exceptions
}

export function detectCoverageExceptions(input: {
  asset_id: string
  asset_name: string
  asset_code?: string | null
  has_model: boolean
  has_layout: boolean
  mounted_count: number
  total_positions: number
}): TireException[] {
  const {
    asset_id,
    asset_name,
    asset_code,
    has_model,
    has_layout,
    mounted_count,
    total_positions,
  } = input

  if (!has_model || !has_layout) {
    return [
      {
        id: buildExceptionId({ type: 'no_layout', asset_id }),
        priority: 'P2',
        type: 'no_layout',
        title: asset_name,
        description: 'Activo sin layout de llantas definido',
        suggested_action: 'Asignar layout',
        asset_id,
        asset_name,
        asset_code: asset_code ?? null,
      },
    ]
  }

  if (total_positions <= 0) return []

  const pct = Math.round((mounted_count / total_positions) * 100)
  if (mounted_count >= total_positions) return []

  return [
    {
      id: buildExceptionId({ type: 'incomplete_coverage', asset_id }),
      priority: 'P2',
      type: 'incomplete_coverage',
      title: asset_name,
      description: `${mounted_count} de ${total_positions} posiciones ocupadas (${pct}%)`,
      suggested_action: 'Completar montaje',
      asset_id,
      asset_name,
      asset_code: asset_code ?? null,
      coverage_pct: pct,
    },
  ]
}

export function computeCostPerKmPercentile90(values: number[]): number | null {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const index = Math.ceil(sorted.length * 0.9) - 1
  return sorted[Math.max(0, index)]
}

export function detectAnomalousCostExceptions(input: {
  tire: Tire
  events: TireEvent[]
  km_traveled: number | null
  asset_name: string | null
  fleetCostPerKmValues: number[]
}): TireException[] {
  const totalCost = computeTireTotalCost(input.tire, input.events)
  const costPerKm = computeCostPerKm(totalCost, input.km_traveled)
  if (costPerKm == null) return []

  const p90 = computeCostPerKmPercentile90(input.fleetCostPerKmValues)
  if (p90 == null || costPerKm <= p90) return []

  return [
    {
      id: buildExceptionId({ type: 'anomalous_cost', tire_id: input.tire.id }),
      priority: 'P3',
      type: 'anomalous_cost',
      title: `${input.tire.brand} ${input.tire.size}`,
      description: `$${costPerKm.toFixed(2)}/km supera percentil 90 de flota ($${p90.toFixed(2)}/km)`,
      suggested_action: 'Revisar llanta',
      tire_id: input.tire.id,
      asset_name: input.asset_name ?? undefined,
      cost_per_km: costPerKm,
    },
  ]
}

export function sortTireExceptions(exceptions: TireException[]): TireException[] {
  return [...exceptions].sort((a, b) => {
    const priorityDiff =
      EXCEPTION_PRIORITY_ORDER[a.priority] - EXCEPTION_PRIORITY_ORDER[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return a.title.localeCompare(b.title, 'es')
  })
}

export function countExceptionsByPriority(exceptions: TireException[]): TireExceptionCounts {
  const counts: TireExceptionCounts = { P1: 0, P2: 0, P3: 0, total: exceptions.length }
  for (const ex of exceptions) {
    counts[ex.priority] += 1
  }
  return counts
}

export function aggregateTireExceptions(parts: TireException[][]): TireException[] {
  const merged = parts.flat()
  const byId = new Map<string, TireException>()
  for (const ex of merged) {
    byId.set(ex.id, ex)
  }
  return sortTireExceptions([...byId.values()])
}
