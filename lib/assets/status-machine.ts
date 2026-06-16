/**
 * Asset status transitions — coordinated with service windows and work orders.
 */

export type AssetStatusCode = 'operational' | 'maintenance' | 'repair' | 'inactive' | 'retired'

const VALID: AssetStatusCode[] = ['operational', 'maintenance', 'repair', 'inactive', 'retired']

export function normalizeAssetStatus(raw: string | null | undefined): AssetStatusCode | string {
  if (!raw) return 'operational'
  const lower = raw.toLowerCase().trim()
  const map: Record<string, AssetStatusCode> = {
    operational: 'operational',
    operativo: 'operational',
    maintenance: 'maintenance',
    mantenimiento: 'maintenance',
    'en mantenimiento': 'maintenance',
    repair: 'repair',
    reparación: 'repair',
    reparacion: 'repair',
    inactive: 'inactive',
    inactivo: 'inactive',
    retired: 'retired',
    retirado: 'retired',
  }
  return map[lower] ?? raw
}

export function statusOnServiceWindowConfirmed(): AssetStatusCode {
  return 'maintenance'
}

export function statusOnServiceWindowReleased(): AssetStatusCode {
  return 'operational'
}

export function isValidAssetStatus(s: string): boolean {
  return VALID.includes(s as AssetStatusCode)
}
