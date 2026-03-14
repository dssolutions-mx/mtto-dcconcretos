export function getAssetName(incident: Record<string, unknown>, assets: Record<string, unknown>[]): string {
  if (incident.asset_code) return String(incident.asset_code)
  const asset = assets.find((a) => a.id === incident.asset_id)
  return asset ? String((asset as Record<string, unknown>).asset_id ?? "N/A") : "N/A"
}

export function getAssetFullName(incident: Record<string, unknown>, assets: Record<string, unknown>[]): string {
  if (incident.asset_display_name) return String(incident.asset_display_name)
  const asset = assets.find((a) => a.id === incident.asset_id)
  return asset ? String((asset as Record<string, unknown>).name ?? "Activo no encontrado") : "Activo no encontrado"
}

export function getReporterName(incident: Record<string, unknown>): string {
  if (incident.reported_by_name) return String(incident.reported_by_name)
  if (incident.reported_by && String(incident.reported_by).length > 30) return "Usuario del sistema"
  return String(incident.reported_by ?? "Usuario desconocido")
}
