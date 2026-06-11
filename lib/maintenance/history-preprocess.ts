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

    let intervalId = row?.maintenance_plan_id ?? null;
    if (!intervalId) {
      excluded.push({ date: row?.date ?? null, maintenance_plan_id: null, why: "missing_plan_id" });
      continue;
    }

    if (!knownIds.has(intervalId) && planMap[intervalId]) {
      intervalId = planMap[intervalId];
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
      excluded.push({
        date: row?.date ?? null,
        maintenance_plan_id: intervalId,
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
