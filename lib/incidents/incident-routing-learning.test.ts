import { describe, expect, it } from "vitest"
import {
  aggregateRoutingSignals,
  buildRoutingPatternKey,
  computePatternConfidence,
  extractRoutingKeyword,
  inferSignalKind,
  scoreLearnedRulePriority,
} from "./incident-routing-learning"

describe("incident-routing-learning", () => {
  it("extracts routing keyword from checklist-style descriptions", () => {
    expect(extractRoutingKeyword("FUGA DE ACEITE - EN BUEN ESTADO")).toBe("fuga de aceite")
  })

  it("infers correction vs confirm signal kinds", () => {
    expect(inferSignalKind("dept-a", "dept-b")).toBe("correction")
    expect(inferSignalKind("dept-a", "dept-a")).toBe("confirm")
  })

  it("builds stable pattern keys", () => {
    const key = buildRoutingPatternKey({
      plant_id: "plant-1",
      incident_type: "Falla mecánica",
      description_keyword: "fuga de aceite",
      chosen_department_id: "dept-1",
    })
    expect(key).toBe("plant-1|falla mecánica|*|fuga de aceite|dept-1")
  })

  it("aggregates repeated decisions into promotable patterns", () => {
    const base = {
      plant_id: "p1",
      incident_type: "falla mecánica",
      incident_impact: null,
      description_keyword: "fuga de aceite",
      chosen_department_id: "d1",
      chosen_assignee_id: null,
      previous_department_id: null,
      previous_rule_id: null,
    }

    const signals = Array.from({ length: 4 }).map((_, i) => ({
      id: `s${i}`,
      incident_id: `i${i}`,
      signal_kind: (i === 0 ? "correction" : "confirm") as const,
      created_at: new Date().toISOString(),
      ...base,
    }))

    const patterns = aggregateRoutingSignals(signals)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].sample_count).toBe(4)
    expect(patterns[0].ready_to_promote).toBe(true)
  })

  it("scores higher confidence with more confirms", () => {
    const low = computePatternConfidence({
      sample_count: 3,
      correction_count: 2,
      confirm_count: 0,
    })
    const high = computePatternConfidence({
      sample_count: 3,
      correction_count: 0,
      confirm_count: 3,
    })
    expect(high).toBeGreaterThan(low)
  })

  it("prioritizes high-confidence learned rules", () => {
    expect(scoreLearnedRulePriority(0.95, 10)).toBeLessThan(scoreLearnedRulePriority(0.6, 3))
  })
})
