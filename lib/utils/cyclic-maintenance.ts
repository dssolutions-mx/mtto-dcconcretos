import { findEarliestUnpaidPreventiveDue } from "./cyclic-preventive-due";
import {
  filterPreventiveHistoryForIntervals,
  formatIntervalLabel,
  getMaintenanceValue,
  isPreventiveMaintenanceHistoryType,
  type MaintenanceHistoryMeterRow,
  type MaintenanceUnit,
} from "./maintenance-units";

export type CyclicMaintenanceStatus =
  | "not_applicable"
  | "completed"
  | "covered"
  | "overdue"
  | "upcoming"
  | "scheduled";

export type CyclicMaintenanceInterval = {
  id: string;
  interval_value?: number | null;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  maintenance_category?: string | null;
  is_recurring?: boolean | null;
  is_first_cycle_only?: boolean | null;
};

export type CyclicMaintenanceHistoryRow = MaintenanceHistoryMeterRow & {
  maintenance_plan_id?: string | null;
  date?: string | null;
  type?: string | null;
};

export type CyclicUrgency = "low" | "medium" | "high";

export type CyclicIntervalResult = {
  intervalId: string;
  interval: CyclicMaintenanceInterval;
  status: CyclicMaintenanceStatus;
  nextDueValue: number | null;
  cycleForService: number;
  cycleLength: number;
  currentValue: number;
  valueRemaining: number;
  urgency: CyclicUrgency;
  progress: number;
  wasPerformed: boolean;
  lastMaintenanceDate: string | null;
};

export type CyclicComputeOptions = {
  /** Distance before due to mark upcoming (default 100). */
  upcomingThreshold?: number;
  /** Max distance into next cycle to still show scheduled (default 1000). */
  nextCycleMaxDistance?: number;
  /** Apply cross-cycle unpaid detection (asset detail / list). */
  applyEarliestUnpaid?: boolean;
  /** Statuses to include in returned list (default: actionable + covered). */
  includeStatuses?: CyclicMaintenanceStatus[];
};

const DEFAULT_UPCOMING_THRESHOLD = 100;
const DEFAULT_NEXT_CYCLE_MAX = 1000;

function meterTypeFromIntervalType(type: string | null | undefined): "hours" | "kilometers" | null {
  const t = (type ?? "").toLowerCase();
  if (t === "hours" || t === "hour") return "hours";
  if (t === "kilometers" || t === "kilometres" || t === "km") return "kilometers";
  return null;
}

/** Coverage: same explicit meter type, or legacy Preventivo rows on one model. */
function intervalsCompatibleForCoverage(
  performed: CyclicMaintenanceInterval,
  due: CyclicMaintenanceInterval,
  modelUnit: MaintenanceUnit
): boolean {
  const pMeter = meterTypeFromIntervalType(performed.type ?? null);
  const dMeter = meterTypeFromIntervalType(due.type ?? null);
  if (pMeter && dMeter) return pMeter === dMeter;
  if (pMeter) return pMeter === modelUnit;
  if (dMeter) return dMeter === modelUnit;
  return true;
}

function categoryCompatible(
  performed: CyclicMaintenanceInterval,
  due: CyclicMaintenanceInterval
): boolean {
  const pCat = performed.maintenance_category;
  const dCat = due.maintenance_category;
  if (pCat && dCat) return pCat === dCat;
  return true;
}

function computeUrgency(
  status: CyclicMaintenanceStatus,
  valueRemaining: number,
  intervalValue: number
): CyclicUrgency {
  if (status === "overdue") {
    const overdue = Math.abs(valueRemaining);
    return overdue > intervalValue * 0.5 ? "high" : "medium";
  }
  if (status === "upcoming") {
    return valueRemaining <= 50 ? "high" : "medium";
  }
  return "low";
}

function computeProgress(
  status: CyclicMaintenanceStatus,
  currentValue: number,
  nextDueValue: number | null,
  intervalValue: number
): number {
  if (status === "completed" || status === "covered") return 100;
  if (status === "overdue") return 100;
  const safeDue = Number(nextDueValue ?? intervalValue) || 0;
  if (safeDue <= 0) return 0;
  return Math.min(100, Math.round((currentValue / safeDue) * 100));
}

/**
 * Canonical cyclic preventive status per model interval.
 * Unit-agnostic: pass current hours or km and `unit` from equipment_models.maintenance_unit.
 */
