import { describe, expect, it } from 'vitest'
import { computeInvoiceTotals, suggestExpenseCategory } from '@/lib/ap/po-invoice-utils'
import { POPurpose, PurchaseOrderType } from '@/types/purchase-orders'

describe('po-invoice-utils', () => {
  it('computes tax and total from subtotal', () => {
    expect(computeInvoiceTotals({ subtotal: 1000, vat_rate: 0.16 })).toMatchObject({
      taxable_base: 1000,
      tax: 160,
      total: 1160,
    })
  })

  it('applies discount and retentions', () => {
    const result = computeInvoiceTotals({
      subtotal: 1000,
      discount_amount: 100,
      vat_rate: 0.16,
      retention_isr_rate: 0.1,
      retention_iva_rate: 0.04,
    })
    expect(result.taxable_base).toBe(900)
    expect(result.tax).toBe(144)
    expect(result.retention_isr_amount).toBe(90)
    expect(result.retention_iva_amount).toBeCloseTo(5.76, 2)
    expect(result.total).toBeCloseTo(948.24, 2)
  })

  it('suggests servicio_externo for direct service POs', () => {
    expect(
      suggestExpenseCategory({ po_type: PurchaseOrderType.DIRECT_SERVICE }),
    ).toBe('servicio_externo')
  })

  it('suggests mano_obra when receipt is labor', () => {
    expect(
      suggestExpenseCategory({ receipt_expense_type: 'labor' }),
    ).toBe('mano_obra')
  })

  it('suggests refacciones for inventory restock', () => {
    expect(
      suggestExpenseCategory({ po_purpose: POPurpose.INVENTORY_RESTOCK }),
    ).toBe('refacciones')
  })
})
