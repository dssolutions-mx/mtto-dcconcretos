import type { PoExpenseCategory } from '@/types/po-invoices'
import { POPurpose, PurchaseOrderType } from '@/types/purchase-orders'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeInvoiceTax(subtotal: number, vatRate = 0.16): { tax: number; total: number } {
  const tax = roundMoney(subtotal * vatRate)
  const total = roundMoney(subtotal + tax)
  return { tax, total }
}

export function suggestExpenseCategory(input: {
  po_type?: string | null
  po_purpose?: string | null
  receipt_expense_type?: string | null
}): PoExpenseCategory {
  if (input.po_type === PurchaseOrderType.DIRECT_SERVICE) {
    return 'servicio_externo'
  }
  if (input.receipt_expense_type === 'labor') {
    return 'mano_obra'
  }
  if (input.po_purpose === POPurpose.INVENTORY_RESTOCK) {
    return 'refacciones'
  }
  if (input.po_purpose === POPurpose.WORK_ORDER_CASH) {
    return 'refacciones'
  }
  return 'otros'
}