export function computeCyclicIntervalResults(params: {
  intervals: CyclicMaintenanceInterval[];
  history: CyclicMaintenanceHistoryRow[];
  currentValue: number;
  unit: MaintenanceUnit;
  options?: CyclicComputeOptions;
}): CyclicIntervalResult[] {
  const { intervals, history, currentValue, unit, options } = params;
  const upcomingThreshold = options?.upcomingThreshold ?? DEFAULT_UPCOMING_THRESHOLD;
  const nextCycleMaxDistance = options?.nextCycleMaxDistance ?? DEFAULT_NEXT_CYCLE_MAX;
  const applyEarliestUnpaid = options?.applyEarliestUnpaid ?? false;

  if (!intervals.length) return [];

  const maxInterval = Math.max(...intervals.map((i) => Number(i.interval_value) || 0));
  if (maxInterval <= 0) return [];

  const currentCycle = Math.floor(currentValue / maxInterval) + 1;
  const cycleStart = (currentCycle - 1) * maxInterval;
  const cycleEnd = currentCycle * maxInterval;

  const preventiveHistory = filterPreventiveHistoryForIntervals(history, intervals);

  const currentCycleMaintenances = preventiveHistory.filter((m) => {
    const mValue = getMaintenanceValue(m, unit);
    return mValue > cycleStart && mValue < cycleEnd;
  });

  const results: CyclicIntervalResult[] = [];

  for (const interval of intervals) {
    const intervalValue = Number(interval.interval_value) || 0;
    const isRecurring = interval.is_recurring !== false;
    const isFirstCycleOnly = interval.is_first_cycle_only === true;

    let status: CyclicMaintenanceStatus = "not_applicable";
    let nextDueValue: number | null = null;
    let cycleForService = currentCycle;
    let wasPerformed = false;
    let lastMaintenanceDate: string | null = null;

    if (!isFirstCycleOnly || currentCycle === 1) {
      let computedDue = (currentCycle - 1) * maxInterval + intervalValue;

      if (computedDue > cycleEnd) {
        cycleForService = currentCycle + 1;
        computedDue = currentCycle * maxInterval + intervalValue;
        if (computedDue - currentValue > nextCycleMaxDistance) {
          status = "not_applicable";
        } else {
          status = "scheduled";
          nextDueValue = computedDue;
        }
      } else {
        const dueValue = computedDue;
        const wasPerformedInCurrentCycle = currentCycleMaintenances.some(
          (m) => m.maintenance_plan_id === interval.id
        );

        if (wasPerformedInCurrentCycle) {
          status = "completed";
          wasPerformed = true;
          const lastOfType = currentCycleMaintenances.find(
            (m) => m.maintenance_plan_id === interval.id
          );
          lastMaintenanceDate = lastOfType?.date ?? null;
        } else {
          const isCoveredByHigher = currentCycleMaintenances.some((m) => {
            const performedInterval = intervals.find((i) => i.id === m.maintenance_plan_id);
            if (!performedInterval) return false;
            if (!intervalsCompatibleForCoverage(performedInterval, interval, unit)) return false;
            if (!categoryCompatible(performedInterval, interval)) return false;
            const higherOrEqual =
              Number(performedInterval.interval_value) >= Number(interval.interval_value);
            const performedAtValue = getMaintenanceValue(m, unit);
            const performedAfterDue = performedAtValue >= dueValue;
            return higherOrEqual && performedAfterDue;
          });

          if (isCoveredByHigher) {
            status = "covered";
          } else if (currentValue >= dueValue) {
            status = "overdue";
          } else if (currentValue >= dueValue - upcomingThreshold) {
            status = "upcoming";
          } else {
            status = "scheduled";
          }
        }
        nextDueValue = computedDue;
      }
    }

    let valueRemaining = 0;
    if (nextDueValue !== null && status !== "not_applicable") {
      if (status === "completed" || status === "covered") {
        valueRemaining = 0;
      } else if (status === "overdue") {
        valueRemaining = -(currentValue - nextDueValue);
      } else {
        valueRemaining = nextDueValue - currentValue;
      }
    }

    if (applyEarliestUnpaid && status !== "not_applicable" && status !== "completed" && status !== "covered") {
      const earliestUnpaid = findEarliestUnpaidPreventiveDue(
        { id: interval.id, interval_value: interval.interval_value, type: interval.type },
        {
          currentValue,
          maxInterval,
          currentCycle,
          preventiveHistory,
          maintenanceIntervals: intervals,
          maintenanceUnit: unit,
          isRecurring,
          isFirstCycleOnly,
        }
      );
      if (earliestUnpaid !== null && earliestUnpaid.due <= currentValue) {
        status = "overdue";
        nextDueValue = earliestUnpaid.due;
        cycleForService = earliestUnpaid.cycle;
        valueRemaining = -(currentValue - earliestUnpaid.due);
        wasPerformed = false;
        lastMaintenanceDate = null;
      }
    }

    const urgency = computeUrgency(status, valueRemaining, intervalValue);
    const progress = computeProgress(status, currentValue, nextDueValue, intervalValue);

    results.push({
      intervalId: interval.id,
      interval,
      status,
      nextDueValue,
      cycleForService,
      cycleLength: maxInterval,
      currentValue,
      valueRemaining,
      urgency,
      progress,
      wasPerformed,
      lastMaintenanceDate,
    });
  }

  return results;
}

