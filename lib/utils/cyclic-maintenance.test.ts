import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCyclicIntervalResults,
  isActionableCyclicScheduleRow,
  selectCyclicSummaryInterval,
} from "./cyclic-maintenance";

const kmIntervals = [
  {
    id: "int-300",
    interval_value: 300,
    type: "kilometers",
    name: "300 km",
    is_recurring: true,
    is_first_cycle_only: false,
  },
  {
    id: "int-1500",
    interval_value: 1500,
    type: "kilometers",
    name: "1500 km",
    is_recurring: true,
    is_first_cycle_only: false,
  },
  {
    id: "int-3600",
    interval_value: 3600,
    type: "kilometers",
    name: "3600 km",
    is_recurring: true,
    is_first_cycle_only: false,
  },
];

const sitrakBp01Intervals = [
  100, 300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600,
].map((v, idx) => ({
  id: `bp01-int-${v}`,
  interval_value: v,
  type: "Preventivo",
  name: `SERVICIO ${v} HORAS`,
  maintenance_category:
    v === 100
      ? "break_in"
      : v === 900 || v === 1800 || v === 2700
        ? "major"
        : v === 600 || v === 1200 || v === 2400
          ? "intermediate"
          : v === 3600
            ? "overhaul"
            : "standard",
  is_recurring: true,
  is_first_cycle_only: v === 100,
}));

const bp01History = [
  {
    type: "Preventivo",
    maintenance_plan_id: "bp01-int-1800",
    hours: 1820,
    date: "2025-02-04",
  },
  {
    type: "Preventivo",
    maintenance_plan_id: "bp01-int-2700",
    hours: 2820,
    date: "2025-06-24",
  },
  {
    type: "preventive",
    maintenance_plan_id: "bp01-int-300",
    hours: 3934,
    date: "2025-12-12",
  },
  {
    type: "preventive",
    maintenance_plan_id: "bp01-int-1200",
    hours: 5024,
    date: "2026-05-27",
  },
];

function statusOf(results: ReturnType<typeof computeCyclicIntervalResults>, value: number) {
  return results.find((r) => Number(r.interval.interval_value) === value)?.status;
}

test("km asset: 300 km overdue when at 21000 with only 1500 km service in cycle", () => {
  const history = [
    {
      type: "preventivo",
      maintenance_plan_id: "int-1500",
      kilometers: 16500,
      hours: null,
      date: "2025-10-01",
    },
  ];
  const results = computeCyclicIntervalResults({
    intervals: kmIntervals,
    history,
    currentValue: 21000,
    unit: "kilometers",
  });
  assert.equal(statusOf(results, 300), "overdue");
});

test("km coverage requires performed at or after due point", () => {
  const history = [
    {
      type: "preventivo",
      maintenance_plan_id: "int-3600",
      kilometers: 5000,
      date: "2025-01-01",
    },
  ];
  const results = computeCyclicIntervalResults({
    intervals: kmIntervals,
    history,
    currentValue: 8000,
    unit: "kilometers",
  });
  const fifteenHundred = results.find((r) => r.intervalId === "int-1500");
  assert.ok(fifteenHundred);
  assert.notEqual(fifteenHundred!.status, "covered");
});

test("selectCyclicSummaryInterval picks lowest overdue interval", () => {
  const results = computeCyclicIntervalResults({
    intervals: kmIntervals,
    history: [],
    currentValue: 21000,
    unit: "kilometers",
  });
  const summary = selectCyclicSummaryInterval({
    intervalResults: results,
    history: [],
    intervals: kmIntervals,
    currentValue: 21000,
    unit: "kilometers",
  });
  assert.equal(summary.selectedInterval?.id, "int-300");
  assert.ok(summary.overdue != null && summary.overdue > 0);
});

test("cycle-closing service logged late covers lower tiers in prior cycle (CR-24)", () => {
  const intervals = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300, 3600].map(
    (v) => ({
      id: `int-${v}`,
      interval_value: v,
      type: "hours",
      name: `${v}h`,
      is_recurring: true,
      is_first_cycle_only: false,
    })
  );
  const history = [
    { type: "preventivo", maintenance_plan_id: "int-1500", hours: 1697, kilometers: null, date: "2025-07-10" },
    { type: "preventivo", maintenance_plan_id: "int-2700", hours: 2728, kilometers: null, date: "2025-12-01" },
    { type: "preventivo", maintenance_plan_id: "int-3600", hours: 3749, kilometers: null, date: "2026-06-02" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 3749,
    unit: "hours",
  });
  assert.notEqual(statusOf(results, 3000), "overdue");
  assert.notEqual(statusOf(results, 3300), "overdue");
});

test("hours and km share same cycle formula", () => {
  const hourIntervals = kmIntervals.map((i) => ({ ...i, type: "hours" }));
  const kmResults = computeCyclicIntervalResults({
    intervals: kmIntervals,
    history: [],
    currentValue: 2100,
    unit: "kilometers",
  });
  const hourResults = computeCyclicIntervalResults({
    intervals: hourIntervals,
    history: [],
    currentValue: 2100,
    unit: "hours",
  });
  assert.equal(kmResults.length, hourResults.length);
  for (let i = 0; i < kmResults.length; i++) {
    assert.equal(kmResults[i].status, hourResults[i].status);
  }
});

