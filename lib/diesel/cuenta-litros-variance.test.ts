import test from "node:test"
import assert from "node:assert/strict"

import {
  computeCuentaLitrosVariance,
  CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS,
  shouldRequireValidationForCuentaLitrosVariance,
} from "./cuenta-litros-variance"

test("computeCuentaLitrosVariance accepts exact match", () => {
  const result = computeCuentaLitrosVariance(382_049, 382_276, 227)
  assert.equal(result.movement, 227)
  assert.equal(result.variance, 0)
  assert.equal(result.withinTolerance, true)
})

test("computeCuentaLitrosVariance accepts 1L difference within ±2L tolerance", () => {
  const result = computeCuentaLitrosVariance(382_049, 382_277, 227)
  assert.equal(result.movement, 228)
  assert.equal(result.variance, 1)
  assert.equal(result.withinTolerance, true)
})

test("computeCuentaLitrosVariance accepts 2L difference at inclusive boundary", () => {
  const result = computeCuentaLitrosVariance(100, 122, 20)
  assert.equal(result.variance, 2)
  assert.equal(result.withinTolerance, true)
})

test("computeCuentaLitrosVariance rejects 3L difference above tolerance", () => {
  const result = computeCuentaLitrosVariance(100, 123, 20)
  assert.equal(result.variance, 3)
  assert.equal(result.withinTolerance, false)
})

test("shouldRequireValidationForCuentaLitrosVariance is false when within tolerance", () => {
  assert.equal(
    shouldRequireValidationForCuentaLitrosVariance(382_049, 382_277, 227),
    false,
  )
})

test("shouldRequireValidationForCuentaLitrosVariance is true when above tolerance", () => {
  assert.equal(
    shouldRequireValidationForCuentaLitrosVariance(100, 123, 20),
    true,
  )
})

test("shouldRequireValidationForCuentaLitrosVariance ignores missing previous reading", () => {
  assert.equal(
    shouldRequireValidationForCuentaLitrosVariance(null, 382_276, 227),
    false,
  )
})

test("default tolerance constant is 2 liters", () => {
  assert.equal(CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS, 2)
})
