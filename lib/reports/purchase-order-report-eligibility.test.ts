import test from "node:test"
import assert from "node:assert/strict"

import { shouldIncludePurchaseOrderInExpenseReport } from "./purchase-order-report-eligibility"

test("excludes draft and rejected purchase orders", () => {
  assert.equal(
    shouldIncludePurchaseOrderInExpenseReport({ status: "draft", authorized_by: null }),
    false
  )
  assert.equal(
    shouldIncludePurchaseOrderInExpenseReport({ status: "rejected", authorized_by: "user-1" }),
    false
  )
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
    assert.equal(
      shouldIncludePurchaseOrderInExpenseReport({ status, authorized_by: null }),
      true,
      `expected ${status} to count`
    )
  }
})

test("excludes pending approval even after technical approval", () => {
  assert.equal(
    shouldIncludePurchaseOrderInExpenseReport({
      status: "pending_approval",
      authorized_by: "tech-user",
    }),
    false
  )
})

test("excludes raw pending approval before technical approval", () => {
  assert.equal(
    shouldIncludePurchaseOrderInExpenseReport({
      status: "pending_approval",
      authorized_by: null,
    }),
    false
  )
})
