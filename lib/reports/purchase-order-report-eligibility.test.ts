import test from "node:test"
import assert from "node:assert/strict"

import { shouldIncludePurchaseOrderInExpenseReport } from "./purchase-order-report-eligibility"

test("excludes draft and rejected purchase orders", () => {
  assert.equal(shouldIncludePurchaseOrderInExpenseReport({ status: "draft" }), false)
  assert.equal(shouldIncludePurchaseOrderInExpenseReport({ status: "rejected" }), false)
})

test("includes approved and post-approval operational statuses", () => {
  for (const status of [
    "approved",
    "purchased",
    "receipt_uploaded",
    "ordered",
    "received",
    "fulfilled",
    "validated",
  ]) {
    assert.equal(shouldIncludePurchaseOrderInExpenseReport({ status }), true, `expected ${status} to count`)
  }
})

test("excludes pending approval even after technical approval", () => {
  assert.equal(shouldIncludePurchaseOrderInExpenseReport({ status: "pending_approval" }), false)
})

test("excludes raw pending approval before technical approval", () => {
  assert.equal(shouldIncludePurchaseOrderInExpenseReport({ status: "pending_approval" }), false)
})