export type CyclicSummarySelection = {
  selectedInterval: CyclicMaintenanceInterval | null;
  lastServiceDate: string | null;
  lastServiceValue: number | null;
  lastServiceIntervalValue: number | null;
  overdue: number | undefined;
  remaining: number | undefined;
  selectedIntervalDueValue: number | null;
};

/**
 * Pick the primary actionable interval for reports/alerts (lowest overdue, else nearest upcoming).
 */
export function selectCyclicSummaryInterval(params: {
  intervalResults: CyclicIntervalResult[];
  history: CyclicMaintenanceHistoryRow[];
  intervals: CyclicMaintenanceInterval[];
  currentValue: number;
  unit: MaintenanceUnit;
}): CyclicSummarySelection {
  const { intervalResults, history, intervals, currentValue, unit } = params;

  let lastServiceDate: string | null = null;
  let lastServiceValue: number | null = null;
  let lastServiceIntervalValue: number | null = null;

  const preventiveHistory = filterPreventiveHistoryForIntervals(history, intervals);
  if (preventiveHistory.length > 0) {
    const sorted = [...preventiveHistory].sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
    );
    lastServiceDate = sorted[0].date ?? null;
    lastServiceValue = getMaintenanceValue(sorted[0], unit);
    const lastInterval = intervals.find((i) => i.id === sorted[0].maintenance_plan_id);
    lastServiceIntervalValue = lastInterval?.interval_value ?? null;
  }

  const actionable = intervalResults.filter(
    (r) =>
      r.status !== "not_applicable" && r.status !== "completed" && r.status !== "covered"
  );

  if (!actionable.length) {
    return {
      selectedInterval: null,
      lastServiceDate,
      lastServiceValue,
      lastServiceIntervalValue,
      overdue: undefined,
      remaining: undefined,
      selectedIntervalDueValue: null,
    };
  }

  const overdueItems = actionable.filter((r) => r.status === "overdue");
  let selected: CyclicIntervalResult | null = null;

  if (overdueItems.length > 0) {
    selected = overdueItems.reduce((first, item) => {
      const firstIv = Number(first.interval.interval_value) || 0;
      const itemIv = Number(item.interval.interval_value) || 0;
      if (itemIv < firstIv) return item;
      if (itemIv > firstIv) return first;
      const itemOverdue = currentValue - (item.nextDueValue ?? 0);
      const firstOverdue = currentValue - (first.nextDueValue ?? 0);
      return itemOverdue > firstOverdue ? item : first;
    });
  } else {
    const upcomingItems = actionable.filter(
      (r) => r.status === "upcoming" || r.status === "scheduled"
    );
    if (upcomingItems.length > 0) {
      selected = upcomingItems.reduce((min, item) =>
        (item.nextDueValue ?? Infinity) < (min.nextDueValue ?? Infinity) ? item : min
      );
    }
  }

  if (!selected) {
    return {
      selectedInterval: null,
      lastServiceDate,
      lastServiceValue,
      lastServiceIntervalValue,
      overdue: undefined,
      remaining: undefined,
      selectedIntervalDueValue: null,
    };
  }

  let overdue: number | undefined;
  let remaining: number | undefined;
  if (selected.status === "overdue" && selected.nextDueValue != null) {
    overdue = currentValue - selected.nextDueValue;
  } else if (selected.nextDueValue != null) {
    remaining = selected.nextDueValue - currentValue;
  }

  const lastForInterval = preventiveHistory
    .filter((m) => m.maintenance_plan_id === selected!.interval.id)
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())[0];

  if (lastForInterval) {
    const intervalDate = new Date(lastForInterval.date ?? 0).getTime();
    const currentLast = lastServiceDate ? new Date(lastServiceDate).getTime() : 0;
    if (intervalDate >= currentLast) {
      lastServiceDate = lastForInterval.date ?? null;
      lastServiceValue = getMaintenanceValue(lastForInterval, unit);
      lastServiceIntervalValue = selected.interval.interval_value ?? null;
    }
  }

  const selectedIntervalDueValue =
    overdue != null && overdue > 0
      ? currentValue - overdue
      : remaining != null
        ? currentValue + remaining
        : selected.nextDueValue;

  return {
    selectedInterval: selected.interval,
    lastServiceDate,
    lastServiceValue,
    lastServiceIntervalValue,
    overdue,
    remaining,
    selectedIntervalDueValue,
  };
}

