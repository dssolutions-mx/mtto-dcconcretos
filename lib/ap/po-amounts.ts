import { computeInvoiceTotals, formatMxCurrency, roundMoney } from '@/lib/ap/po-invoice-utils'

export interface PoAmountContext {
  /** Monto de la OC sin IVA (autorizado). */
  po_pre_tax: number
  /** Subtotal factura sin IVA. */
  invoice_subtotal?: number
  discount_amount?: number
  vat_rate?: number
  retention_isr_rate?: number
  retention_iva_rate?: number
  /** Neto a pagar (con IVA, menos retenciones). */
  invoice_net_payable?: number
  /** Saldo pendiente de pago. */
  balance?: number
}

export function resolvePoPreTaxAmount(order: {
  actual_amount?: number | string | null
  approval_amount?: number | string | null
  total_amount?: number | string | null
}): number {
  const actual = Number(order.actual_amount)
  const approval = Number(order.approval_amount)
  const total = Number(order.total_amount)
  if (Number.isFinite(actual) && actual > 0) return roundMoney(actual)
  if (Number.isFinite(approval) && approval > 0) return roundMoney(approval)
  if (Number.isFinite(total) && total > 0) return roundMoney(total)
  return 0
}

export function buildInvoiceAmountContext(input: {
  po_pre_tax: number
  subtotal: number
  discount_amount?: number
  vat_rate?: number
  retention_isr_rate?: number
  retention_iva_rate?: number
  balance?: number
}): PoAmountContext {
  const totals = computeInvoiceTotals({
    subtotal: input.subtotal,
    discount_amount: input.discount_amount,
    vat_rate: input.vat_rate,
    retention_isr_rate: input.retention_isr_rate,
    retention_iva_rate: input.retention_iva_rate,
  })

  return {
    po_pre_tax: input.po_pre_tax,
    invoice_subtotal: input.subtotal,
    discount_amount: input.discount_amount,
    vat_rate: input.vat_rate,
    retention_isr_rate: input.retention_isr_rate,
    retention_iva_rate: input.retention_iva_rate,
    invoice_net_payable: totals.total,
    balance: input.balance,
  }
}

export function poInvoiceMismatchWarning(
  poPreTax: number,
  invoicePreTax: number,
  tolerance = 0.02,
  pctTolerance = 1.05,
): string | null {
  if (poPreTax <= 0 || invoicePreTax <= 0) return null
  if (invoicePreTax > poPreTax * pctTolerance) {
    return `La factura sin IVA (${formatMxCurrency(invoicePreTax)}) excede el monto de la OC sin IVA (${formatMxCurrency(poPreTax)}).`
  }
  if (Math.abs(invoicePreTax - poPreTax) > tolerance) {
    return `Diferencia entre factura sin IVA (${formatMxCurrency(invoicePreTax)}) y monto OC sin IVA (${formatMxCurrency(poPreTax)}).`
  }
  return null
}

export const PO_AMOUNT_LABELS = {
  po_pre_tax: 'Monto OC (sin IVA)',
  invoice_pre_tax: 'Base gravable factura (sin IVA)',
  vat: 'IVA',
  retentions: 'Retenciones',
  net_payable: 'Neto a pagar al proveedor',
  balance: 'Saldo pendiente',
} as const
