import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ProcurementActionQueueItem,
  ProcurementDashboard,
  RecordPoInvoicePaymentInput,
} from '@/types/po-invoices'
import { roundMoney } from '@/lib/ap/po-invoice-utils'

export async function recordPoInvoicePayment(
  supabase: SupabaseClient,
  userId: string,
  body: RecordPoInvoicePaymentInput,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { invoice_id, payment_date, amount: rawAmount, payment_method, reference, notes } = body

  if (!invoice_id || !payment_date) {
    return { ok: false, error: 'Factura y fecha de pago son requeridos', status: 400 }
  }

  const amount = roundMoney(Number(rawAmount))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'El monto debe ser mayor a cero', status: 400 }
  }

  const paymentDate = new Date(payment_date)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (paymentDate > today) {
    return { ok: false, error: 'La fecha de pago no puede ser futura', status: 400 }
  }

  const { data: invoice, error: invError } = await supabase
    .from('po_invoice_balances')
    .select('invoice_id, purchase_order_id, plant_id, balance, invoice_status, total')
    .eq('invoice_id', invoice_id)
    .single()

  if (invError || !invoice) {
    return { ok: false, error: 'Factura no encontrada', status: 404 }
  }

  if (invoice.invoice_status === 'paid') {
    return { ok: false, error: 'Esta factura ya está pagada', status: 400 }
  }

  if (invoice.invoice_status === 'void') {
    return { ok: false, error: 'No se pueden registrar pagos en facturas anuladas', status: 400 }
  }

  if (amount > Number(invoice.balance) + 0.01) {
    return {
      ok: false,
      error: `El monto excede el saldo pendiente (${invoice.balance})`,
      status: 400,
    }
  }

  const { error: insertError } = await supabase.from('po_invoice_payments').insert({
    invoice_id,
    purchase_order_id: invoice.purchase_order_id,
    plant_id: invoice.plant_id,
    payment_date,
    amount,
    payment_method: payment_method ?? null,
    reference: reference ?? null,
    notes: notes ?? null,
    recorded_by: userId,
  })

  if (insertError) {
    return { ok: false, error: insertError.message, status: 500 }
  }

  return { ok: true }
}

export async function fetchProcurementDashboard(
  supabase: SupabaseClient,
  plantId?: string | null,
): Promise<ProcurementDashboard> {
  let sinFacturaQuery = supabase.from('po_without_supplier_invoice').select('*')
  let balancesQuery = supabase.from('po_invoice_balances').select('*')

  if (plantId) {
    sinFacturaQuery = sinFacturaQuery.eq('plant_id', plantId)
    balancesQuery = balancesQuery.eq('plant_id', plantId)
  }

  const [{ data: sinFactura }, { data: balances }] = await Promise.all([
    sinFacturaQuery,
    balancesQuery,
  ])

  const sinFacturaRows = sinFactura ?? []
  const balanceRows = balances ?? []

  const openInvoices = balanceRows.filter((r) =>
    ['open', 'partially_paid'].includes(r.invoice_status),
  )
  const overdue = openInvoices.filter((r) => r.is_overdue)
  const partiallyPaid = balanceRows.filter((r) => r.invoice_status === 'partially_paid')

  const postApprovalPending = sinFacturaRows.filter((r) =>
    ['approved', 'purchased', 'ordered'].includes(r.po_status),
  )

  return {
    sin_factura_count: sinFacturaRows.length,
    sin_factura_amount: sinFacturaRows.reduce(
      (sum, r) => sum + Number(r.actual_amount ?? r.total_amount ?? 0),
      0,
    ),
    open_invoices_count: openInvoices.length,
    open_invoices_balance: openInvoices.reduce((sum, r) => sum + Number(r.balance ?? 0), 0),
    overdue_count: overdue.length,
    overdue_balance: overdue.reduce((sum, r) => sum + Number(r.balance ?? 0), 0),
    post_approval_pending_count: postApprovalPending.length,
    partially_paid_count: partiallyPaid.length,
  }
}

export async function fetchProcurementActionQueue(
  supabase: SupabaseClient,
  plantId?: string | null,
  limit = 20,
): Promise<ProcurementActionQueueItem[]> {
  const items: ProcurementActionQueueItem[] = []

  let overdueQuery = supabase
    .from('po_invoice_balances')
    .select('*')
    .eq('is_overdue', true)
    .in('invoice_status', ['open', 'partially_paid'])
    .order('due_date', { ascending: true })
    .limit(10)

  let sinFacturaQuery = supabase
    .from('po_without_supplier_invoice')
    .select('*')
    .order('approval_date', { ascending: true, nullsFirst: false })
    .limit(10)

  if (plantId) {
    overdueQuery = overdueQuery.eq('plant_id', plantId)
    sinFacturaQuery = sinFacturaQuery.eq('plant_id', plantId)
  }

  const [{ data: overdue }, { data: sinFactura }] = await Promise.all([
    overdueQuery,
    sinFacturaQuery,
  ])

  for (const row of overdue ?? []) {
    items.push({
      id: `overdue-${row.invoice_id}`,
      type: 'vencida',
      title: `Factura vencida — ${row.order_id}`,
      description: `${row.supplier} · Folio ${row.invoice_number}`,
      purchase_order_id: row.purchase_order_id,
      invoice_id: row.invoice_id,
      order_id: row.order_id,
      amount: Number(row.balance),
      due_date: row.due_date,
      priority: 'high',
    })
  }

  for (const row of sinFactura ?? []) {
    items.push({
      id: `sin-factura-${row.purchase_order_id}`,
      type: 'sin_factura',
      title: `Sin factura — ${row.order_id}`,
      description: `${row.supplier} · ${row.has_receipt ? 'Con comprobante' : 'Sin comprobante'}`,
      purchase_order_id: row.purchase_order_id,
      order_id: row.order_id,
      amount: Number(row.actual_amount ?? row.total_amount ?? 0),
      due_date: row.max_payment_date,
      priority: row.has_receipt ? 'medium' : 'high',
    })
  }

  const partialQuery = plantId
    ? supabase
        .from('po_invoice_balances')
        .select('*')
        .eq('plant_id', plantId)
        .eq('invoice_status', 'partially_paid')
        .limit(5)
    : supabase
        .from('po_invoice_balances')
        .select('*')
        .eq('invoice_status', 'partially_paid')
        .limit(5)

  const { data: partial } = await partialQuery

  for (const row of partial ?? []) {
    items.push({
      id: `parcial-${row.invoice_id}`,
      type: 'parcial',
      title: `Pago parcial — ${row.order_id}`,
      description: `Saldo ${row.balance} de ${row.total}`,
      purchase_order_id: row.purchase_order_id,
      invoice_id: row.invoice_id,
      order_id: row.order_id,
      amount: Number(row.balance),
      priority: 'medium',
    })
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return items
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit)
}
