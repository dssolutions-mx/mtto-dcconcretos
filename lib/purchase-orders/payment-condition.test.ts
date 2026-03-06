import test from "node:test"
import assert from "node:assert/strict"

import { resolvePaymentCondition } from "./payment-condition"

test("ignores unselected quotation terms and falls back to payment method", () => {
  const condition = resolvePaymentCondition({
    paymentMethod: "cash",
    quotationPaymentTerms: ["30_days"],
  })

  assert.equal(condition, "cash")
})

test("resolves cash from supplier metadata when terms are immediate", () => {
  const condition = resolvePaymentCondition({
    paymentMethod: "transfer",
    supplierPaymentTerms: "immediate",
  })

  assert.equal(condition, "cash")
})

test("prefers supplier metadata over unselected quotation terms", () => {
  const condition = resolvePaymentCondition({
    paymentMethod: "cash",
    supplierPaymentTerms: "30_days",
    quotationPaymentTerms: ["cash"],
  })

  assert.equal(condition, "credit")
})

test("falls back to credit when metadata is missing and payment is transfer", () => {
  const condition = resolvePaymentCondition({
    paymentMethod: "transfer",
  })

  assert.equal(condition, "credit")
})

test("falls back to cash when metadata is missing and payment is card", () => {
  const condition = resolvePaymentCondition({
    paymentMethod: "card",
  })

  assert.equal(condition, "cash")
})
