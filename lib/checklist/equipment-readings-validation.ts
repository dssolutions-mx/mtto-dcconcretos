import { formatIntegerMeterReading } from '@/lib/utils/meter-integer-input'

export interface ExpectedReading {
  current_reading: number
  expected_reading: number
  average_daily_usage: number
  days_since_last_reading: number
  last_reading_date?: string
}

export interface EquipmentReadingsValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  hints: string[]
  current_hours: number
  current_kilometers: number
  maintenance_unit?: string
  expected_hours?: ExpectedReading | null
  expected_kilometers?: ExpectedReading | null
}

type ReadingPayload = {
  hours_reading?: number | null
  kilometers_reading?: number | null
}

function parseBelowCurrentError(
  message: string
): { kind: 'hours' | 'kilometers'; entered: number; current: number } | null {
  const hoursMatch = message.match(
    /horas \((\d+)\) no pueden ser menores que las actuales \((\d+)\)/i
  )
  if (hoursMatch) {
    return {
      kind: 'hours',
      entered: Number(hoursMatch[1]),
      current: Number(hoursMatch[2]),
    }
  }

  const kmMatch = message.match(
    /kil[oó]metros \((\d+)\) no pueden ser menores que los actuales \((\d+)\)/i
  )
  if (kmMatch) {
    return {
      kind: 'kilometers',
      entered: Number(kmMatch[1]),
      current: Number(kmMatch[2]),
    }
  }

  return null
}

function typoCandidate(value: number, anchor: number): number | null {
  if (value <= anchor) return null
  const ratio = value / anchor
  if (ratio >= 8 && ratio <= 12 && value % 10 === 0) {
    const candidate = Math.round(value / 10)
    if (candidate >= anchor && candidate <= anchor + 500) {
      return candidate
    }
  }
  return null
}

function buildBelowCurrentHint(kind: 'hours' | 'kilometers', current: number): string {
  const label = kind === 'hours' ? 'horas' : 'kilómetros'
  const unit = kind === 'hours' ? 'h' : 'km'
  return (
    `El activo ya registra ${formatIntegerMeterReading(current)} ${unit} ` +
    `(p. ej. por diesel u otro módulo). Ingrese al menos esa lectura de ${label} ` +
    `o use «Usar lecturas actuales del activo».`
  )
}

function buildHighReadingHint(
  kind: 'hours' | 'kilometers',
  entered: number,
  current: number,
  expected?: ExpectedReading | null
): string | null {
  const anchor = expected?.expected_reading ?? current
  const candidate = typoCandidate(entered, anchor)
  const label = kind === 'hours' ? 'horas' : 'kilómetros'
  const unit = kind === 'hours' ? 'h' : 'km'

  if (candidate != null) {
    return (
      `La lectura de ${label} parece muy alta (+${formatIntegerMeterReading(entered - current)} ${unit}). ` +
      `¿Quiso escribir ${formatIntegerMeterReading(candidate)}? Revise el tablero antes de enviar.`
    )
  }

  if (expected && entered > expected.expected_reading + (kind === 'hours' ? 100 : 1000)) {
    return (
      `Según el uso reciente, se esperaban unas ${formatIntegerMeterReading(expected.expected_reading)} ${unit}. ` +
      `Si la lectura en tablero es correcta, puede continuar; si no, corrija antes de enviar.`
    )
  }

  return null
}

export function enrichEquipmentReadingsValidation(
  raw: Record<string, unknown> | null | undefined,
  entered?: ReadingPayload
): EquipmentReadingsValidation | null {
  if (!raw || typeof raw !== 'object') return null

  const errors = Array.isArray(raw.errors) ? [...(raw.errors as string[])] : []
  const warnings = Array.isArray(raw.warnings) ? [...(raw.warnings as string[])] : []
  const hints: string[] = []
  const current_hours = Number(raw.current_hours ?? 0)
  const current_kilometers = Number(raw.current_kilometers ?? 0)
  const expected_hours = (raw.expected_hours as ExpectedReading | null) ?? null
  const expected_kilometers = (raw.expected_kilometers as ExpectedReading | null) ?? null

  for (const error of errors) {
    const below = parseBelowCurrentError(error)
    if (below) {
      hints.push(buildBelowCurrentHint(below.kind, below.current))
    }
  }

  const hoursEntered = entered?.hours_reading ?? null
  const kmEntered = entered?.kilometers_reading ?? null

  if (hoursEntered != null && hoursEntered > current_hours) {
    const hint = buildHighReadingHint('hours', hoursEntered, current_hours, expected_hours)
    if (hint) hints.push(hint)
  }

  if (kmEntered != null && kmEntered > current_kilometers) {
    const hint = buildHighReadingHint('kilometers', kmEntered, current_kilometers, expected_kilometers)
    if (hint) hints.push(hint)
  }

  for (const warning of warnings) {
    if (warning.toLowerCase().includes('muy grande')) {
      if (warning.toLowerCase().includes('hora') && hoursEntered != null) {
        const hint = buildHighReadingHint('hours', hoursEntered, current_hours, expected_hours)
        if (hint && !hints.includes(hint)) hints.push(hint)
      }
      if (warning.toLowerCase().includes('kil') && kmEntered != null) {
        const hint = buildHighReadingHint('kilometers', kmEntered, current_kilometers, expected_kilometers)
        if (hint && !hints.includes(hint)) hints.push(hint)
      }
    }
  }

  return {
    valid: Boolean(raw.valid),
    errors,
    warnings,
    hints,
    current_hours,
    current_kilometers,
    maintenance_unit: typeof raw.maintenance_unit === 'string' ? raw.maintenance_unit : undefined,
    expected_hours,
    expected_kilometers,
  }
}

export function readingsAreRequired(visibleMeters: 'hours' | 'kilometers' | 'both' | 'none'): {
  hours: boolean
  kilometers: boolean
} {
  return {
    hours: visibleMeters === 'hours' || visibleMeters === 'both',
    kilometers: visibleMeters === 'kilometers' || visibleMeters === 'both',
  }
}

export function validateReadingsPresence(
  visibleMeters: 'hours' | 'kilometers' | 'both' | 'none',
  readings: ReadingPayload
): string[] {
  const required = readingsAreRequired(visibleMeters)
  const errors: string[] = []

  if (required.hours && (readings.hours_reading == null || readings.hours_reading <= 0)) {
    errors.push('⏱️ Falta la lectura del horómetro')
  }
  if (required.kilometers && (readings.kilometers_reading == null || readings.kilometers_reading <= 0)) {
    errors.push('📏 Falta la lectura del odómetro')
  }

  return errors
}

export function formatSubmissionReadingErrors(
  validation: EquipmentReadingsValidation | null
): { errors: string[]; hints: string[] } {
  if (!validation) {
    return {
      errors: ['No se pudieron validar las lecturas del equipo. Revise e intente de nuevo.'],
      hints: [],
    }
  }

  return {
    errors: validation.errors,
    hints: validation.hints,
  }
}
