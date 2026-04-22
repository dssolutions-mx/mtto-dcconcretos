/**
 * Utility functions for handling maintenance units (hours vs kilometers)
 */

export type MaintenanceUnit = 'hours' | 'kilometers';

/** Short label for model forms and lists (includes `both` / `none`). */
export function formatMaintenanceUnitLabel(unit: string | null | undefined): string {
  switch (unit) {
    case 'hours':
      return 'Horas'
    case 'kilometers':
      return 'Kilómetros'
    case 'both':
      return 'Horas y kilómetros'
    case 'none':
      return 'Sin medidor'
    default:
      return unit?.trim() ? unit : '—'
  }
}

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

/** Which reading columns are tracked for this model's maintenance_unit (raw DB value). */
export function getTrackedReadingFieldsForModelUnit(
  raw: string | null | undefined
): Array<'current_hours' | 'current_kilometers'> {
  const u = (raw ?? 'hours').toLowerCase();
  if (u === 'kilometers' || u === 'kilometres') return ['current_kilometers'];
  if (u === 'both') return ['current_hours', 'current_kilometers'];
  if (u === 'none') return [];
  return ['current_hours'];
}

/** Primary reading field for "confirm reading" shortcuts (first tracked field). */
export function getPrimaryReadingField(
  raw: string | null | undefined
): 'current_hours' | 'current_kilometers' | null {
  const fields = getTrackedReadingFieldsForModelUnit(raw);
  return fields[0] ?? null;
}
