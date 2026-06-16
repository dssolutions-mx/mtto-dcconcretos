import { describe, expect, it } from "vitest"
import {
  groupIncidentsByPipelineStage,
  hoursSince,
  isOpenIncidentStatus,
  isSlaBreached,
} from "./incident-routing"

describe("incident-routing", () => {
  it("detects open incident statuses", () => {
    expect(isOpenIncidentStatus("Abierto")).toBe(true)
    expect(isOpenIncidentStatus("resuelto")).toBe(false)
  })

  it("flags SLA breach when elapsed exceeds target", () => {
    const routedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    expect(isSlaBreached(routedAt, 24, "Abierto")).toBe(true)
    expect(isSlaBreached(routedAt, 24, "resuelto")).toBe(false)
  })

  it("groups incidents by pipeline stage", () => {
    const grouped = groupIncidentsByPipelineStage([
      { id: "1", pipeline_stage: "bandeja" },
      { id: "2", pipeline_stage: "asignado" },
      { id: "3", pipeline_stage: "unknown" },
    ])
    expect(grouped.bandeja).toHaveLength(2)
    expect(grouped.asignado).toHaveLength(1)
  })

  it("computes hours since timestamp", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const hours = hoursSince(twoHoursAgo)
    expect(hours).toBeGreaterThanOrEqual(1)
    expect(hours).toBeLessThanOrEqual(3)
  })
})
