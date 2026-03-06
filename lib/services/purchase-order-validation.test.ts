import test from "node:test"
import assert from "node:assert/strict"

import { PurchaseOrderValidationService } from "./purchase-order-service"
import { PurchaseOrderType } from "@/types/purchase-orders"

test("allows quote-first special-order drafts without a pre-selection total", () => {
  const result = PurchaseOrderValidationService.validateCreateRequest({
    plant_id: "plant-1",
    po_type: PurchaseOrderType.SPECIAL_ORDER,
    supplier: "Proveedor por definir",
    items: [],
    total_amount: 0,
    quotation_amounts: [25000],
  })

  assert.equal(result.isValid, true)
  assert.deepEqual(result.errors, [])
})
