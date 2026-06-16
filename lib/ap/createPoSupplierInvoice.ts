import type { SupabaseClient } from '@supabase/supabase-js'
import type { CreatePoSupplierInvoiceInput, PoSupplierInvoice } from '@/types/po-invoices'
import { computeInvoiceTax, roundMoney, suggestExpenseCategory } from '@/lib/ap/po-invoice-utils'

export type CreatePoSupplierInvoiceResult =
  | { ok: true; invoice: PoSupplierInvoice }
  | { ok: false; error: string; status: number }

export async function createPoSupplierInvoice(
  supabase: SupabaseClient,
  userId: string,
  purchaseOrderId: string,
  body: CreatePoSupplierInvoiceInput,
): Promise<CreatePoSupplierInvoiceResult> {
  const {
    invoice_number,
    invoice_date,
    due_date = null,
    subtotal: rawSubtotal,
    vat_rate = 0.16,
    expense_category: clientCategory,
    document_url = null,
    receipt_id = null,
    notes = null,
    items = [],
  } = body

  if (!invoice_number?.trim() || !invoice_date) {
    return { ok: false, error: 'Folio y fecha de factura son requeridos', status: 400 }
  }

  const subtotal = roundMoney(Number(rawSubtotal))
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false, error: 'El subtotal debe ser mayor a cero', status: 400 }
  }

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select('id, plant_id, supplier_id, po_type, po_purpose, status, accounting_status')
    .eq('id', purchaseOrderId)
    .single()

  if (poError || !po) {
    return { ok: false, error: 'Orden de compra no encontrada', status: 404 }
  }

  const allowedStatuses = [
    'approved',
    'purchased',
    'ordered',
    'receipt_uploaded',
    'received',
    'validated',
    'fulfilled',
  ]
  if (!allowedStatuses.includes(po.status ?? '')) {
    return {
      ok: false,
      error: 'La OC debe estar aprobada o en etapa posterior para registrar factura',
      status: 400,
    }
  }

  let receiptExpenseType: string | null = null
  if (receipt_id) {
    const { data: receipt } = await supabase
      .from('purchase_order_receipts')
      .select('id, expense_type, file_url')
      .eq('id', receipt_id)
      .eq('purchase_order_id', purchaseOrderId)
      .maybeSingle()

    if (!receipt) {
      return { ok: false, error: 'Comprobante no encontrado para esta OC', status: 400 }
    }
    receiptExpenseType = receipt.expense_type
  }

  const expense_category =
    clientCategory ??
    suggestExpenseCategory({
      po_type: po.po_type,
      po_purpose: po.po_purpose,
      receipt_expense_type: receiptExpenseType,
    })

  const { tax, total } = computeInvoiceTax(subtotal, vat_rate)

  const { data: invoice, error: insertError } = await supabase
    .from('po_supplier_invoices')
    .insert({
      purchase_order_id: purchaseOrderId,
      plant_id: po.plant_id,
      supplier_id: po.supplier_id,
      invoice_number: invoice_number.trim(),
      invoice_date,
      due_date,
      subtotal,
      vat_rate,
      tax,
      total,
      expense_category,
      po_purpose_snapshot: po.po_purpose,
      po_type_snapshot: po.po_type,
      document_url,
      receipt_id,
      notes,
      registered_by: userId,
      status: 'open',
    })
    .select('*')
    .single()

  if (insertError || !invoice) {
    const message = insertError?.message ?? 'Error al registrar factura'
    const status = insertError?.code === '23505' ? 409 : 500
    return {
      ok: false,
      error: status === 409 ? 'Ya existe una factura con ese folio para esta OC' : message,
      status,
    }
  }

  const normalizedItems =
    items.length > 0
      ? items
      : [{ description: `Factura ${invoice_number.trim()}`, amount: subtotal }]

  const itemRows = normalizedItems.map((item, index) => ({
    invoice_id: invoice.id,
    description: item.description?.trim() || `Línea ${index + 1}`,
    amount: roundMoney(Number(item.amount)),
    expense_type: item.expense_type ?? null,
    po_line_index: item.po_line_index ?? null,
  }))

  const { error: itemsError } = await supabase
    .from('po_supplier_invoice_items')
    .insert(itemRows)

  if (itemsError) {
    await supabase.from('po_supplier_invoices').delete().eq('id', invoice.id)
    return { ok: false, error: 'Error al guardar líneas de factura', status: 500 }
  }

  return {
    ok: true,
    invoice: {
      ...(invoice as PoSupplierInvoice),
      items: itemRows.map((row, i) => ({
        ...row,
        id: undefined,
        description: row.description,
        amount: row.amount,
      })),
    },
  }
}
