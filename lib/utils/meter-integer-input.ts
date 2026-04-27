/**
 * Horómetro / odómetro: enteros en sistema + formato es-MX.
 * `parseInt("12,420", 10)` vale 12 — por eso se normaliza quitando miles antes de interpretar.
 */

const ES_MX_INTEGER: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
}

export function formatIntegerMeterReading(
  value: number | null | undefined,
  emptyLabel = 'N/A'
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return emptyLabel
  }
  const n = Math.trunc(Number(value))
  return n.toLocaleString('es-MX', ES_MX_INTEGER)
}

/**
 * Interpreta entrada de usuario como entero no negativo.
 * - Quita espacios y comas (miles en es-MX).
 * - Parte fraccionaria: se trunca hacia cero (como lecturas enteras en BD).
 */
export function parseIntegerMeterReading(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\s/g, '').replace(/,/g, '')
  if (normalized === '' || normalized === '-' || normalized === '+') return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  if (n < 0) return null
  const asInt = Math.trunc(n)
  if (!Number.isSafeInteger(asInt)) return null
  return asInt
}

/** Texto corto para ayuda junto a campos de horómetro/odómetro */
export const METER_INTEGER_ENTRY_HINT =
  'Solo números enteros (el sistema no guarda decimales). Puede usar separador de miles con coma, p. ej. 12,420.'