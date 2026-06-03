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
