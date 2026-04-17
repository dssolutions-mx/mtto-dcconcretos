/**
 * Canonical Spanish typography for manual_financial_adjustments text fields
 * (CSV imports and gerencial manual-costs API) so PRODUCCION/NOMINA align with
 * manually accented values.
 */

export function normalizeManualAdjustmentSpanishLabel(
  raw: string | null | undefined
): string | null {
  if (raw == null || !String(raw).trim()) return null
  let s = String(raw).trim()
  s = s.replace(/\bPRODUCCION\b/gi, 'PRODUCCIÓN')
  s = s.replace(/\bADMINISTRACION\b/gi, 'ADMINISTRACIÓN')
  s = s.replace(/\bNOMINA\b/gi, 'NÓMINA')
  return s
}

export function normalizeManualAdjustmentDepartment(
  input: string | null | undefined
): string | null {
  if (input == null || !String(input).trim()) return null
  return normalizeManualAdjustmentSpanishLabel(String(input)) ?? String(input)
}

export function normalizeManualAdjustmentOptionalLabel(
  input: string | null | undefined
): string | null {
  if (input == null || !String(input).trim()) return null
  return normalizeManualAdjustmentSpanishLabel(String(input)) ?? String(input)
}
