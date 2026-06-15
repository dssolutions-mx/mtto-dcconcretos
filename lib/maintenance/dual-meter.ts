import { buildDueLedger, type DueLedgerResult, type DueEngineInterval } from "./due-engine";
import type { DueEngineHistoryRow } from "./due-engine";
import type { MaintenanceUnit } from "@/lib/utils/maintenance-units";
import { getRawModelMaintenanceUnit } from "@/lib/utils/maintenance-units";
import { parseMaintenanceUnitString } from "@/lib/utils/cyclic-maintenance";

/** P3: legacy "Preventivo" intervals default to hours; km-typed intervals use kilometers. */
export function resolveIntervalMeterUnit(interval: DueEngineInterval): MaintenanceUnit {
  const t = (interval.type ?? "").toLowerCase();
  if (t.includes("km") || t.includes("kilomet")) return "kilometers";
  return "hours";
}

function splitIntervalsByMeter(
  intervals: DueEngineInterval[]
): { hours: DueEngineInterval[]; kilometers: DueEngineInterval[] } {
  const hours: DueEngineInterval[] = [];
  const kilometers: DueEngineInterval[] = [];
  for (const interval of intervals) {
    if (resolveIntervalMeterUnit(interval) === "kilometers") {
      kilometers.push(interval);
    } else {
      hours.push(interval);
    }
  }
  return { hours, kilometers };
}

export type DualMeterLedgerResult = {
  hours?: DueLedgerResult;
  kilometers?: DueLedgerResult;
  primaryUnit: "hours" | "kilometers";
};

/**
 * Run due ledger(s) for models with hours, kilometers, or both.
 * Legacy "Preventivo" intervals follow the primary unit (hours when both).
 */
export function buildLedgersForAsset(params: {
  intervals: DueEngineInterval[];
  history: DueEngineHistoryRow[];
  currentHours: number;
  currentKilometers: number;
  rawMaintenanceUnit?: string | null;
}): DualMeterLedgerResult {
  const raw = (params.rawMaintenanceUnit ?? "hours").toLowerCase();
  const primaryUnit = parseMaintenanceUnitString(raw);

  if (raw === "both") {
    const { hours: hourIntervals, kilometers: kmIntervals } = splitIntervalsByMeter(
      params.intervals
    );
    const result: DualMeterLedgerResult = { primaryUnit: "hours" };
    if (hourIntervals.length > 0) {
      result.hours = buildDueLedger({
        intervals: hourIntervals,
        history: params.history,
        currentValue: params.currentHours,
        unit: "hours",
      });
    }
    if (kmIntervals.length > 0) {
      result.kilometers = buildDueLedger({
        intervals: kmIntervals,
        history: params.history,
        currentValue: params.currentKilometers,
        unit: "kilometers",
      });
    }
    return result;
  }

  const currentValue =
    primaryUnit === "kilometers" ? params.currentKilometers : params.currentHours;
  const single = buildDueLedger({
    intervals: params.intervals,
    history: params.history,
    currentValue,
    unit: primaryUnit,
  });

  return primaryUnit === "kilometers"
    ? { kilometers: single, primaryUnit }
    : { hours: single, primaryUnit };
}

export function getRawMaintenanceUnitFromAsset(asset: {
  equipment_models?: { maintenance_unit?: string | null } | null;
  model?: { maintenance_unit?: string | null } | null;
  maintenance_unit?: string | null;
}): string | null {
  return getRawModelMaintenanceUnit(asset);
}
