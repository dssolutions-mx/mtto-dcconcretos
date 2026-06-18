import {
  preprocessPreventiveHistory,
  type ExcludedHistoryRow,
  type PreprocessedHistoryRow,
} from "./history-preprocess";
import type { MaintenanceHistoryMeterRow, MaintenanceUnit } from "@/lib/utils/maintenance-units";
import { getMaintenanceValue } from "@/lib/utils/maintenance-units";

export type DueEngineInterval = {
  id: string;
  interval_value?: number | null;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  maintenance_category?: string | null;
  is_recurring?: boolean | null;
  is_first_cycle_only?: boolean | null;
};

export type DueEngineHistoryRow = MaintenanceHistoryMeterRow & {
  id?: string;
  date?: string | null;
  type?: string | null;
};

export type CheckpointRef = {
  historyId?: string;
  maintenancePlanId: string;
  meterValue: number;
  date: string | null;
  intervalValue: number;
};

export type DueMilestoneStatus = "paid" | "absorbed" | "unpaid";

export type DueMilestone = {
  intervalId: string;
  intervalValue: number;
  due: number;
  cycle: number;
  status: DueMilestoneStatus;
  paidBy?: CheckpointRef;
  absorbedBy?: CheckpointRef;
};

export type LedgerIntervalStatus =
  | "not_applicable"
  | "completed"
  | "covered"
  | "overdue"
  | "upcoming"
  | "scheduled";

export type LedgerReasons = {
  paidBy?: CheckpointRef;
  absorbedBy?: CheckpointRef;
  unpaidDue?: { due: number; cycle: number };
};

export type LedgerIntervalResult = {
  intervalId: string;
  interval: DueEngineInterval;
  status: LedgerIntervalStatus;
  nextDueValue: number | null;
  cycleForService: number;
  cycleLength: number;
  currentValue: number;
  valueRemaining: number;
  wasPerformed: boolean;
  lastMaintenanceDate: string | null;
  reasons: LedgerReasons;
};

export type DueLedgerOptions = {
  horizon?: number;
  upcomingThreshold?: number;
  nextCycleMaxDistance?: number;
  planIdToIntervalId?: Record<string, string>;
  deadIntervalCatalog?: Map<string, { interval_value: number; type?: string | null }>;
};

export type DueLedgerResult = {
  dues: DueMilestone[];
  byInterval: LedgerIntervalResult[];
  excludedHistory: ExcludedHistoryRow[];
  lastServiceMeter: number;
  cycleLength: number;
  currentCycle: number;
};

const DEFAULT_HORIZON = 1000;
const DEFAULT_UPCOMING = 100;
const DEFAULT_NEXT_CYCLE_MAX = 1000;

function cycleForDue(due: number, cycleLength: number): number {
  if (cycleLength <= 0) return 1;
  return Math.floor((due - 1) / cycleLength) + 1;
}

function generateMilestones(
  intervals: DueEngineInterval[],
  cycleLength: number,
  currentValue: number,
  horizon: number
): DueMilestone[] {
  const milestones: DueMilestone[] = [];
  const maxCycle =
    Math.floor((currentValue + horizon) / cycleLength) +
    (currentValue + horizon > 0 ? 1 : 0);

  for (const interval of intervals) {
    const intervalValue = Number(interval.interval_value) || 0;
    if (intervalValue <= 0) continue;

    const isRecurring = interval.is_recurring !== false;
    const isFirstCycleOnly = interval.is_first_cycle_only === true;

    for (let cycle = 1; cycle <= Math.max(maxCycle, 1); cycle++) {
      if (!isRecurring && cycle > 1) continue;
      if (isFirstCycleOnly && cycle > 1) continue;

      const due = (cycle - 1) * cycleLength + intervalValue;
      if (due > currentValue + horizon) continue;

      milestones.push({
        intervalId: interval.id,
        intervalValue,
        due,
        cycle,
        status: "unpaid",
      });
    }
  }

  return milestones;
}

