/**
 * Asset Status Utilities
 * Handles the proper display and classification of asset operational status
 */

export type AssetStatus = 'operational' | 'maintenance' | 'repair' | string

export interface AssetStatusConfig {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  color: string
}

/**
 * Get the display configuration for an asset status
 */
export function getAssetStatusConfig(status: string): AssetStatusConfig {
  switch (status) {
    case 'operational':
      return {
        label: 'Operativo',
        variant: 'default',
        color: 'green'
      }
    case 'maintenance':
      return {
        label: 'Mantenimiento',
        variant: 'secondary',
        color: 'yellow'
      }
    case 'repair':
      return {
        label: 'Reparación',
        variant: 'destructive',
        color: 'red'
      }
    default:
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        variant: 'outline',
        color: 'gray'
      }
  }
}

/**
 * Check if an asset is operational (ready for use)
 */
export function isAssetOperational(status: string): boolean {
  return status === 'operational'
}

/**
 * Check if an asset is available for assignment
 */
export function isAssetAvailable(status: string): boolean {
  return status === 'operational'
}

/**
 * Get all valid asset status values
 */
export function getValidAssetStatuses(): AssetStatus[] {
  return ['operational', 'maintenance', 'repair']
}

/**
 * Get status options for forms/selects
 */
export function getAssetStatusOptions() {
  return [
    { value: 'operational', label: 'Operativo' },
    { value: 'maintenance', label: 'Mantenimiento' },
    { value: 'repair', label: 'Reparación' }
  ]
} 