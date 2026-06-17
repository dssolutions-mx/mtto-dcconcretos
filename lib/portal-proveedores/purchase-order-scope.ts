import type { SupabaseClient } from "@supabase/supabase-js"
import type { SupplierPortalContext } from "./types"
import { normalizeSupplierRfc } from "./rfc"

export const SUPPLIER_VISIBLE_PO_STATUSES = [
  "approved",
  "purchased",
  "ordered",
  "receipt_uploaded",
  "received",
  "validated",
  "fulfilled",
] as const

export type SupplierPurchaseOrderSummary = {
  id: string
  order_id: string
  status: string
  total_amount: number
  supplier: string | null
  supplier_id: string | null
  created_at: string
  plant_id: string | null
  plant_label: string | null
  po_type: string | null
  invoice_count: number
}

export type SupplierPurchaseOrderDetail = SupplierPurchaseOrderSummary & {
  notes: string | null
  po_purpose: string | null
  accounting_status: string | null
}

export type PurchaseOrderAccessResult =
  | { ok: true; po: SupplierPurchaseOrderDetail }
  | { ok: false; status: number; message: string }

const PO_SUMMARY_SELECT =
  "id, order_id, status, total_amount, supplier, supplier_id, created_at, plant_id, po_type, notes, po_purpose, accounting_status"

async function loadInvoiceCounts(
  admin: SupabaseClient,
  poIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (poIds.length === 0) return counts

  const { data } = await admin
    .from("po_supplier_invoices")
    .select("purchase_order_id")
    .in("purchase_order_id", poIds)

  for (const row of data ?? []) {
    counts.set(row.purchase_order_id, (counts.get(row.purchase_order_id) ?? 0) + 1)
  }
  return counts
}

async function loadPlantLabels(
  admin: SupabaseClient,
  plantIds: string[]
): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  const uniqueIds = [...new Set(plantIds.filter(Boolean))]
  if (uniqueIds.length === 0) return labels

  const { data } = await admin
    .from("plants")
    .select("id, name, code")
    .in("id", uniqueIds)

  for (const plant of data ?? []) {
    labels.set(plant.id, plant.name || plant.code || plant.id)
  }
  return labels
}

function toSummary(
  po: Record<string, unknown>,
  invoiceCount: number,
  plantLabel: string | null
): SupplierPurchaseOrderSummary {
  return {
    id: po.id as string,
    order_id: po.order_id as string,
    status: po.status as string,
    total_amount: Number(po.total_amount ?? 0),
    supplier: (po.supplier as string | null) ?? null,
    supplier_id: (po.supplier_id as string | null) ?? null,
    created_at: po.created_at as string,
    plant_id: (po.plant_id as string | null) ?? null,
    plant_label: plantLabel,
    po_type: (po.po_type as string | null) ?? null,
    invoice_count: invoiceCount,
  }
}

export type PortalScopedInvoice = {
  id: string
  invoice_number: string
  invoice_date: string | null
  total: number | null
  status: string | null
  cfdi_uuid: string | null
  cfdi_emisor_rfc: string | null
  created_at: string | null
  supplier_id?: string | null
}

export function filterInvoicesForPortal<T extends PortalScopedInvoice>(
  invoices: T[],
  ctx: SupplierPortalContext
): T[] {
  const portalRfc = normalizeSupplierRfc(ctx.rfc)
  return invoices.filter((invoice) => {
    if (ctx.mttoSupplierId && invoice.supplier_id === ctx.mttoSupplierId) {
      return true
    }
    if (
      invoice.cfdi_emisor_rfc &&
      normalizeSupplierRfc(invoice.cfdi_emisor_rfc) === portalRfc
    ) {
      return true
    }
    return false
  })
}

