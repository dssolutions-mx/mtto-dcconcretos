import type { SupabaseClient } from '@supabase/supabase-js'

type QuotationRow = {
  id: string
  purchase_order_id: string
  quoted_amount: number
  supplier_name: string
  supplier_id: string | null
  quotation_items: unknown
}

/**
 * When a selected quotation is updated, mirror key fields onto the purchase order
 * (same data select_quotation writes on selection).
 */
export async function syncPurchaseOrderFromSelectedQuotation(
  supabase: SupabaseClient,
  quotation: QuotationRow
): Promise<void> {
  const quotationItems = quotation.quotation_items
  const hasLineItems =
    quotationItems != null &&
    Array.isArray(quotationItems) &&
    quotationItems.length > 0

  const baseUpdate = {
    total_amount: quotation.quoted_amount,
    approval_amount: quotation.quoted_amount,
    approval_amount_source: 'selected_quotation',
    selected_quotation_id: quotation.id,
    supplier: quotation.supplier_name,
    supplier_id: quotation.supplier_id,
    updated_at: new Date().toISOString(),
  }

  if (hasLineItems) {
    const updatedItems = (quotationItems as Record<string, unknown>[]).map((row) => {
      const item: Record<string, unknown> = {
        name: row.description,
        partNumber: row.part_number,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_price: row.total_price,
        quoted_unit_price: row.unit_price,
        brand: row.brand,
        notes: row.notes,
      }
      if (row.part_id != null) {
        item.part_id = row.part_id
      }
      return item
    })

    const { error } = await supabase
      .from('purchase_orders')
      .update({ ...baseUpdate, items: updatedItems })
      .eq('id', quotation.purchase_order_id)

    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update(baseUpdate)
    .eq('id', quotation.purchase_order_id)

  if (error) {
    throw new Error(error.message)
  }
}
