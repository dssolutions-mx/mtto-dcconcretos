import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  getLocalDateString,
  getLocalTimeString,
  localDateTimeToUtcIso,
  parseLocalDateTimeFields,
  utcIsoToLocalDateTimeFields,
} from "./date-utils"

describe("diesel date-utils", () => {
  it("parseLocalDateTimeFields accepts YYYY-MM-DD and HH:mm", () => {
    assert.deepEqual(parseLocalDateTimeFields("2026-06-25", "14:30"), {
      year: 2026,
      month: 6,
      day: 25,
      hours: 14,
      minutes: 30,
    })
    assert.equal(parseLocalDateTimeFields("bad", "14:30"), null)
  })

  it("localDateTimeToUtcIso round-trips through utcIsoToLocalDateTimeFields", () => {
    const iso = localDateTimeToUtcIso("2026-06-25", "10:00")
    const parts = utcIsoToLocalDateTimeFields(iso)
    assert.ok(parts)
    assert.equal(parts.date, "2026-06-25")
    assert.equal(parts.time, "10:00")
  })

  it("getLocalDateString uses local calendar not UTC midnight", () => {
    const dt = new Date(2026, 5, 25, 23, 45, 0)
    assert.equal(getLocalDateString(dt), "2026-06-25")
    assert.equal(getLocalTimeString(dt), "23:45")
  })
})
