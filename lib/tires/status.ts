import { isPressureOutOfRange, isTreadLow, resolveMinTreadMm, resolvePressureRange } from '@/lib/tires/positions'
import type { AssetTireInstallation, TireThresholds } from '@/types/tires'

/**
 * Shared tire health status — the single source of truth for status colors,
 * labels and severity across the whole module (diagram, badges, exceptions,
 * KPIs, position map/sheet). Keeping every surface aligned to this map is what
 * makes the module feel cohesive and "premium".
 *
 * Note: `getPositionVisualState` in diagram-geometry.ts keeps its original
 * 3-state contract (empty/ok/alert) for backwards compatibility + unit tests.
 * This richer 5-state model is layered on top for presentation.
 */
export type TireHealthStatus = 'empty' | 'ok' | 'warning' | 'critical' | 'no-reading'

export interface TireStatusVisual {
  /** Saturated color (borders, icons, emphasis text) as a CSS color string. */
  stroke: string
  /** Muted surface color as a CSS color string. */
  fill: string
  /** Spanish short label. */
  label: string
  /** shadcn Badge variant best matching this status. */
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  /** Tailwind classes for a soft status badge/pill (text + bg + border). */
  badgeClass: string
  /** Tailwind text color class. */
  textClass: string
  /** Tailwind border color class (e.g. for left-accent rows / cards). */
  borderClass: string
  /** Dotted outline in the diagram (only the empty state). */
  dashed?: boolean
}

/** Days without a reading before a mounted tire is flagged as stale. */
export const DEFAULT_DAYS_WITHOUT_READING = 14

/** mm above the minimum tread within which a tire is "warning" (banda baja). */
export const TREAD_WARNING_MARGIN_MM = 2

export const TIRE_STATUS_VISUALS: Record<TireHealthStatus, TireStatusVisual> = {
  empty: {
    stroke: 'hsl(var(--tire-empty))',
    fill: 'hsl(var(--tire-empty-fill))',
    label: 'Vacío',
    badgeVariant: 'outline',
    badgeClass:
      'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
    textClass: 'text-slate-500 dark:text-slate-400',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dashed: true,
  },
  ok: {
    stroke: 'hsl(var(--tire-ok))',
    fill: 'hsl(var(--tire-ok-fill))',
    label: 'OK',
    badgeVariant: 'secondary',
    badgeClass:
      'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-500/60',
  },
  warning: {
    stroke: 'hsl(var(--tire-warning))',
    fill: 'hsl(var(--tire-warning-fill))',
    label: 'Banda baja',
    badgeVariant: 'default',
    badgeClass:
      'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-500/70',
  },
  critical: {
    stroke: 'hsl(var(--tire-critical))',
    fill: 'hsl(var(--tire-critical-fill))',
    label: 'Crítica',
    badgeVariant: 'destructive',
    badgeClass:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300',
    textClass: 'text-red-700 dark:text-red-400',
    borderClass: 'border-red-500/70',
  },
  'no-reading': {
    stroke: 'hsl(var(--tire-noreading))',
    fill: 'hsl(var(--tire-noreading-fill))',
    label: 'Sin lectura',
    badgeVariant: 'outline',
    badgeClass:
      'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
    textClass: 'text-slate-500 dark:text-slate-400',
    borderClass: 'border-slate-400/60',
  },
}

/** Ordered list for legends (most → least severe relevant for ops). */
export const TIRE_STATUS_LEGEND: TireHealthStatus[] = [
  'ok',
  'warning',
  'critical',
  'no-reading',
  'empty',
]

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / (1000 * 60 * 60 * 24)
}

/**
 * Compute the rich health status of a mounted position.
 * - empty: no tire mounted
 * - critical: tread at/below the minimum (must replace)
 * - warning: tread approaching minimum, or pressure out of range
 * - no-reading: mounted but never read / reading older than the staleness window
 * - ok: mounted, recent reading, within tolerances
 */
export function getTireHealthStatus(
  installation: AssetTireInstallation | undefined | null,
  thresholds?: TireThresholds
): TireHealthStatus {
  if (!installation?.tire) return 'empty'

  const reading = installation.latest_reading
  const tread = reading?.tread_depth_mm
  const pressure = reading?.pressure_psi

  if (tread == null && pressure == null) return 'no-reading'

  const staleDays = thresholds?.days_without_reading ?? DEFAULT_DAYS_WITHOUT_READING
  const age = daysSince(reading?.read_at)
  if (age != null && age > staleDays && tread == null) return 'no-reading'

  const minTread = resolveMinTreadMm(installation.tire.min_tread_mm, thresholds)

  if (isTreadLow(tread, minTread)) return 'critical'

  const pressureBad = isPressureOutOfRange(pressure, thresholds)
  const treadWarn = tread != null && tread <= minTread + TREAD_WARNING_MARGIN_MM
  if (treadWarn || pressureBad) return 'warning'

  if (age != null && age > staleDays) return 'no-reading'

  return 'ok'
}

/** Healthy reference tread used to scale mini tread gauges (mm). */
export const HEALTHY_TREAD_MM = 18

/** 0..1 fraction of tread remaining vs a healthy reference, for mini gauges. */
export function treadFraction(treadMm: number | null | undefined): number | null {
  if (treadMm == null) return null
  return Math.max(0, Math.min(1, treadMm / HEALTHY_TREAD_MM))
}

/** Human-readable status detail line for a position (used in tooltips/sheets). */
export function getTireStatusDetail(
  installation: AssetTireInstallation | undefined | null,
  thresholds?: TireThresholds
): string {
  const status = getTireHealthStatus(installation, thresholds)
  if (status === 'empty') return 'Posición vacía'
  const reading = installation?.latest_reading
  const tread = reading?.tread_depth_mm
  const pressure = reading?.pressure_psi
  if (status === 'no-reading') return 'Montada · sin lectura reciente'
  const range = resolvePressureRange(thresholds)
  const parts: string[] = []
  if (tread != null) parts.push(`${tread} mm`)
  if (pressure != null) {
    const out = isPressureOutOfRange(pressure, thresholds)
    parts.push(`${pressure} psi${out ? ` (fuera de ${range.min}–${range.max})` : ''}`)
  } else if (installation?.needs_pressure_reading) {
    parts.push('presión pendiente')
  }
  return parts.join(' · ') || TIRE_STATUS_VISUALS[status].label
}
