import {
  DEFAULT_MIN_TREAD_MM,
  PRESSURE_RANGE_PSI,
  resolveMinTreadMm,
  resolvePressureRange,
} from '@/lib/tires/positions'
import { DEFAULT_DAYS_WITHOUT_READING, TREAD_WARNING_MARGIN_MM } from '@/lib/tires/status'
import type { TireThresholds } from '@/types/tires'

/** One-line Spanish summary of active alert thresholds for UI helper text. */
export function formatThresholdSummary(
  thresholds?: TireThresholds,
  tireMinTreadMm?: number | null
): string {
  const minTread = resolveMinTreadMm(tireMinTreadMm, thresholds)
  const pressure = resolvePressureRange(thresholds)
  const staleDays = thresholds?.days_without_reading ?? DEFAULT_DAYS_WITHOUT_READING
  const warnTread = minTread + TREAD_WARNING_MARGIN_MM
  return (
    `Umbral banda: ${minTread} mm (crítica) · ` +
    `Advertencia ≤ ${warnTread} mm · ` +
    `Presión: ${pressure.min}–${pressure.max} psi · ` +
    `Sin lectura: ${staleDays} días`
  )
}

/** Short defaults note for the settings page. */
export const THRESHOLD_DEFAULTS_NOTE =
  'Valores iniciales basados en práctica TMC / flotas de camión (banda mín. 3 mm, presión 80–120 psi, lectura cada 14 días). ' +
  `La zona «Banda baja» en diagrama y fichas usa ${TREAD_WARNING_MARGIN_MM} mm por encima del mínimo configurado (margen fijo).`

/** Fill missing fleet threshold fields with TMC defaults. */
export function normalizeTireThresholds(thresholds?: TireThresholds): TireThresholds {
  return {
    min_tread_mm: thresholds?.min_tread_mm ?? DEFAULT_MIN_TREAD_MM,
    pressure_min_psi: thresholds?.pressure_min_psi ?? PRESSURE_RANGE_PSI.min,
    pressure_max_psi: thresholds?.pressure_max_psi ?? PRESSURE_RANGE_PSI.max,
    days_without_reading: thresholds?.days_without_reading ?? DEFAULT_DAYS_WITHOUT_READING,
  }
}

/** Returns a Spanish error message, or null when valid. */
export function validateTireThresholds(thresholds: TireThresholds): string | null {
  const { min_tread_mm, pressure_min_psi, pressure_max_psi, days_without_reading } = thresholds

  if (min_tread_mm == null || !Number.isFinite(min_tread_mm) || min_tread_mm <= 0) {
    return 'La banda mínima debe ser un número mayor a 0 mm.'
  }
  if (pressure_min_psi == null || !Number.isFinite(pressure_min_psi) || pressure_min_psi <= 0) {
    return 'La presión mínima debe ser un número mayor a 0 psi.'
  }
  if (pressure_max_psi == null || !Number.isFinite(pressure_max_psi) || pressure_max_psi <= 0) {
    return 'La presión máxima debe ser un número mayor a 0 psi.'
  }
  if (pressure_min_psi >= pressure_max_psi) {
    return 'La presión mínima debe ser menor que la presión máxima.'
  }
  if (
    days_without_reading == null ||
    !Number.isFinite(days_without_reading) ||
    days_without_reading < 1 ||
    !Number.isInteger(days_without_reading)
  ) {
    return 'Los días sin lectura deben ser un entero de al menos 1.'
  }

  return null
}

export { DEFAULT_MIN_TREAD_MM, PRESSURE_RANGE_PSI, DEFAULT_DAYS_WITHOUT_READING, TREAD_WARNING_MARGIN_MM }