export async function listSupplierPurchaseOrders(
  admin: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<SupplierPurchaseOrderSummary[]> {
  const byId = new Map<string, Record<string, unknown>>()

  if (ctx.mttoSupplierId) {
    const { data, error } = await admin
      .from("purchase_orders")
      .select(PO_SUMMARY_SELECT)
      .eq("supplier_id", ctx.mttoSupplierId)
      .in("status", [...SUPPLIER_VISIBLE_PO_STATUSES])
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)
    for (const po of data ?? []) {
      byId.set(po.id, po as Record<string, unknown>)
    }
  }

  const { data: linkedInvoices } = await admin
    .from("po_supplier_invoices")
    .select("purchase_order_id")
    .eq("cfdi_emisor_rfc", normalizeSupplierRfc(ctx.rfc))

  const missingIds = [...new Set((linkedInvoices ?? []).map((i) => i.purchase_order_id))]
    .filter((id) => id && !byId.has(id))

  if (missingIds.length > 0) {
    const { data: linkedPos } = await admin
      .from("purchase_orders")
      .select(PO_SUMMARY_SELECT)
      .in("id", missingIds)
      .in("status", [...SUPPLIER_VISIBLE_PO_STATUSES])

    for (const po of linkedPos ?? []) {
      byId.set(po.id, po as Record<string, unknown>)
    }
  }

  const ids = [...byId.keys()]
  const invoiceCounts = await loadInvoiceCounts(admin, ids)
  const plantLabels = await loadPlantLabels(
    admin,
    [...byId.values()].map((po) => po.plant_id as string | null)
  )

  return [...byId.values()]
    .map((po) => {
      const plantId = po.plant_id as string | null
      return toSummary(
        po,
        invoiceCounts.get(po.id as string) ?? 0,
        plantId ? plantLabels.get(plantId) ?? plantId : null
      )
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
}

export async function assertPurchaseOrderAccess(
  admin: SupabaseClient,
  ctx: SupplierPortalContext,
  purchaseOrderId: string
): Promise<PurchaseOrderAccessResult> {
  if (ctx.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "Su cuenta del portal no está activa.",
    }
  }

  const { data: po, error } = await admin
    .from("purchase_orders")
    .select(PO_SUMMARY_SELECT)
    .eq("id", purchaseOrderId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, message: error.message }
  }
  if (!po) {
    return { ok: false, status: 404, message: "Orden de compra no encontrada." }
  }

  if (!SUPPLIER_VISIBLE_PO_STATUSES.includes(po.status as (typeof SUPPLIER_VISIBLE_PO_STATUSES)[number])) {
    return {
      ok: false,
      status: 403,
      message: "Esta orden de compra aún no está disponible para facturación.",
    }
  }

  const supplierMatch =
    ctx.mttoSupplierId != null && po.supplier_id === ctx.mttoSupplierId

  let invoiceMatch = false
  if (!supplierMatch) {
    const { data: priorInvoice } = await admin
      .from("po_supplier_invoices")
      .select("id")
      .eq("purchase_order_id", purchaseOrderId)
      .eq("cfdi_emisor_rfc", normalizeSupplierRfc(ctx.rfc))
      .limit(1)
      .maybeSingle()
    invoiceMatch = Boolean(priorInvoice)
  }

  if (!supplierMatch && !invoiceMatch) {
    return {
      ok: false,
      status: 403,
      message: "No tiene acceso a esta orden de compra.",
    }
  }

  const invoiceCounts = await loadInvoiceCounts(admin, [purchaseOrderId])
  const plantLabels = await loadPlantLabels(
    admin,
    po.plant_id ? [po.plant_id] : []
  )
  const plantLabel = po.plant_id ? plantLabels.get(po.plant_id) ?? po.plant_id : null
  const summary = toSummary(
    po as Record<string, unknown>,
    invoiceCounts.get(purchaseOrderId) ?? 0,
    plantLabel
  )

  return {
    ok: true,
    po: {
      ...summary,
      notes: (po.notes as string | null) ?? null,
      po_purpose: (po.po_purpose as string | null) ?? null,
      accounting_status: (po.accounting_status as string | null) ?? null,
    },
  }
}
