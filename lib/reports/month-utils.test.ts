import test from "node:test"
import assert from "node:assert/strict"

import {
  dieselEfficiencyReportMonths,
  formatYearMonthLabelEs,
  formatYearMonthRangeLabelEs,
  listYearMonthsDescending,
  mexicoCityYearMonth,
  shiftMonthString,
} from "./month-utils"

test("shifts a YYYY-MM month string backward without timezone drift", () => {
  assert.equal(shiftMonthString("2026-03", -1), "2026-02")
  assert.equal(shiftMonthString("2026-01", -1), "2025-12")
})

test("shifts a YYYY-MM month string forward across year boundaries", () => {
  assert.equal(shiftMonthString("2025-12", 1), "2026-01")
})

test("mexicoCityYearMonth uses America/Mexico_City calendar", () => {
  // June 1 2026 05:30 UTC = May 31 2026 23:30 Mexico City
  assert.equal(mexicoCityYearMonth(new Date("2026-06-01T05:30:00.000Z")), "2026-05")
  assert.equal(mexicoCityYearMonth(new Date("2026-06-01T06:30:00.000Z")), "2026-06")
})

test("listYearMonthsDescending returns newest-first inclusive range", () => {
  assert.deepEqual(listYearMonthsDescending("2026-01", "2026-03"), [
    "2026-03",
    "2026-02",
    "2026-01",
  ])
})

test("dieselEfficiencyReportMonths grows through current Mexico City month", () => {
  const june = new Date("2026-06-15T12:00:00.000Z")
  assert.deepEqual(dieselEfficiencyReportMonths(june), [
    "2026-06",
    "2026-05",
    "2026-04",
    "2026-03",
    "2026-02",
    "2026-01",
  ])
})

test("formatYearMonthLabelEs and range label", () => {
  assert.equal(formatYearMonthLabelEs("2026-06"), "Junio 2026")
  assert.equal(formatYearMonthRangeLabelEs("2026-01", "2026-06"), "Ene–Jun 2026")
})
