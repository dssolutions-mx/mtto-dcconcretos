import test from "node:test"
import assert from "node:assert/strict"

import { PaymentMethod, PurchaseOrderType } from "@/types/purchase-orders"

import { buildServerRoutingContextInput } from "./server-routing-seed"

test("uses server-normalized totals and resolved work-order type instead of client canonical fields", () => {
  const request = {
    work_order_id: "wo-99",
    po_type: PurchaseOrderType.DIRECT_PURCHASE,
    work_order_type: "corrective" as const,
    approval_amount: 999999,
    supplier: "Proveedor",
    items: [
      { fulfill_from: "purchase" as const, total_price: 1800 },
    ],
    total_amount: 1800,
    payment_method: PaymentMethod.CASH,
    quotation_amounts: [7000],
    quotation_payment_terms: ["30_days"],
  }

  const routingInput = buildServerRoutingContextInput(request, "preventive")

  assert.deepEqual(routingInput, {
    poType: PurchaseOrderType.DIRECT_PURCHASE,
    workOrderId: "wo-99",
    workOrderType: "preventive",
    totalAmount: 1800,
    paymentMethod: PaymentMethod.CASH,
    supplierPaymentTerms: undefined,
    quotationAmounts: [7000],
    quotationPaymentTerms: ["30_days"],
    items: [
      { fulfill_from: "purchase", total_price: 1800 },
    ],
  })
})