function findNearestUnassignedDue(
  milestones: DueMilestone[],
  intervalId: string,
  meterValue: number
): DueMilestone | null {
  const candidates = milestones.filter(
    (m) => m.intervalId === intervalId && m.status === "unpaid"
  );
  if (!candidates.length) return null;

  let best: DueMilestone | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(c.due - meterValue);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function toCheckpointRef(
  row: PreprocessedHistoryRow,
  intervalValue: number
): CheckpointRef {
  return {
    historyId: row.id,
    maintenancePlanId: row.maintenance_plan_id,
    meterValue: row.meterValue,
    date: row.date ?? null,
    intervalValue,
  };
}

function isCorrectiveMaintenanceHistoryType(type: string | null | undefined): boolean {
  const t = type?.toLowerCase();
  return t === "corrective" || t === "correctivo";
}

function assignCorrectiveMeterAbsorption(
  milestones: DueMilestone[],
  history: DueEngineHistoryRow[],
  unit: MaintenanceUnit
): void {
  const correctiveRows = (history ?? [])
    .filter((row) => isCorrectiveMaintenanceHistoryType(row.type))
    .map((row) => ({ row, meterValue: getMaintenanceValue(row, unit) }))
    .filter((entry) => entry.meterValue > 0)
    .sort((a, b) => a.meterValue - b.meterValue);

  for (const { row, meterValue } of correctiveRows) {
    const ref: CheckpointRef = {
      maintenancePlanId: row.maintenance_plan_id ?? "corrective",
      meterValue,
      date: row.date ?? null,
      intervalValue: 0,
    };
    for (const m of milestones) {
      if (m.status === "unpaid" && m.due <= meterValue) {
        m.status = "absorbed";
        m.absorbedBy = ref;
      }
    }
  }
}

function assignCheckpoints(
  milestones: DueMilestone[],
  checkpoints: PreprocessedHistoryRow[],
  intervalById: Map<string, DueEngineInterval>
): void {
  for (const cp of checkpoints) {
    const interval = intervalById.get(cp.maintenance_plan_id);
    const intervalValue = Number(interval?.interval_value) || 0;
    const ref = toCheckpointRef(cp, intervalValue);

    if (interval) {
      const nearest = findNearestUnassignedDue(
        milestones,
        cp.maintenance_plan_id,
        cp.meterValue
      );
      if (nearest) {
        nearest.status = "paid";
        nearest.paidBy = ref;
      }
    }

    for (const m of milestones) {
      if (m.status === "unpaid" && m.due <= cp.meterValue) {
        m.status = "absorbed";
        m.absorbedBy = ref;
      }
    }
  }
}

function computeUrgencyValueRemaining(
  status: LedgerIntervalStatus,
  currentValue: number,
  nextDueValue: number | null
): number {
  if (nextDueValue === null) return 0;
  if (status === "completed" || status === "covered") return 0;
  if (status === "overdue") return -(currentValue - nextDueValue);
  return nextDueValue - currentValue;
}

/**
 * Canonical due-ledger engine with checkpoint absorption semantics.
 */
export function buildDueLedger(params: {
  intervals: DueEngineInterval[];
  history: DueEngineHistoryRow[];
  currentValue: number;
  unit: MaintenanceUnit;
  options?: DueLedgerOptions;
}): DueLedgerResult {
  const { intervals, history, currentValue, unit, options } = params;
  const horizon = options?.horizon ?? DEFAULT_HORIZON;
  const upcomingThreshold = options?.upcomingThreshold ?? DEFAULT_UPCOMING;
  const nextCycleMaxDistance = options?.nextCycleMaxDistance ?? DEFAULT_NEXT_CYCLE_MAX;

  if (!intervals.length) {
    return {
      dues: [],
      byInterval: [],
      excludedHistory: [],
      lastServiceMeter: 0,
      cycleLength: 0,
      currentCycle: 0,
    };
  }

  const cycleLength = Math.max(...intervals.map((i) => Number(i.interval_value) || 0));
  if (cycleLength <= 0) {
    return {
      dues: [],
      byInterval: [],
      excludedHistory: [],
      lastServiceMeter: 0,
      cycleLength: 0,
      currentCycle: 0,
    };
  }

  const currentCycle = Math.floor(currentValue / cycleLength) + 1;
  const knownIntervalIds = new Set(intervals.map((i) => i.id));
  const intervalById = new Map(intervals.map((i) => [i.id, i]));

  const { usable, excluded } = preprocessPreventiveHistory(history, unit, {
    planIdToIntervalId: options?.planIdToIntervalId,
    knownIntervalIds,
    knownIntervals: intervals,
    deadIntervalCatalog: options?.deadIntervalCatalog,
  });

  const milestones = generateMilestones(intervals, cycleLength, currentValue, horizon);
  assignCheckpoints(milestones, usable, intervalById);
  assignCorrectiveMeterAbsorption(milestones, history, unit);

  const lastServiceMeter = usable.length
    ? Math.max(...usable.map((r) => r.meterValue))
    : 0;

  const byInterval: LedgerIntervalResult[] = [];

  for (const interval of intervals) {
    const intervalValue = Number(interval.interval_value) || 0;
    const isFirstCycleOnly = interval.is_first_cycle_only === true;

    let status: LedgerIntervalStatus = "not_applicable";
    let nextDueValue: number | null = null;
    let cycleForService = currentCycle;
    let wasPerformed = false;
    let lastMaintenanceDate: string | null = null;
    const reasons: LedgerReasons = {};

    if (!isFirstCycleOnly || currentCycle === 1) {
      const intervalMilestones = milestones.filter((m) => m.intervalId === interval.id);

      const overdueInWindow = intervalMilestones
        .filter(
          (m) =>
            m.status === "unpaid" &&
            m.due > lastServiceMeter &&
            m.due <= currentValue
        )
        .sort((a, b) => a.due - b.due);

      if (overdueInWindow.length > 0) {
        const earliest = overdueInWindow[0];
        status = "overdue";
        nextDueValue = earliest.due;
        cycleForService = earliest.cycle;
        reasons.unpaidDue = { due: earliest.due, cycle: earliest.cycle };
      } else {
        const currentCycleStart = (currentCycle - 1) * cycleLength;

        const settledMilestones = intervalMilestones
          .filter(
            (m) =>
              (m.status === "paid" || m.status === "absorbed") && m.due <= currentValue
          )
          .sort((a, b) => b.due - a.due);

        const latestSettled = settledMilestones[0];
        const retroactiveAbsorbed = settledMilestones.find(
          (m) =>
            m.status === "absorbed" &&
            m.cycle < currentCycle &&
            m.absorbedBy &&
            m.absorbedBy.meterValue >= currentCycleStart
        );

        let computedDue = (currentCycle - 1) * cycleLength + intervalValue;
        const cycleEnd = currentCycle * cycleLength;

        if (computedDue > cycleEnd) {
          cycleForService = currentCycle + 1;
          computedDue = currentCycle * cycleLength + intervalValue;
          if (computedDue - currentValue > nextCycleMaxDistance) {
            status = "not_applicable";
          } else if (retroactiveAbsorbed) {
            status = "covered";
            nextDueValue = retroactiveAbsorbed.due;
            cycleForService = retroactiveAbsorbed.cycle;
            reasons.absorbedBy = retroactiveAbsorbed.absorbedBy;
          } else {
            status = "scheduled";
            nextDueValue = computedDue;
          }
        } else {
          nextDueValue = computedDue;
          const currentMilestone = intervalMilestones.find((m) => m.due === computedDue);

          if (currentMilestone?.status === "paid") {
            status = "completed";
            wasPerformed = true;
            reasons.paidBy = currentMilestone.paidBy;
            lastMaintenanceDate = currentMilestone.paidBy?.date ?? null;
          } else if (currentMilestone?.status === "absorbed") {
            status = "covered";
            reasons.absorbedBy = currentMilestone.absorbedBy;
          } else if (retroactiveAbsorbed) {
            status = "covered";
            nextDueValue = retroactiveAbsorbed.due;
            cycleForService = retroactiveAbsorbed.cycle;
            reasons.absorbedBy = retroactiveAbsorbed.absorbedBy;
          } else if (currentValue >= computedDue) {
            status = "overdue";
            cycleForService = cycleForDue(computedDue, cycleLength);
            reasons.unpaidDue = { due: computedDue, cycle: cycleForService };
          } else if (currentValue >= computedDue - upcomingThreshold) {
            status = "upcoming";
          } else {
            status = "scheduled";
          }
        }

        const hasUnpaidAtOrBeforeCurrent = intervalMilestones.some(
          (m) => m.status === "unpaid" && m.due <= currentValue
        );
        if (
          overdueInWindow.length === 0 &&
          !hasUnpaidAtOrBeforeCurrent &&
          latestSettled?.status === "paid" &&
          status !== "covered" &&
          status !== "completed"
        ) {
          status = "completed";
          wasPerformed = true;
          nextDueValue = latestSettled.due;
          cycleForService = latestSettled.cycle;
          reasons.paidBy = latestSettled.paidBy;
          lastMaintenanceDate = latestSettled.paidBy?.date ?? null;
        } else if (
          overdueInWindow.length === 0 &&
          !hasUnpaidAtOrBeforeCurrent &&
          latestSettled &&
          (latestSettled.status === "paid" || latestSettled.status === "absorbed") &&
          latestSettled.due <= currentValue &&
          (status === "scheduled" || status === "upcoming") &&
          nextDueValue != null &&
          nextDueValue - currentValue > nextCycleMaxDistance
        ) {
          status = latestSettled.status === "paid" ? "completed" : "covered";
          wasPerformed = true;
          nextDueValue = latestSettled.due;
          cycleForService = latestSettled.cycle;
          if (latestSettled.status === "paid") {
            reasons.paidBy = latestSettled.paidBy;
            lastMaintenanceDate = latestSettled.paidBy?.date ?? null;
          } else {
            reasons.absorbedBy = latestSettled.absorbedBy;
            lastMaintenanceDate = latestSettled.absorbedBy?.date ?? null;
          }
        }
      }
    }

    const settledForInterval = milestones.filter(
      (m) =>
        m.intervalId === interval.id &&
        (m.status === "paid" || m.status === "absorbed")
    );
    if (settledForInterval.length > 0) {
      const latestSettledForInterval = [...settledForInterval].sort(
        (a, b) => b.due - a.due
      )[0];
      wasPerformed = true;
      if (!lastMaintenanceDate) {
        lastMaintenanceDate =
          latestSettledForInterval.paidBy?.date ??
          latestSettledForInterval.absorbedBy?.date ??
          null;
      }
    }

    const valueRemaining = computeUrgencyValueRemaining(status, currentValue, nextDueValue);

    byInterval.push({
      intervalId: interval.id,
      interval,
      status,
      nextDueValue,
      cycleForService,
      cycleLength,
      currentValue,
      valueRemaining,
      wasPerformed,
      lastMaintenanceDate,
      reasons,
    });
  }

  return {
    dues: milestones,
    byInterval,
    excludedHistory: excluded,
    lastServiceMeter,
    cycleLength,
    currentCycle,
  };
}

/** Preview which dues a hypothetical checkpoint at `meterValue` would absorb. */
export function previewCheckpointAbsorption(params: {
  intervals: DueEngineInterval[];
  history: DueEngineHistoryRow[];
  currentValue: number;
  unit: MaintenanceUnit;
  hypothetical: {
    maintenance_plan_id: string;
    meterValue: number;
    date?: string | null;
  };
  options?: DueLedgerOptions;
}): Array<{ intervalId: string; intervalValue: number; due: number; cycle: number }> {
  const augmentedHistory: DueEngineHistoryRow[] = [
    ...params.history,
    {
      type: "preventive",
      maintenance_plan_id: params.hypothetical.maintenance_plan_id,
      hours: params.unit === "hours" ? params.hypothetical.meterValue : null,
      kilometers: params.unit === "kilometers" ? params.hypothetical.meterValue : null,
      date: params.hypothetical.date ?? new Date().toISOString(),
    },
  ];

  const before = buildDueLedger({
    intervals: params.intervals,
    history: params.history,
    currentValue: params.currentValue,
    unit: params.unit,
    options: params.options,
  });

  const after = buildDueLedger({
    intervals: params.intervals,
    history: augmentedHistory,
    currentValue: Math.max(params.currentValue, params.hypothetical.meterValue),
    unit: params.unit,
    options: params.options,
  });

  const beforeUnpaid = new Set(
    before.dues.filter((d) => d.status === "unpaid").map((d) => `${d.intervalId}:${d.due}`)
  );

  const absorbed: Array<{ intervalId: string; intervalValue: number; due: number; cycle: number }> =
    [];

  for (const d of after.dues) {
    const key = `${d.intervalId}:${d.due}`;
    if (beforeUnpaid.has(key) && (d.status === "paid" || d.status === "absorbed")) {
      absorbed.push({
        intervalId: d.intervalId,
        intervalValue: d.intervalValue,
        due: d.due,
        cycle: d.cycle,
      });
    }
  }

  return absorbed.sort((a, b) => a.due - b.due);
}
