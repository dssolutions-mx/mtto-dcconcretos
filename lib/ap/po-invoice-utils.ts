import type { PoExpenseCategory } from '@/types/po-invoices'
import { POPurpose, PurchaseOrderType } from '@/types/purchase-orders'

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export interface InvoiceTotalsInput {
  subtotal: number
  discount_amount?: number
  vat_rate?: number
  retention_isr_rate?: number
  retention_iva_rate?: number
}

export interface InvoiceTotalsResult {
  taxable_base: number
  tax: number
  retention_isr_amount: number
  retention_iva_amount: number
  total: number
}

export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotalsResult {
  const subtotal = roundMoney(Number(input.subtotal) || 0)
  const discount = roundMoney(Number(input.discount_amount) || 0)
  const vatRate = Number(input.vat_rate ?? 0.16)
  const isrRate = Number(input.retention_isr_rate ?? 0)
  const ivaRetRate = Number(input.retention_iva_rate ?? 0)

  const taxable_base = roundMoney(Math.max(subtotal - discount, 0))
  const tax = roundMoney(taxable_base * vatRate)
  const retention_isr_amount = roundMoney(taxable_base * isrRate)
  const retention_iva_amount = roundMoney(tax * ivaRetRate)
  const total = roundMoney(taxable_base + tax - retention_isr_amount - retention_iva_amount)

  return {
    taxable_base,
    tax,
    retention_isr_amount,
    retention_iva_amount,
    total,
  }
}

/** @deprecated Use computeInvoiceTotals */
export function computeInvoiceTax(subtotal: number, vatRate = 0.16): { tax: number; total: number } {
  const result = computeInvoiceTotals({ subtotal, vat_rate: vatRate })
  return { tax: result.tax, total: result.total }
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

export function formatMxCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(amount)
}
