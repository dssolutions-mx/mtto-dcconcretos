import type { SupabaseClient } from "@supabase/supabase-js"
import { createCotizadorAdminClient } from "./cotizador-client"
import { resolveCotizadorGroupIds } from "./cotizador-purchase-orders"
import { normalizeSupplierRfc } from "./rfc"
import type { SupplierPortalContext } from "./types"

export type PortalPaymentSource = "mtto" | "cotizador"

export type PortalPaymentRecord = {
  id: string
  payment_date: string
  amount: number
  reference: string | null
  payment_method: string | null
}

export type PortalInvoicePayable = {
  id: string
  source: PortalPaymentSource
  invoice_number: string
  invoice_date: string
  due_date: string | null
  total: number
  paid_to_date: number
  balance: number
  status: string
  order_id: string | null
  purchase_order_id: string | null
  is_overdue: boolean
  cfdi_uuid: string | null
}

export type PortalPaymentSummaryBySource = {
  invoice_count: number
  open_count: number
  partially_paid_count: number
  paid_count: number
  total_invoiced: number
  total_paid: number
  total_balance: number
  configured: boolean
}

export type PortalPaymentWithInvoice = PortalPaymentRecord & {
  invoice_id: string
  invoice_number: string
  source: PortalPaymentSource
}

export type PortalPaymentSummary = {
  mtto: PortalPaymentSummaryBySource
  cotizador: PortalPaymentSummaryBySource
  combined: PortalPaymentSummaryBySource
  invoices: PortalInvoicePayable[]
  recent_payments: PortalPaymentWithInvoice[]
}

const EMPTY_SOURCE_SUMMARY: PortalPaymentSummaryBySource = {
  invoice_count: 0,
  open_count: 0,
  partially_paid_count: 0,
  paid_count: 0,
  total_invoiced: 0,
  total_paid: 0,
  total_balance: 0,
  configured: true,
}

export function aggregatePaymentSummary(
  invoices: PortalInvoicePayable[],
  recentPayments: PortalPaymentWithInvoice[],
  cotizadorConfigured: boolean
): PortalPaymentSummary {
  const mttoInvoices = invoices.filter((inv) => inv.source === "mtto")
  const cotizadorInvoices = invoices.filter((inv) => inv.source === "cotizador")

  const mtto = summarizeSource(mttoInvoices, true)
  const cotizador = summarizeSource(cotizadorInvoices, cotizadorConfigured)

  const combined = summarizeSource(invoices, true)

  return {
    mtto,
    cotizador,
    combined,
    invoices,
    recent_payments: recentPayments,
  }
}

function summarizeSource(
  invoices: PortalInvoicePayable[],
  configured: boolean
): PortalPaymentSummaryBySource {
  if (!configured) {
    return { ...EMPTY_SOURCE_SUMMARY, configured: false }
  }

  let open_count = 0
  let partially_paid_count = 0
  let paid_count = 0
  let total_invoiced = 0
  let total_paid = 0
  let total_balance = 0

  for (const inv of invoices) {
    total_invoiced += inv.total
    total_paid += inv.paid_to_date
    total_balance += inv.balance

    if (inv.status === "paid") paid_count += 1
    else if (inv.status === "partially_paid") partially_paid_count += 1
    else if (inv.status === "open") open_count += 1
  }

  return {
    invoice_count: invoices.length,
    open_count,
    partially_paid_count,
    paid_count,
    total_invoiced,
    total_paid,
    total_balance,
    configured: true,
  }
}

type MttoBalanceRow = {
  invoice_id: string
  purchase_order_id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  total: number
  paid_to_date: number
  balance: number
  invoice_status: string
  order_id: string
  is_overdue: boolean
}

type MttoPaymentRow = {
  id: string
  invoice_id: string
  payment_date: string
  amount: number
  payment_method: string | null
  reference: string | null
}

async function listMttoInvoiceIds(
  admin: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<string[]> {
  const portalRfc = normalizeSupplierRfc(ctx.rfc)

  let query = admin.from("po_supplier_invoices").select("id").neq("status", "void")

  if (ctx.mttoSupplierId) {
    query = query.or(
      `cfdi_emisor_rfc.eq.${portalRfc},supplier_id.eq.${ctx.mttoSupplierId}`
    )
  } else {
    query = query.eq("cfdi_emisor_rfc", portalRfc)
  }

  const { data, error } = await query.limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.id as string)
}

