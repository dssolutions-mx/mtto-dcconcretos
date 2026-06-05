import test from "node:test";
import assert from "node:assert/strict";

import {
  computeCyclicIntervalResults,
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
    options: { applyEarliestUnpaid: true },
  });
  const threeHundred = results.find((r) => r.intervalId === "int-300");
  assert.ok(threeHundred);
  assert.equal(threeHundred!.status, "overdue");
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
  // maxInterval 3600; asset at 3749 → cycle 2. The 3600 "Ultra Completo" was
  // performed at 3749 (just past the cycle boundary). It must clear the cycle-1
  // 3000/3300 dues it covers instead of flagging them overdue.
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
    options: { applyEarliestUnpaid: true },
  });
  const threeK = results.find((r) => r.intervalId === "int-3000");
  const threeThreeK = results.find((r) => r.intervalId === "int-3300");
  assert.ok(threeK && threeThreeK);
  assert.notEqual(threeK!.status, "overdue");
  assert.notEqual(threeThreeK!.status, "overdue");
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
