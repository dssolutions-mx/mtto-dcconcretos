import {
  PaymentMethod,
  POPurpose,
  PurchaseOrderApprovalAmountSource,
  PurchaseOrderPaymentCondition,
  PurchaseOrderType,
  PurchaseOrderWorkOrderType,
} from "@/types/purchase-orders"

import {
  resolvePaymentCondition,
  type ResolvePaymentConditionInput,
} from "./payment-condition"

export type PurchaseOrderRequesterScope = "work_order" | "plant"

export interface RoutingContextItemInput {
  fulfill_from?: "inventory" | "purchase" | null
  total_price?: number | null
}

export interface BuildPurchaseOrderRoutingContextInput
  extends ResolvePaymentConditionInput {
  poType: PurchaseOrderType
  workOrderId?: string | null
  workOrderType?: string | null
  totalAmount?: number | null
  selectedQuotationAmount?: number | null
  quotationAmounts?: Array<number | null | undefined>
  items?: RoutingContextItemInput[]
}

export interface PurchaseOrderRoutingContext {
  poPurpose: POPurpose
  workOrderType: PurchaseOrderWorkOrderType | null
  approvalAmount: number
  approvalAmountSource: PurchaseOrderApprovalAmountSource
  paymentCondition: PurchaseOrderPaymentCondition
  requesterScope: PurchaseOrderRequesterScope
  requiresQuotation: boolean
}

function normalizeAmount(value?: number | null): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

export function normalizeWorkOrderType(
  workOrderType?: string | null
): PurchaseOrderWorkOrderType | null {
  if (!workOrderType) {
    return null
  }

  const normalized = workOrderType
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (normalized === "preventive" || normalized === "preventivo") {
    return "preventive"
  }

  if (normalized === "corrective" || normalized === "correctivo") {
    return "corrective"
  }

  return null
}

function summarizeItems(items: RoutingContextItemInput[] = []) {
  return items.reduce(
    (summary, item) => {
      const total = normalizeAmount(item.total_price)
      const fulfillFrom = item.fulfill_from ?? "purchase"

      summary.fullTotal += total

      if (fulfillFrom === "inventory") {
        summary.inventoryCount += 1
        return summary
      }

      summary.purchaseCount += 1
      summary.purchaseTotal += total
      return summary
    },
    {
      fullTotal: 0,
      purchaseTotal: 0,
      inventoryCount: 0,
      purchaseCount: 0,
    }
  )
}

export function resolvePoPurpose(
  poType: PurchaseOrderType,
  workOrderId?: string | null,
  items: RoutingContextItemInput[] = []
): POPurpose {
  if (!workOrderId) {
    return poType === PurchaseOrderType.DIRECT_SERVICE
      ? POPurpose.WORK_ORDER_CASH
      : POPurpose.INVENTORY_RESTOCK
  }

  if (items.length === 0) {
    return POPurpose.WORK_ORDER_CASH
  }

  const summary = summarizeItems(items)

  if (poType === PurchaseOrderType.SPECIAL_ORDER) {
    if (summary.purchaseCount > 0 && summary.inventoryCount > 0) {
      return POPurpose.MIXED
    }

    return POPurpose.WORK_ORDER_CASH
  }

  if (summary.inventoryCount === items.length) {
    return POPurpose.WORK_ORDER_INVENTORY
  }

  if (summary.purchaseCount === items.length) {
    return POPurpose.WORK_ORDER_CASH
  }

  return POPurpose.MIXED
}

export function isQuotationRequired(
  poType: PurchaseOrderType,
  approvalAmount: number,
  poPurpose: POPurpose
): boolean {
  if (poPurpose === POPurpose.WORK_ORDER_INVENTORY) {
    return false
  }

  if (poType === PurchaseOrderType.SPECIAL_ORDER) {
    return true
  }

  if (
    poType === PurchaseOrderType.DIRECT_PURCHASE ||
    poType === PurchaseOrderType.DIRECT_SERVICE
  ) {
    return approvalAmount >= 5000
  }

  return false
}

function resolveApprovalAmount(
  input: BuildPurchaseOrderRoutingContextInput,
  poPurpose: POPurpose
): {
  approvalAmount: number
  approvalAmountSource: PurchaseOrderApprovalAmountSource
} {
  const selectedQuotationAmount = normalizeAmount(input.selectedQuotationAmount)

  if (selectedQuotationAmount > 0) {
    return {
      approvalAmount: selectedQuotationAmount,
      approvalAmountSource:
        PurchaseOrderApprovalAmountSource.SELECTED_QUOTATION,
    }
  }

  const hasWorkOrderAndItems =
    input.workOrderId && input.items && input.items.length > 0
  if (hasWorkOrderAndItems) {
    const summary = summarizeItems(input.items)

    // Inventory-only: all items from inventory, use fullTotal for approval
    if (
      poPurpose === POPurpose.WORK_ORDER_INVENTORY &&
      summary.fullTotal > 0
    ) {
      return {
        approvalAmount: summary.fullTotal,
        approvalAmountSource: PurchaseOrderApprovalAmountSource.ITEMS_TOTAL,
      }
    }

    // Mixed or purchase-only: use purchase total for approval when items have fulfill_from split
    if (
      (input.poType === PurchaseOrderType.DIRECT_PURCHASE ||
        input.poType === PurchaseOrderType.SPECIAL_ORDER) &&
      summary.purchaseCount > 0
    ) {
      if (summary.purchaseTotal > 0) {
        return {
          approvalAmount: summary.purchaseTotal,
          approvalAmountSource:
            PurchaseOrderApprovalAmountSource.PURCHASE_ITEMS_TOTAL,
        }
      }

      if (summary.fullTotal > 0) {
        return {
          approvalAmount: summary.fullTotal,
          approvalAmountSource: PurchaseOrderApprovalAmountSource.ITEMS_TOTAL,
        }
      }
    }
  }

  return {
    approvalAmount: normalizeAmount(input.totalAmount),
    approvalAmountSource: PurchaseOrderApprovalAmountSource.REQUEST_TOTAL,
  }
}

export function buildPurchaseOrderRoutingContext(
  input: BuildPurchaseOrderRoutingContextInput
): PurchaseOrderRoutingContext {
  const poPurpose = resolvePoPurpose(input.poType, input.workOrderId, input.items)
  const paymentCondition = resolvePaymentCondition({
    paymentMethod: input.paymentMethod ?? PaymentMethod.CASH,
    supplierPaymentTerms: input.supplierPaymentTerms,
    selectedQuotationPaymentTerm: input.selectedQuotationPaymentTerm,
    quotationPaymentTerms: input.quotationPaymentTerms,
  })
  const { approvalAmount, approvalAmountSource } = resolveApprovalAmount(
    input,
    poPurpose
  )

  return {
    poPurpose,
    workOrderType: normalizeWorkOrderType(input.workOrderType),
    approvalAmount,
    approvalAmountSource,
    paymentCondition,
    requesterScope: input.workOrderId ? "work_order" : "plant",
    requiresQuotation: isQuotationRequired(
      input.poType,
      approvalAmount,
      poPurpose
    ),
  }
}