async function loadMttoInvoices(
  admin: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<{
  invoices: PortalInvoicePayable[]
  payments: PortalPaymentWithInvoice[]
}> {
  const invoiceIds = await listMttoInvoiceIds(admin, ctx)
  if (invoiceIds.length === 0) {
    return { invoices: [], payments: [] }
  }

  const { data: balances, error: balanceError } = await admin
    .from("po_invoice_balances")
    .select(
      "invoice_id, purchase_order_id, invoice_number, invoice_date, due_date, total, paid_to_date, balance, invoice_status, order_id, is_overdue"
    )
    .in("invoice_id", invoiceIds)
    .order("invoice_date", { ascending: false })

  if (balanceError) throw new Error(balanceError.message)

  const { data: paymentRows, error: paymentError } = await admin
    .from("po_invoice_payments")
    .select("id, invoice_id, payment_date, amount, payment_method, reference")
    .in("invoice_id", invoiceIds)
    .order("payment_date", { ascending: false })
    .limit(50)

  if (paymentError) throw new Error(paymentError.message)

  const balanceById = new Map(
    (balances ?? []).map((row) => [row.invoice_id as string, row as MttoBalanceRow])
  )

  const { data: cfdiRows } = await admin
    .from("po_supplier_invoices")
    .select("id, cfdi_uuid")
    .in("id", invoiceIds)

  const cfdiById = new Map(
    (cfdiRows ?? []).map((row) => [row.id as string, row.cfdi_uuid as string | null])
  )

  const invoices: PortalInvoicePayable[] = (balances ?? []).map((row) => {
    const typed = row as MttoBalanceRow
    return {
      id: typed.invoice_id,
      source: "mtto",
      invoice_number: typed.invoice_number,
      invoice_date: typed.invoice_date,
      due_date: typed.due_date,
      total: Number(typed.total),
      paid_to_date: Number(typed.paid_to_date),
      balance: Number(typed.balance),
      status: typed.invoice_status,
      order_id: typed.order_id,
      purchase_order_id: typed.purchase_order_id,
      is_overdue: Boolean(typed.is_overdue),
      cfdi_uuid: cfdiById.get(typed.invoice_id) ?? null,
    }
  })

  const payments: PortalPaymentWithInvoice[] = (paymentRows ?? []).map((row) => {
    const typed = row as MttoPaymentRow
    const balance = balanceById.get(typed.invoice_id)
    return {
      id: typed.id,
      payment_date: typed.payment_date,
      amount: Number(typed.amount),
      reference: typed.reference,
      payment_method: typed.payment_method,
      invoice_id: typed.invoice_id,
      invoice_number: balance?.invoice_number ?? typed.invoice_id.slice(0, 8),
      source: "mtto" as const,
    }
  })

  return { invoices, payments }
}

type CotizadorInvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  total: number
  status: string
  cfdi_uuid: string | null
  payable:
    | {
        payments: Array<{
          id: string
          payment_date: string
          amount: number
          method: string | null
          reference: string | null
        }>
      }
    | Array<{
        payments: Array<{
          id: string
          payment_date: string
          amount: number
          method: string | null
          reference: string | null
        }>
      }>
    | null
  cn_allocations?: Array<{ allocated_total: number }>
}

async function loadCotizadorInvoices(
  ctx: SupplierPortalContext
): Promise<{
  invoices: PortalInvoicePayable[]
  payments: PortalPaymentWithInvoice[]
  configured: boolean
}> {
  const cotizador = createCotizadorAdminClient()
  if (!cotizador) {
    return { invoices: [], payments: [], configured: false }
  }

  const groupIds = await resolveCotizadorGroupIds(cotizador, ctx)
  if (groupIds.length === 0) {
    return { invoices: [], payments: [], configured: true }
  }

  const { data, error } = await cotizador
    .from("supplier_invoices")
    .select(
      `
      id,
      invoice_number,
      invoice_date,
      due_date,
      total,
      status,
      cfdi_uuid,
      payable:payables!invoice_id(
        payments:payments!payable_id(id, payment_date, amount, method, reference)
      ),
      cn_allocations:credit_note_invoice_allocations(allocated_total)
    `
    )
    .in("supplier_group_id", groupIds)
    .neq("status", "void")
    .order("invoice_date", { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  const invoices: PortalInvoicePayable[] = []
  const payments: PortalPaymentWithInvoice[] = []

  for (const row of data ?? []) {
    const inv = row as CotizadorInvoiceRow
    const payable = Array.isArray(inv.payable) ? inv.payable[0] : inv.payable
    const paymentList = payable?.payments ?? []
    const paid_to_date = paymentList.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    )
    const creditApplied = (inv.cn_allocations ?? []).reduce(
      (sum, alloc) => sum + Number(alloc.allocated_total ?? 0),
      0
    )
    const balance = Math.max(Number(inv.total) - paid_to_date - creditApplied, 0)
    const isOverdue =
      inv.due_date &&
      new Date(inv.due_date) < new Date() &&
      (inv.status === "open" || inv.status === "partially_paid")

    invoices.push({
      id: inv.id,
      source: "cotizador",
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      total: Number(inv.total),
      paid_to_date,
      balance,
      status: inv.status,
      order_id: null,
      purchase_order_id: null,
      is_overdue: Boolean(isOverdue),
      cfdi_uuid: inv.cfdi_uuid,
    })

    for (const payment of paymentList) {
      payments.push({
        id: payment.id,
        payment_date: payment.payment_date,
        amount: Number(payment.amount),
        reference: payment.reference,
        payment_method: payment.method,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        source: "cotizador",
      })
    }
  }

  payments.sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  return {
    invoices,
    payments: payments.slice(0, 50),
    configured: true,
  }
}

export async function loadPortalPaymentSummary(
  admin: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<PortalPaymentSummary> {
  const [mttoResult, cotizadorResult] = await Promise.all([
    loadMttoInvoices(admin, ctx),
    loadCotizadorInvoices(ctx),
  ])

  const invoices = [...mttoResult.invoices, ...cotizadorResult.invoices].sort((a, b) =>
    b.invoice_date.localeCompare(a.invoice_date)
  )

  const recent_payments = [...mttoResult.payments, ...cotizadorResult.payments]
    .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
    .slice(0, 50)

  return aggregatePaymentSummary(
    invoices,
    recent_payments,
    cotizadorResult.configured
  )
}
