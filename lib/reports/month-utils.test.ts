import test from "node:test"
import assert from "node:assert/strict"

import { shiftMonthString } from "./month-utils"

test("shifts a YYYY-MM month string backward without timezone drift", () => {
  assert.equal(shiftMonthString("2026-03", -1), "2026-02")
  assert.equal(shiftMonthString("2026-01", -1), "2025-12")
})

test("shifts a YYYY-MM month string forward across year boundaries", () => {
  assert.equal(shiftMonthString("2025-12", 1), "2026-01")
})