test("BP-01 real-data replay at 5130h", () => {
  const results = computeCyclicIntervalResults({
    intervals: sitrakBp01Intervals,
    history: bp01History,
    currentValue: 5130,
    unit: "hours",
  });

  assert.equal(statusOf(results, 300), "completed");
  assert.equal(statusOf(results, 600), "covered");
  assert.equal(statusOf(results, 900), "covered");
  assert.equal(statusOf(results, 1200), "completed");
  assert.equal(statusOf(results, 1500), "overdue");
  assert.equal(statusOf(results, 3000), "covered");
  assert.equal(statusOf(results, 3300), "covered");
  assert.equal(statusOf(results, 3600), "covered");

  const overdueRows = results.filter((r) => r.status === "overdue");
  assert.equal(overdueRows.length, 1);
  assert.equal(Number(overdueRows[0].interval.interval_value), 1500);

  const nineHundred = results.find((r) => Number(r.interval.interval_value) === 900);
  assert.ok(nineHundred?.reasons?.absorbedBy);
  assert.equal(nineHundred!.reasons!.absorbedBy!.intervalValue, 1200);
});

test("300h done at 280h early completion in cycle 1, asset in cycle 2", () => {
  const intervals = [
    { id: "int-300", interval_value: 300, type: "hours", is_recurring: true, is_first_cycle_only: false },
    { id: "int-3600", interval_value: 3600, type: "hours", is_recurring: true, is_first_cycle_only: false },
  ];
  const history = [
    { type: "preventivo", maintenance_plan_id: "int-300", hours: 280, date: "2025-01-01" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 4000,
    unit: "hours",
  });
  const threeHundred = results.find((r) => r.intervalId === "int-300");
  assert.ok(threeHundred);
  assert.notEqual(threeHundred!.nextDueValue, 300);
  assert.ok((threeHundred!.nextDueValue ?? 0) >= 3900);
});

test("different categories: higher tier covers lower (no category gate)", () => {
  const intervals = [
    {
      id: "int-900",
      interval_value: 900,
      type: "hours",
      maintenance_category: "major",
      is_recurring: true,
      is_first_cycle_only: false,
    },
    {
      id: "int-1200",
      interval_value: 1200,
      type: "hours",
      maintenance_category: "intermediate",
      is_recurring: true,
      is_first_cycle_only: false,
    },
    {
      id: "int-3600",
      interval_value: 3600,
      type: "hours",
      is_recurring: true,
      is_first_cycle_only: false,
    },
  ];
  const history = [
    { type: "preventivo", maintenance_plan_id: "int-1200", hours: 5024, date: "2026-05-27" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 5130,
    unit: "hours",
  });
  assert.equal(statusOf(results, 900), "covered");
});

test("service exactly at 3600h pays cycle-1 closing due only", () => {
  const intervals = [
    { id: "int-300", interval_value: 300, type: "hours", is_recurring: true, is_first_cycle_only: false },
    { id: "int-3600", interval_value: 3600, type: "hours", is_recurring: true, is_first_cycle_only: false },
  ];
  const history = [
    { type: "preventivo", maintenance_plan_id: "int-3600", hours: 3600, date: "2025-06-01" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 3600,
    unit: "hours",
  });
  assert.equal(statusOf(results, 3600), "completed");
});

test("first-cycle-only break-in not applicable in cycle 2", () => {
  const intervals = [
    { id: "int-100", interval_value: 100, type: "hours", is_recurring: true, is_first_cycle_only: true },
    { id: "int-3600", interval_value: 3600, type: "hours", is_recurring: true, is_first_cycle_only: false },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history: [],
    currentValue: 4000,
    unit: "hours",
  });
  assert.equal(statusOf(results, 100), "not_applicable");
});

test("legacy maintenance_plans.id row with plan map satisfies", () => {
  const intervals = [
    { id: "int-300", interval_value: 300, type: "hours", is_recurring: true, is_first_cycle_only: false },
    { id: "int-3600", interval_value: 3600, type: "hours", is_recurring: true, is_first_cycle_only: false },
  ];
  const history = [
    { type: "preventivo", maintenance_plan_id: "plan-row-1", hours: 3900, date: "2025-12-01" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 4000,
    unit: "hours",
    options: { planIdToIntervalId: { "plan-row-1": "int-300" } },
  });
  assert.equal(statusOf(results, 300), "completed");
});

test("null-meter preventive row excluded without crash", () => {
  const intervals = [
    { id: "int-300", interval_value: 300, type: "hours", is_recurring: true, is_first_cycle_only: false },
    { id: "int-3600", interval_value: 3600, type: "hours", is_recurring: true, is_first_cycle_only: false },
  ];
  const history = [
    { type: "preventivo", maintenance_plan_id: "int-300", hours: null, date: "2025-12-01" },
  ];
  const results = computeCyclicIntervalResults({
    intervals,
    history,
    currentValue: 4000,
    unit: "hours",
  });
  assert.ok(results.length > 0);
});

test("schedule view hides covered; debug mode can include current-cycle covered", () => {
  assert.equal(isActionableCyclicScheduleRow("covered", 1, 2), false);
  assert.equal(isActionableCyclicScheduleRow("covered", 2, 2), false);
  assert.equal(isActionableCyclicScheduleRow("covered", 2, 2, { includeCovered: true }), true);
  assert.equal(isActionableCyclicScheduleRow("covered", 1, 2, { includeCovered: true }), false);
  assert.equal(isActionableCyclicScheduleRow("scheduled", 2, 2), true);
  assert.equal(isActionableCyclicScheduleRow("overdue", 1, 2), true);
});
