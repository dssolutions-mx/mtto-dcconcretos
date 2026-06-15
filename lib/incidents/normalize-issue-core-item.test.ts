import test from "node:test"
import assert from "node:assert/strict"

import {
  generateCanonicalIssueKey,
  normalizeIssueCoreItem,
} from "./normalize-issue-core-item"

test("normalizeIssueCoreItem strips observation suffix after dash", () => {
  assert.equal(normalizeIssueCoreItem("LLANTAS EN BUEN ESTADO - Llanta 10"), "LLANTAS")
  assert.equal(
    normalizeIssueCoreItem("TESTIGOS APAGADOS - Solo los de informacion"),
    "TESTIGOS APAGADOS",
  )
})

test("normalizeIssueCoreItem collapses whitespace and casing", () => {
  assert.equal(normalizeIssueCoreItem("  llantas   en buen estado  "), "LLANTAS")
})

test("normalizeIssueCoreItem unifies escalera checklist variants", () => {
  assert.equal(normalizeIssueCoreItem("ESCALERA - Con golpes"), "ESCALERA")
  assert.equal(
    normalizeIssueCoreItem("ESCALERA EN BUEN ESTADO - Se ocupa soldar"),
    "ESCALERA",
  )
})

test("normalizeIssueCoreItem unifies cameras checklist variants", () => {
  assert.equal(
    normalizeIssueCoreItem("Cámaras funcionan - No prenden"),
    "CÁMARAS",
  )
  assert.equal(normalizeIssueCoreItem("CÁMARAS FUNCIONAN"), "CÁMARAS")
})

test("generateCanonicalIssueKey combines asset id and normalized label", () => {
  const assetId = "e3e8c32b-8111-4970-8d57-b43bfb6ad0e4"
  assert.equal(
    generateCanonicalIssueKey(assetId, "ESCALERA EN BUEN ESTADO - soldar"),
    `${assetId}_ESCALERA`,
  )
  assert.equal(
    generateCanonicalIssueKey(assetId, "ESCALERA - fisura"),
    `${assetId}_ESCALERA`,
  )
})
