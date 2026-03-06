import { PaymentMethod, PurchaseOrderPaymentCondition } from "@/types/purchase-orders"

export interface ResolvePaymentConditionInput {
  paymentMethod?: PaymentMethod | string | null
  supplierPaymentTerms?: string | null
  selectedQuotationPaymentTerm?: string | null
  quotationPaymentTerms?: Array<string | null | undefined>
}

const CASH_TERM_MATCHERS = ["cash", "immediate", "contado", "contra entrega"]

const CREDIT_TERM_MATCHERS = ["credit", "credito", "net "]

function normalizeTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function resolveConditionFromTerms(
  paymentTerms?: string | null
): PurchaseOrderPaymentCondition | null {
  if (!paymentTerms) {
    return null
  }

  const normalized = normalizeTerm(paymentTerms)

  if (!normalized) {
    return null
  }

  if (
    CASH_TERM_MATCHERS.some((matcher) => normalized.includes(matcher))
  ) {
    return PurchaseOrderPaymentCondition.CASH
  }

  if (
    CREDIT_TERM_MATCHERS.some((matcher) => normalized.includes(matcher)) ||
    /\b\d+\s*(day|days|dia|dias)\b/.test(normalized) ||
    normalized.endsWith("_days")
  ) {
    return PurchaseOrderPaymentCondition.CREDIT
  }

  return null
}

function resolveConditionFromPaymentMethod(
  paymentMethod?: PaymentMethod | string | null
): PurchaseOrderPaymentCondition {
  switch (paymentMethod) {
    case PaymentMethod.TRANSFER:
      return PurchaseOrderPaymentCondition.CREDIT
    case PaymentMethod.CASH:
    case PaymentMethod.CARD:
    default:
      return PurchaseOrderPaymentCondition.CASH
  }
}

export function resolvePaymentCondition(
  input: ResolvePaymentConditionInput
): PurchaseOrderPaymentCondition {
  const fromSelectedQuotation = resolveConditionFromTerms(
    input.selectedQuotationPaymentTerm
  )

  if (fromSelectedQuotation) {
    return fromSelectedQuotation
  }

  const fromSupplier = resolveConditionFromTerms(input.supplierPaymentTerms)

  if (fromSupplier) {
    return fromSupplier
  }

  return resolveConditionFromPaymentMethod(input.paymentMethod)
}
