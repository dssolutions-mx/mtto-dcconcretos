import { describe, expect, it } from 'vitest'
import { computeInvoiceTax, suggestExpenseCategory } from '@/lib/ap/po-invoice-utils'
import { POPurpose, PurchaseOrderType } from '@/types/purchase-orders'

describe('po-invoice-utils', () => {
  it('computes tax and total from subtotal', () => {
    expect(computeInvoiceTax(1000, 0.16)).toEqual({ tax: 160, total: 1160 })
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
