import test from "node:test"
import assert from "node:assert/strict"

import { classifyIssueTheme } from "./issue-theme-taxonomy"

test("classifyIssueTheme: lighting items", () => {
  assert.equal(classifyIssueTheme("LUZ ALTA - no funciona"), "lighting_signaling")
  assert.equal(classifyIssueTheme("ALARMA DE REVERSA"), "lighting_signaling")
})

test("classifyIssueTheme: lubrication items", () => {
  assert.equal(classifyIssueTheme("ENGRASADO"), "lubrication")
  assert.equal(classifyIssueTheme("NIVEL DE ACEITE DE MOTOR"), "lubrication")
})

test("classifyIssueTheme: bodywork items", () => {
  assert.equal(classifyIssueTheme("CARROCERÍA EN BUEN ESTADO"), "bodywork_access")
  assert.equal(classifyIssueTheme("ESCALERA"), "bodywork_access")
})

test("classifyIssueTheme: visibility items", () => {
  assert.equal(classifyIssueTheme("CÁMARAS FUNCIONAN"), "visibility")
})

test("classifyIssueTheme: falls back to other", () => {
  assert.equal(classifyIssueTheme("ITEM DESCONOCIDO"), "other")
})
