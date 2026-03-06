import type { BuildPurchaseOrderRoutingContextInput } from "./routing-context"

import type { CreatePurchaseOrderRequest } from "@/types/purchase-orders"

type RoutingContextItem = {
  fulfill_from?: "inventory" | "purchase" | null
  total_price?: number | null
}

function toRoutingContextItems(items: unknown[]): RoutingContextItem[] {
  return items.map((item) => {
    const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
    return {
      fulfill_from:
        obj.fulfill_from === "inventory" || obj.fulfill_from === "purchase"
          ? obj.fulfill_from
          : null,
      total_price: typeof obj.total_price === "number" ? obj.total_price : null,
    }
  })
}

export function buildServerRoutingContextInput(
  request: CreatePurchaseOrderRequest,
  resolvedWorkOrderType?: CreatePurchaseOrderRequest["work_order_type"]
): BuildPurchaseOrderRoutingContextInput {
  return {
    poType: request.po_type,
    workOrderId: request.work_order_id,
    workOrderType: resolvedWorkOrderType,
    totalAmount: request.total_amount,
    paymentMethod: request.payment_method,
    supplierPaymentTerms: request.supplier_payment_terms,
    quotationAmounts: request.quotation_amounts,
    quotationPaymentTerms: request.quotation_payment_terms,
    items: toRoutingContextItems(request.items ?? []),
  }
}
