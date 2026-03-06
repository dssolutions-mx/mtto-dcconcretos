import test from "node:test"
import assert from "node:assert/strict"

import { PurchaseOrderType, PaymentMethod } from "@/types/purchase-orders"

import { buildPurchaseOrderRoutingContext } from "./routing-context"

test("builds an inventory-only preventive work order context", () => {
  const context = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.DIRECT_PURCHASE,
    workOrderId: "wo-1",
    workOrderType: "preventive",
    paymentMethod: PaymentMethod.CASH,
    totalAmount: 2200,
    items: [
      { fulfill_from: "inventory", total_price: 1200 },
      { fulfill_from: "inventory", total_price: 1000 },
    ],
  })

  assert.deepEqual(context, {
    poPurpose: "work_order_inventory",
    workOrderType: "preventive",
    approvalAmount: 2200,
    approvalAmountSource: "items_total",
    paymentCondition: "cash",
    requesterScope: "work_order",
    requiresQuotation: false,
  })
})

test("uses the purchase-only total for mixed direct purchases without quotations", () => {
  const context = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.DIRECT_PURCHASE,
    workOrderId: "wo-2",
    workOrderType: "corrective",
    paymentMethod: PaymentMethod.CASH,
    totalAmount: 8200,
    items: [
      { fulfill_from: "inventory", total_price: 2200 },
      { fulfill_from: "purchase", total_price: 4800 },
      { total_price: 800 },
    ],
  })

  assert.deepEqual(context, {
    poPurpose: "mixed",
    workOrderType: "corrective",
    approvalAmount: 5600,
    approvalAmountSource: "purchase_items_total",
    paymentCondition: "cash",
    requesterScope: "work_order",
    requiresQuotation: true,
  })
})

test("does not let quotation list order define canonical amount before selection", () => {
  const context = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.DIRECT_PURCHASE,
    workOrderId: "wo-3",
    workOrderType: "corrective",
    paymentMethod: PaymentMethod.CASH,
    totalAmount: 4000,
    quotationAmounts: [7350, 7100],
    quotationPaymentTerms: ["30_days", "cash"],
    items: [
      { fulfill_from: "purchase", total_price: 4000 },
    ],
  })

  assert.deepEqual(context, {
    poPurpose: "work_order_cash",
    workOrderType: "corrective",
    approvalAmount: 4000,
    approvalAmountSource: "purchase_items_total",
    paymentCondition: "cash",
    requesterScope: "work_order",
    requiresQuotation: false,
  })
})

test("keeps standalone special orders in inventory restock scope", () => {
  const context = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.SPECIAL_ORDER,
    paymentMethod: PaymentMethod.TRANSFER,
    totalAmount: 9200,
  })

  assert.deepEqual(context, {
    poPurpose: "inventory_restock",
    workOrderType: null,
    approvalAmount: 9200,
    approvalAmountSource: "request_total",
    paymentCondition: "credit",
    requesterScope: "plant",
    requiresQuotation: true,
  })
})

test("keeps work-order special orders in quote-required routing even if items are marked as inventory", () => {
  const context = buildPurchaseOrderRoutingContext({
    poType: PurchaseOrderType.SPECIAL_ORDER,
    workOrderId: "wo-4",
    workOrderType: "preventive",
    paymentMethod: PaymentMethod.TRANSFER,
    totalAmount: 1800,
    items: [
      { fulfill_from: "inventory", total_price: 1800 },
    ],
  })

  assert.deepEqual(context, {
    poPurpose: "work_order_cash",
    workOrderType: "preventive",
    approvalAmount: 1800,
    approvalAmountSource: "request_total",
    paymentCondition: "credit",
    requesterScope: "work_order",
    requiresQuotation: true,
  })
})
