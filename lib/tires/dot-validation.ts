import { isMeaningfulDot } from '@/lib/tires/display'
import { normalizeDotSerial } from '@/lib/tires/normalize-identity'

export type DotFormatSeverity = 'error' | 'warning'

export interface DotFormatValidation {
  valid: boolean
  severity?: DotFormatSeverity
  message?: string
}

const DOT_MIN_LENGTH = 6
const DOT_HAS_ALNUM = /[A-Z0-9]/i

/**
 * Lightweight DOT / sidewall serial format check for live UI feedback.
 * Does not replace duplicate checks against the database.
 */
export function validateDotFormat(value: string): DotFormatValidation {
  const normalized = normalizeDotSerial(value)

  if (!normalized) {
    return { valid: true }
  }

  if (normalized.length < 4) {
    return {
      valid: false,
      severity: 'error',
      message: 'El DOT parece demasiado corto',
    }
  }

  if (!isMeaningfulDot(normalized)) {
    return {
      valid: false,
      severity: 'error',
      message: 'Use el código completo impreso en la pared lateral',
    }
  }

  if (normalized.length < DOT_MIN_LENGTH) {
    return {
      valid: false,
      severity: 'warning',
      message: 'El DOT parece incompleto — verifique el código en la llanta',
    }
  }

  if (!DOT_HAS_ALNUM.test(normalized)) {
    return {
      valid: false,
      severity: 'error',
      message: 'El DOT debe incluir letras o números',
    }
  }

  return { valid: true }
}
