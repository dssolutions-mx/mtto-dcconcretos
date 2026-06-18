import {
  getMaintenanceValue,
  isPreventiveMaintenanceHistoryType,
  type MaintenanceHistoryMeterRow,
  type MaintenanceUnit,
} from "@/lib/utils/maintenance-units";

export type ExcludedHistoryReason =
  | "null_meter"
  | "dead_interval_id"
  | "unit_mismatch"
  | "not_preventive"
  | "missing_plan_id";

export type ExcludedHistoryRow = {
  date: string | null;
  maintenance_plan_id: string | null;
  why: ExcludedHistoryReason;
};

export type PreprocessedHistoryRow = MaintenanceHistoryMeterRow & {
  id?: string;
  maintenance_plan_id: string;
  meterValue: number;
};

export type HistoryPreprocessOptions = {
  /** Legacy maintenance_plans.id → maintenance_intervals.id */
  planIdToIntervalId?: Record<string, string>;
  /** Interval ids known to the model catalog */
  knownIntervalIds?: Set<string>;
  /** Current-model intervals used to remap foreign/dead plan ids by interval_value */
  knownIntervals?: Array<{ id: string; interval_value?: number | null }>;
  /** Dead intervals still referenced in history (id → interval_value) */
  deadIntervalCatalog?: Map<string, { interval_value: number; type?: string | null }>;
};

/**
 * Normalize preventive history for the due ledger: remap plan ids, keep dead-interval
 * rows when catalog provided, and report excluded rows instead of silently dropping.
 */
export function preprocessPreventiveHistory(
  history: MaintenanceHistoryMeterRow[],
  unit: MaintenanceUnit,
  options?: HistoryPreprocessOptions
): {
  usable: PreprocessedHistoryRow[];
  excluded: ExcludedHistoryRow[];
} {
  const planMap = options?.planIdToIntervalId ?? {};
  const knownIds = options?.knownIntervalIds ?? new Set<string>();
  const deadCatalog = options?.deadIntervalCatalog ?? new Map();
  const valueToKnownId = new Map<number, string>();
  for (const interval of options?.knownIntervals ?? []) {
    const value = Number(interval.interval_value) || 0;
    if (value > 0 && !valueToKnownId.has(value)) {
      valueToKnownId.set(value, interval.id);
    }
  }

  const usable: PreprocessedHistoryRow[] = [];
  const excluded: ExcludedHistoryRow[] = [];

  for (const row of history ?? []) {
    if (!isPreventiveMaintenanceHistoryType(row?.type)) {
      excluded.push({
        date: row?.date ?? null,
        maintenance_plan_id: row?.maintenance_plan_id ?? null,
        why: "not_preventive",
      });
      continue;
    }

    const originalPlanId = row?.maintenance_plan_id ?? null;
    let intervalId = originalPlanId;
    if (!intervalId) {
      excluded.push({ date: row?.date ?? null, maintenance_plan_id: null, why: "missing_plan_id" });
      continue;
    }

    if (!knownIds.has(intervalId) && planMap[intervalId]) {
      intervalId = planMap[intervalId];
    }

    if (!knownIds.has(intervalId)) {
      const deadValue =
        deadCatalog.get(intervalId)?.interval_value ??
        (originalPlanId ? deadCatalog.get(originalPlanId)?.interval_value : undefined);
      if (deadValue != null) {
        const remapped = valueToKnownId.get(deadValue);
        if (remapped) intervalId = remapped;
      }
    }

    const meterValue = getMaintenanceValue(row, unit);
    if (meterValue <= 0) {
      excluded.push({
        date: row?.date ?? null,
        maintenance_plan_id: intervalId,
        why: "null_meter",
      });
      continue;
    }

    const isKnown = knownIds.has(intervalId);
    const isDead = deadCatalog.has(intervalId);
    if (!isKnown && !isDead) {
      // Orphan plan id (deleted interval or wrong model): still a meter checkpoint.
      usable.push({
        ...row,
        maintenance_plan_id: intervalId,
        meterValue,
      });
      excluded.push({
        date: row?.date ?? null,
        maintenance_plan_id: originalPlanId,
        why: "dead_interval_id",
      });
      continue;
    }

    usable.push({
      ...row,
      maintenance_plan_id: intervalId,
      meterValue,
    });
  }

  usable.sort((a, b) => {
    if (a.meterValue !== b.meterValue) return a.meterValue - b.meterValue;
    return new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime();
  });

  return { usable, excluded };
}
