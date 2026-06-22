/** Normalizes DOT / sidewall serial input for consistent storage. */
export function normalizeDotSerial(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function normalizeInternalCode(value: string): string {
  return value.trim().toUpperCase()
}
