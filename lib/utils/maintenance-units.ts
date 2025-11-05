/**
 * Utility functions for handling maintenance units (hours vs kilometers)
 */

export type MaintenanceUnit = 'hours' | 'kilometers';

/**
 * Get the maintenance unit from an asset or component
 * @param assetOrComponent - Asset or component object with equipment_models or model property
 * @returns Maintenance unit, defaults to 'hours'
 */
export function getMaintenanceUnit(assetOrComponent: any): MaintenanceUnit {
  const unit = 
    assetOrComponent?.equipment_models?.maintenance_unit ||
    assetOrComponent?.model?.maintenance_unit ||
    assetOrComponent?.maintenance_unit;
  
  return (unit === 'kilometers' || unit === 'kilometres') ? 'kilometers' : 'hours';
}

/**
 * Get the current value (hours or kilometers) from an asset/component based on unit
 * @param assetOrComponent - Asset or component object
 * @param unit - Maintenance unit ('hours' or 'kilometers')
 * @returns Current hours or kilometers value
 */
export function getCurrentValue(assetOrComponent: any, unit: MaintenanceUnit): number {
  if (unit === 'kilometers') {
    return Number(assetOrComponent?.current_kilometers) || 0;
  }
  return Number(assetOrComponent?.current_hours) || 0;
}

/**
 * Get the maintenance value (hours or kilometers) from a maintenance history entry
 * @param maintenance - Maintenance history entry
 * @param unit - Maintenance unit ('hours' or 'kilometers')
 * @returns Maintenance hours or kilometers value
 */
export function getMaintenanceValue(maintenance: any, unit: MaintenanceUnit): number {
  if (unit === 'kilometers') {
    return Number(maintenance?.kilometers) || 0;
  }
  return Number(maintenance?.hours) || 0;
}

/**
 * Get short unit label (h or km)
 * @param unit - Maintenance unit
 * @returns Short label
 */
export function getUnitLabel(unit: MaintenanceUnit): string {
  return unit === 'kilometers' ? 'km' : 'h';
}

/**
 * Get full unit display name in Spanish (horas or kilómetros)
 * @param unit - Maintenance unit
 * @returns Full display name
 */
export function getUnitDisplayName(unit: MaintenanceUnit): string {
  return unit === 'kilometers' ? 'kilómetros' : 'horas';
}

/**
 * Get unit label for table headers (e.g., "Próximo a las/km")
 * @param unit - Maintenance unit
 * @returns Table header label
 */
export function getTableHeaderLabel(unit: MaintenanceUnit): string {
  return unit === 'kilometers' ? 'Próximo a los' : 'Próximo a las';
}

