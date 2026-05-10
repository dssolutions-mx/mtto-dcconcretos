/** Normalize asset codes for Cotizador ↔ Mantenimiento matching (subset of gerencial rules). */
export function normalizeAssetCode(code: string): string {
  let normalized = code.toUpperCase().trim()
  normalized = normalized.replace(/^([A-Z]{2,})(\d+)$/i, '$1-$2')
  normalized = normalized.replace(/^CR-EXT\s+(\d{1,2})$/i, 'CR-EXT-$1')
  normalized = normalized.replace(/^([A-Z]{2,}-\d+)[-\s]+[0-9A-Z]$/i, '$1')
  normalized = normalized.replace(/(\d)([A-Z])$/i, '$1')
  return normalized
}
