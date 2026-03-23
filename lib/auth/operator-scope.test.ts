import test from "node:test"
import assert from "node:assert/strict"

import {
  operatorRowVisibleToJun,
  operatorRowVisibleToJp,
  validateJunJpCreatePlacement,
} from "./operator-scope"

test("operatorRowVisibleToJun includes unassigned and BU/plant-in-BU rows", () => {
  const bu = "bu-1"
  const plants = ["p1", "p2"]
  assert.equal(operatorRowVisibleToJun({ plant_id: null, business_unit_id: null }, bu, plants), true)
  assert.equal(operatorRowVisibleToJun({ plant_id: null, business_unit_id: bu }, bu, plants), true)
  assert.equal(operatorRowVisibleToJun({ plant_id: "p1", business_unit_id: "other" }, bu, plants), true)
  assert.equal(operatorRowVisibleToJun({ plant_id: "px", business_unit_id: "other" }, bu, plants), false)
})

test("operatorRowVisibleToJp is plant-exact", () => {
  assert.equal(operatorRowVisibleToJp({ plant_id: "p1", business_unit_id: "bu" }, "p1"), true)
  assert.equal(operatorRowVisibleToJp({ plant_id: "p2", business_unit_id: "bu" }, "p1"), false)
})

test("validateJunJpCreatePlacement rejects JP wrong plant", () => {
  const actor = {
    userId: "u1",
    profile: { role: "JEFE_PLANTA" as const, business_unit_id: "bu", plant_id: "p1" },
  }
  const bad = validateJunJpCreatePlacement(actor, "p2", "bu", "bu")
  assert.equal(bad.ok, false)
  const good = validateJunJpCreatePlacement(actor, "p1", "bu", "bu")
  assert.equal(good.ok, true)
})

test("validateJunJpCreatePlacement requires JUN BU match", () => {
  const actor = {
    userId: "u2",
    profile: { role: "JEFE_UNIDAD_NEGOCIO" as const, business_unit_id: "bu-a", plant_id: null },
  }
  assert.equal(
    validateJunJpCreatePlacement(actor, null, "bu-b", null).ok,
    false
  )
  assert.equal(validateJunJpCreatePlacement(actor, null, "bu-a", null).ok, true)
})
