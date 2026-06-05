import {
  getMaintenanceValue,
  type MaintenanceHistoryMeterRow,
  type MaintenanceUnit,
} from "./maintenance-units";

/** Interval row fields needed for cross-cycle unpaid detection. */
export type CyclicIntervalForDue = {
  id: string;
  interval_value?: number | null;
  type?: string | null;
};

export type CyclicIntervalCatalogRow = {
  id?: string | null;
  interval_value?: number | null;
  type?: string | null;
};

/**
 * Smallest meter due in any cycle up to `currentCycle` that is already at or before `currentValue`
 * and was never satisfied (no preventive of this plan in that cycle, and not covered by a higher tier in that cycle).
 * Used so cycle-1 gaps still surface as vencido once the asset is in cycle 2+.
 */
export function findEarliestUnpaidPreventiveDue(
  interval: CyclicIntervalForDue,
  args: {
    currentValue: number;
    maxInterval: number;
    currentCycle: number;
    preventiveHistory: MaintenanceHistoryMeterRow[];
    maintenanceIntervals: CyclicIntervalCatalogRow[];
    maintenanceUnit: MaintenanceUnit;
    isRecurring: boolean;
    isFirstCycleOnly: boolean;
  }
): { due: number; cycle: number } | null {
  const intervalValue = Number(interval.interval_value) || 0;
  const {
    currentValue,
    maxInterval,
    currentCycle,
    preventiveHistory,
    maintenanceIntervals,
    maintenanceUnit,
    isRecurring,
    isFirstCycleOnly,
  } = args;

  let earliestUnpaid: { due: number; cycle: number } | null = null;

  for (let cycleIdx = 1; cycleIdx <= currentCycle; cycleIdx++) {
    if (!isRecurring && cycleIdx > 1) continue;
    if (isFirstCycleOnly && cycleIdx > 1) continue;

    const due = (cycleIdx - 1) * maxInterval + intervalValue;
    if (due > currentValue) continue;

    // A due at meter value `due` is satisfied by any qualifying preventive performed
    // from the due point up to the next time the same milestone recurs (one cycle later).
    // Using this window instead of the cycle [start, end) slice recognizes services done
    // late: e.g. a cycle-closing (max-interval) service logged just past the cycle boundary
    // still clears the lower-tier dues it covers, instead of leaving them flagged overdue.
    const coverageWindowEnd = due + maxInterval;
    const satisfyingHistory = preventiveHistory.filter((m) => {
      const mValue = getMaintenanceValue(m, maintenanceUnit);
      return mValue >= due && mValue < coverageWindowEnd;
    });

    const wasPerformedInCycle = satisfyingHistory.some(
      (m) => m.maintenance_plan_id === interval.id
    );
    let isCoveredInCycle = false;
    if (!wasPerformedInCycle) {
      isCoveredInCycle = satisfyingHistory.some((m) => {
        const performedInterval = maintenanceIntervals.find((i) => i.id === m.maintenance_plan_id);
        if (!performedInterval) return false;
        const sameUnit = performedInterval.type === interval.type;
        const higherOrEqual =
          Number(performedInterval.interval_value) >= Number(interval.interval_value);
        return Boolean(sameUnit && higherOrEqual);
      });
    }

    if (!wasPerformedInCycle && !isCoveredInCycle) {
      if (earliestUnpaid === null || due < earliestUnpaid.due) {
        earliestUnpaid = { due, cycle: cycleIdx };
      }
    }
  }

  return earliestUnpaid;
}
