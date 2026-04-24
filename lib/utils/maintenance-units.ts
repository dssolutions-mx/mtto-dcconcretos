/**
 * Utility functions for handling maintenance units (hours vs kilometers)
 */

export type MaintenanceUnit = 'hours' | 'kilometers';

/** Asset / component with optional nested model maintenance_unit (DB shape varies). */
export type MaintenanceUnitSource = {
  equipment_models?: { maintenance_unit?: string | null } | null;
  model?: { maintenance_unit?: string | null } | null;
  maintenance_unit?: string | null;
};

/** Minimal maintenance_history row for meter / preventive KPI helpers. */
export type MaintenanceHistoryMeterRow = {
  type?: string | null;
  maintenance_plan_id?: string | null;
  date?: string | null;
  hours?: unknown;
  kilometers?: unknown;
};

export type MaintenanceIntervalMeterRow = {
  id?: string | null;
};

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
export function getMaintenanceUnit(
  assetOrComponent: MaintenanceUnitSource | null | undefined
): MaintenanceUnit {
  const unit =
    assetOrComponent?.equipment_models?.maintenance_unit ||
    assetOrComponent?.model?.maintenance_unit ||
    assetOrComponent?.maintenance_unit;

  return unit === "kilometers" || unit === "kilometres" ? "kilometers" : "hours";
}

/** Raw `equipment_models.maintenance_unit` (hours, kilometers, both, none, …). */
export function getRawModelMaintenanceUnit(
  assetOrComponent: MaintenanceUnitSource | null | undefined
): string | null {
  const unit =
    assetOrComponent?.equipment_models?.maintenance_unit ??
    assetOrComponent?.model?.maintenance_unit ??
    assetOrComponent?.maintenance_unit ??
    null;
  return typeof unit === "string" ? unit.trim().toLowerCase() : null;
}

/** Maintenance history `type` counts as preventive (EN/ES, case-insensitive). */
export function isPreventiveMaintenanceHistoryType(type: string | null | undefined): boolean {
  const t = type?.toLowerCase();
  return t === "preventive" || t === "preventivo";
}

/**
 * Preventive rows whose `maintenance_plan_id` matches a model interval id
 * (same rule as asset detail upcoming-maintenance).
 */
export function filterPreventiveHistoryForIntervals(
  history: MaintenanceHistoryMeterRow[],
  maintenanceIntervals: MaintenanceIntervalMeterRow[]
): MaintenanceHistoryMeterRow[] {
  if (!history?.length || !maintenanceIntervals?.length) return [];
  return history.filter((m) => {
    if (!isPreventiveMaintenanceHistoryType(m?.type) || !m?.maintenance_plan_id) return false;
    return maintenanceIntervals.some((interval) => interval.id === m.maintenance_plan_id);
  });
}

/** Highest meter reading among plan-linked preventive history (hours or km per `unit`). */
export function getMaxPreventiveMeterReading(
  history: MaintenanceHistoryMeterRow[],
  maintenanceIntervals: MaintenanceIntervalMeterRow[],
  unit: MaintenanceUnit
): number {
  const preventive = filterPreventiveHistoryForIntervals(history, maintenanceIntervals);
  const values = preventive.map((m) => getMaintenanceValue(m, unit)).filter((v) => v > 0);
  if (!values.length) return 0;
  return Math.max(...values);
}

/** Newest preventive row among those tied for the max meter reading (by `date` desc). */
export function getLastPreventiveHistoryAtMaxMeter(
  history: MaintenanceHistoryMeterRow[],
  maintenanceIntervals: MaintenanceIntervalMeterRow[],
  unit: MaintenanceUnit
): MaintenanceHistoryMeterRow | null {
  const preventive = filterPreventiveHistoryForIntervals(history, maintenanceIntervals);
  const readings = preventive
    .map((m) => getMaintenanceValue(m, unit))
    .filter((v) => v > 0);
  if (!readings.length) return null;
  const max = Math.max(...readings);
  const tied = preventive.filter((m) => getMaintenanceValue(m, unit) === max);
  tied.sort((a, b) => {
    const da = new Date(a?.date ?? 0).getTime();
    const db = new Date(b?.date ?? 0).getTime();
    return db - da;
  });
  return tied[0] ?? null;
}

/**
 * Get the current value (hours or kilometers) from an asset/component based on unit
 * @param assetOrComponent - Asset or component object
 * @param unit - Maintenance unit ('hours' or 'kilometers')
 * @returns Current hours or kilometers value
 */
export function getCurrentValue(
  assetOrComponent: { current_hours?: unknown; current_kilometers?: unknown } | null | undefined,
  unit: MaintenanceUnit
): number {
  if (unit === "kilometers") {
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
export function getMaintenanceValue(
  maintenance: MaintenanceHistoryMeterRow | null | undefined,
  unit: MaintenanceUnit
): number {
  if (unit === "kilometers") {
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
