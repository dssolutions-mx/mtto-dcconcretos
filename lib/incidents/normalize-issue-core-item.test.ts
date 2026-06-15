import { describe, expect, it } from "vitest"
import {
  generateCanonicalIssueKey,
  normalizeIssueCoreItem,
} from "./normalize-issue-core-item"

describe("normalizeIssueCoreItem", () => {
  it("strips observation suffix after dash", () => {
    expect(normalizeIssueCoreItem("LLANTAS EN BUEN ESTADO - Llanta 10")).toBe(
      "LLANTAS EN BUEN ESTADO",
    )
    expect(
      normalizeIssueCoreItem("TESTIGOS APAGADOS - Solo los de informacion"),
    ).toBe("TESTIGOS APAGADOS")
  })

  it("collapses whitespace and casing", () => {
    expect(normalizeIssueCoreItem("  llantas   en buen estado  ")).toBe(
      "LLANTAS EN BUEN ESTADO",
    )
  })
})

describe("generateCanonicalIssueKey", () => {
  it("combines asset id and normalized label", () => {
    const assetId = "e3e8c32b-8111-4970-8d57-b43bfb6ad0e4"
    expect(
      generateCanonicalIssueKey(assetId, "Cámaras funcionan - No prenden"),
    ).toBe(`${assetId}_CÁMARAS FUNCIONAN`)
  })
})
