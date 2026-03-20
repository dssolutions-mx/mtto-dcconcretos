import test from "node:test"
import assert from "node:assert/strict"

import { splitPoLineTotalsByFulfillFrom } from "./po-line-amounts"

test("splits mixed fulfill_from lines", () => {
  const items = [
    { fulfill_from: "inventory", total_price: 100, quantity: 1, unit_price: 100 },
    { fulfill_from: "purchase", total_price: 250, quantity: 2, unit_price: 125 },
  ]
  const r = splitPoLineTotalsByFulfillFrom(items)
  assert.equal(r.inventoryTotal, 100)
  assert.equal(r.purchaseTotal, 250)
  assert.equal(r.inventoryLineCount, 1)
  assert.equal(r.purchaseLineCount, 1)
})

test("treats missing fulfill_from as purchase", () => {
  const items = [{ quantity: 2, unit_price: 50 }]
  const r = splitPoLineTotalsByFulfillFrom(items)
  assert.equal(r.purchaseTotal, 100)
  assert.equal(r.inventoryTotal, 0)
})