/** Filter interval results for UI lists (asset detail, assets list). */
export function filterRelevantCyclicResults(
  results: CyclicIntervalResult[],
  statuses: CyclicMaintenanceStatus[] = ["overdue", "upcoming", "covered", "scheduled"]
): CyclicIntervalResult[] {
  return results.filter((r) => statuses.includes(r.status));
}

/** Aggregate flags for asset grid badges. */
export function cyclicResultsToListFlags(
  results: CyclicIntervalResult[],
  history: CyclicMaintenanceHistoryRow[],
  unit: MaintenanceUnit
): {
  hasOverdue: boolean;
  hasUpcoming: boolean;
  nextMaintenances: CyclicIntervalResult[];
  lastMaintenanceValue: number;
} {
  const relevant = filterRelevantCyclicResults(results);
  const values = history
    .filter((m) => isPreventiveMaintenanceHistoryType(m.type))
    .map((m) => getMaintenanceValue(m, unit))
    .filter((v) => v > 0);
  const lastMaintenanceValue = values.length ? Math.max(...values) : 0;

  return {
    hasOverdue: relevant.some((r) => r.status === "overdue"),
    hasUpcoming: relevant.some((r) => r.status === "upcoming"),
    nextMaintenances: relevant,
    lastMaintenanceValue,
  };
}

export function parseMaintenanceUnitString(unit: string | null | undefined): MaintenanceUnit {
  const u = (unit ?? "hours").toLowerCase();
  return u === "kilometers" || u === "kilometres" ? "kilometers" : "hours";
}

/** Map engine output to asset detail / mantenimiento upcoming-maintenance cards. */
export type CyclicMantenimientoRow = {
  interval_id: string;
  interval_value: number;
  name: string;
  description: string;
  type: string;
  maintenance_category: string;
  is_recurring: boolean;
  is_first_cycle_only: boolean;
  current_cycle: number;
  next_due_hour: number;
  next_due_value: number;
  status: string;
  cycle_length: number;
  component_id?: string;
  component_name?: string;
  component_value?: number;
  component_unit?: MaintenanceUnit;
};

export function cyclicResultsToMantenimientoRows(
  results: CyclicIntervalResult[],
  extras?: { component_id?: string; component_name?: string; component_value?: number; component_unit?: MaintenanceUnit }
): CyclicMantenimientoRow[] {
  return filterRelevantCyclicResults(results).map((r) => ({
    interval_id: r.intervalId,
    interval_value: Number(r.interval.interval_value) || 0,
    name: r.interval.name ?? "",
    description: r.interval.description ?? "",
    type: r.interval.type ?? "",
    maintenance_category: r.interval.maintenance_category ?? "standard",
    is_recurring: r.interval.is_recurring !== false,
    is_first_cycle_only: r.interval.is_first_cycle_only === true,
    current_cycle: r.cycleForService,
    next_due_hour: r.nextDueValue ?? 0,
    next_due_value: r.nextDueValue ?? 0,
    status: r.status,
    cycle_length: r.cycleLength,
    ...extras,
  }));
}

export function cyclicResultsToUpcomingUi(
  results: CyclicIntervalResult[],
  unit: MaintenanceUnit
) {
  return filterRelevantCyclicResults(results).map((r) => ({
    intervalId: r.intervalId,
    intervalName: formatIntervalLabel(r.interval, unit),
    intervalDescription: r.interval.description,
    type: r.interval.type,
    intervalValue: r.interval.interval_value,
    currentValue: r.currentValue,
    targetValue: r.nextDueValue ?? r.interval.interval_value,
    valueRemaining: r.valueRemaining,
    status: r.status,
    urgency: r.urgency,
    progress: r.progress,
    unit: unit === "kilometers" ? "kilometers" : "hours",
    estimatedDate: new Date().toISOString(),
    lastMaintenanceDate: r.lastMaintenanceDate,
    wasPerformed: r.wasPerformed,
    cycleForService: r.cycleForService,
    cycleLength: r.cycleLength,
  }));
}
