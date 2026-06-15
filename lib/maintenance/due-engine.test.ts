import test from "node:test";
import assert from "node:assert/strict";
import { buildDueLedger } from "./due-engine";
import { computeCyclicIntervalResults } from "../utils/cyclic-maintenance";

const sitrakBp01Intervals = [
  100, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600,
].map((v) => ({
  id: `bp01-int-${v}`,
  interval_value: v,
  type: "Preventivo",
  is_recurring: true,
  is_first_cycle_only: v === 100,
}));

const bp01History = [
  { type: "Preventivo", maintenance_plan_id: "bp01-int-1800", hours: 1820, date: "2025-02-04" },
  { type: "Preventivo", maintenance_plan_id: "bp01-int-2700", hours: 2820, date: "2025-06-24" },
  { type: "preventive", maintenance_plan_id: "bp01-int-300", hours: 3934, date: "2025-12-12" },
  { type: "preventive", maintenance_plan_id: "bp01-int-1200", hours: 5024, date: "2026-05-27" },
];

test("debug BP-01 milestone states", () => {
  const r = buildDueLedger({
    intervals: sitrakBp01Intervals,
    history: bp01History,
    currentValue: 5130,
    unit: "hours",
  });
  const m3000 = r.dues.filter((d) => d.intervalValue === 3000);
  assert.equal(m3000.find((m) => m.due === 3000)?.status, "absorbed");
  const row = r.byInterval.find((x) => x.interval.interval_value === 3000);
  assert.equal(row?.status, "covered");

  const withCategories = sitrakBp01Intervals.map((v) => ({
    ...v,
    maintenance_category: "standard" as const,
  }));
  const adapted = computeCyclicIntervalResults({
    intervals: withCategories,
    history: bp01History,
    currentValue: 5130,
    unit: "hours",
  });
  const adapted3000 = adapted.find((x) => x.interval.interval_value === 3000);
  assert.equal(adapted3000?.status, "covered");
});
