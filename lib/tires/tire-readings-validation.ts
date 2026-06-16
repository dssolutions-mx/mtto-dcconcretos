import type { ChecklistTireReadingInput } from '@/lib/tires/checklist-readings'
import type { TireReadingMode, TireReadingsSectionConfig } from '@/types/tires'

export const DEFAULT_TIRE_READINGS_CONFIG: TireReadingsSectionConfig = {
  reading_mode: 'both',
  measure_tread: true,
  measure_pressure: true,
  require_all_positions: true,
}

export function normalizeTireReadingsConfig(
  config?: Partial<TireReadingsSectionConfig> | null
): TireReadingsSectionConfig {
  const mode = config?.reading_mode ?? DEFAULT_TIRE_READINGS_CONFIG.reading_mode!
  const fromMode = fieldsFromReadingMode(mode)

  return {
    reading_mode: mode,
    measure_tread: config?.measure_tread ?? fromMode.measure_tread,
    measure_pressure: config?.measure_pressure ?? fromMode.measure_pressure,
    require_all_positions:
      config?.require_all_positions ?? DEFAULT_TIRE_READINGS_CONFIG.require_all_positions,
  }
}

export function fieldsFromReadingMode(mode: TireReadingMode): {
  measure_tread: boolean
  measure_pressure: boolean
} {
  switch (mode) {
    case 'psi':
      return { measure_tread: false, measure_pressure: true }
    case 'mm':
      return { measure_tread: true, measure_pressure: false }
    case 'both':
      return { measure_tread: true, measure_pressure: true }
    case 'none':
    default:
      return { measure_tread: false, measure_pressure: false }
  }
}

export function readingModeFromFields(
  measure_tread: boolean,
  measure_pressure: boolean
): TireReadingMode {
  if (measure_tread && measure_pressure) return 'both'
  if (measure_pressure) return 'psi'
  if (measure_tread) return 'mm'
  return 'none'
}

export function isTireReadingFieldRequired(
  config: TireReadingsSectionConfig,
  field: 'tread' | 'pressure'
): boolean {
  const normalized = normalizeTireReadingsConfig(config)
  if (normalized.reading_mode === 'none') return false
  return field === 'tread' ? Boolean(normalized.measure_tread) : Boolean(normalized.measure_pressure)
}

export function isTireReadingComplete(
  reading: ChecklistTireReadingInput,
  config: TireReadingsSectionConfig
): boolean {
  const normalized = normalizeTireReadingsConfig(config)
  if (normalized.reading_mode === 'none') return true

  const treadOk =
    !normalized.measure_tread ||
    (reading.tread_depth_mm != null && !Number.isNaN(reading.tread_depth_mm))
  const pressureOk =
    !normalized.measure_pressure ||
    (reading.pressure_psi != null && !Number.isNaN(reading.pressure_psi))

  if (!normalized.measure_tread && !normalized.measure_pressure) return true
  if (normalized.measure_tread && normalized.measure_pressure) {
    return treadOk && pressureOk
  }
  return treadOk && pressureOk
}

export function countCompletedTireReadings(
  readings: ChecklistTireReadingInput[],
  config: TireReadingsSectionConfig
): number {
  return readings.filter((r) => isTireReadingComplete(r, config)).length
}

export function validateTireReadingsSection(params: {
  readings: ChecklistTireReadingInput[]
  positionCount: number
  config?: Partial<TireReadingsSectionConfig> | null
  sectionTitle?: string
}): { valid: boolean; errors: string[]; completed: number; total: number } {
  const config = normalizeTireReadingsConfig(params.config)
  const label = params.sectionTitle ? `"${params.sectionTitle}"` : 'Llantas'
  const errors: string[] = []

  if (config.reading_mode === 'none' || params.positionCount === 0) {
    return { valid: true, errors, completed: 0, total: 0 }
  }

  const total = params.positionCount
  const completed = countCompletedTireReadings(params.readings, config)

  if (config.require_all_positions) {
    if (completed < total) {
      const missing = total - completed
      errors.push(
        `🛞 ${label}: faltan lecturas en ${missing} posición${missing > 1 ? 'es' : ''}`
      )
    }
  } else if (completed === 0) {
    errors.push(`🛞 ${label}: registre al menos una lectura`)
  }

  return {
    valid: errors.length === 0,
    errors,
    completed,
    total,
  }
}

export function filterPersistableTireReadings(
  readings: ChecklistTireReadingInput[],
  config?: Partial<TireReadingsSectionConfig> | null
): ChecklistTireReadingInput[] {
  const normalized = normalizeTireReadingsConfig(config)

  return readings.filter((r) => {
    if (!r.installation_id) return false
    const hasTread = r.tread_depth_mm != null
    const hasPressure = r.pressure_psi != null
    if (normalized.reading_mode === 'none') return false
    if (normalized.measure_tread && normalized.measure_pressure) {
      return hasTread || hasPressure
    }
    if (normalized.measure_tread) return hasTread
    if (normalized.measure_pressure) return hasPressure
    return hasTread || hasPressure
  })
}
