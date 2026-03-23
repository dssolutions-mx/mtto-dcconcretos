type PurchaseOrderExpenseEligibilityInput = {
  status: string | null | undefined
  authorized_by: string | null | undefined
}

export function shouldIncludePurchaseOrderInExpenseReport(
  input: PurchaseOrderExpenseEligibilityInput
): boolean {
  const status = String(input.status ?? "").trim().toLowerCase()

  if (!status || status === "draft" || status === "rejected" || status === "pending_approval") {
    return false
  }

  return true
}
