import type { SupabaseClient } from "@supabase/supabase-js"
import { createCotizadorAdminClient } from "./cotizador-client"
import { normalizeSupplierRfc } from "./rfc"
import type { SupplierPortalContext } from "./types"

export const COTIZADOR_VISIBLE_PO_STATUSES = [
  "open",
  "partial",
  "fulfilled",
  "closed",
] as const

export type CotizadorPurchaseOrderSummary = {
  id: string
  source: "cotizador"
  order_id: string
  status: string
  total_amount: number
  supplier: string | null
  created_at: string
  plant_name: string | null
  invoice_count: number
  qty_ordered: number
  qty_received: number
}

export type CotizadorPurchaseOrderLine = {
  id: string
  description: string
  qty_ordered: number
  qty_received: number
  unit_price: number
  line_total: number
  uom: string | null
}

export type CotizadorPurchaseOrderDetail = CotizadorPurchaseOrderSummary & {
  notes: string | null
  po_date: string | null
  currency: string
  payment_terms_days: number | null
  lines: CotizadorPurchaseOrderLine[]
}

export type CotizadorPurchaseOrderAccessResult =
  | { ok: true; po: CotizadorPurchaseOrderDetail }
  | { ok: false; status: number; message: string }

type CotizadorPoRow = {
  id: string
  po_number: string | null
  status: string
  created_at: string
  po_date: string | null
  notes: string | null
  currency: string
  payment_terms_days: number | null
  supplier_id: string
  plant_id: string
  supplier: { name: string } | { name: string }[] | null
  plant: { name: string } | { name: string }[] | null
}

type CotizadorPoItemRow = {
  id: string
  qty_ordered: number
  qty_received: number
  unit_price: number
  uom: string | null
  is_service: boolean
  service_description: string | null
  material: { material_name: string } | { material_name: string }[] | null
}

function embedName(
  value: { name: string } | { name: string }[] | null | undefined
): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.name ?? null
  return value.name ?? null
}

function embedMaterialName(
  value: { material_name: string } | { material_name: string }[] | null | undefined
): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0]?.material_name ?? null
  return value.material_name ?? null
}

function lineDescription(item: CotizadorPoItemRow): string {
  if (item.is_service) {
    return item.service_description?.trim() || "Servicio"
  }
  return embedMaterialName(item.material) ?? "Material"
}

function sumLineTotals(items: CotizadorPoItemRow[]): {
  total: number
  qtyOrdered: number
  qtyReceived: number
} {
  let total = 0
  let qtyOrdered = 0
  let qtyReceived = 0
  for (const item of items) {
    total += Number(item.qty_ordered ?? 0) * Number(item.unit_price ?? 0)
    qtyOrdered += Number(item.qty_ordered ?? 0)
    qtyReceived += Number(item.qty_received ?? 0)
  }
  return { total, qtyOrdered, qtyReceived }
}

async function resolveCotizadorGroupIds(
  cotizador: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<string[]> {
  const ids = new Set<string>()
  if (ctx.cotizadorGroupId) {
    ids.add(ctx.cotizadorGroupId)
  }

  const normalizedRfc = normalizeSupplierRfc(ctx.rfc)
  const { data: groupsByRfc } = await cotizador
    .from("supplier_groups")
    .select("id")
    .eq("rfc", normalizedRfc)

  for (const row of groupsByRfc ?? []) {
    ids.add(row.id)
  }

  return [...ids]
}

async function resolveCotizadorSupplierIds(
  cotizador: SupabaseClient,
  groupIds: string[]
): Promise<string[]> {
  if (groupIds.length === 0) return []

  const { data, error } = await cotizador
    .from("suppliers")
    .select("id")
    .in("group_id", groupIds)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.id)
}

async function loadCotizadorPoItems(
  cotizador: SupabaseClient,
  poIds: string[]
): Promise<Map<string, CotizadorPoItemRow[]>> {
  const byPo = new Map<string, CotizadorPoItemRow[]>()
  if (poIds.length === 0) return byPo

  const { data, error } = await cotizador
    .from("purchase_order_items")
    .select(
      "id, po_id, qty_ordered, qty_received, unit_price, uom, is_service, service_description, material:materials!material_id (material_name)"
    )
    .in("po_id", poIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const poId = row.po_id as string
    const list = byPo.get(poId) ?? []
    list.push(row as CotizadorPoItemRow)
    byPo.set(poId, list)
  }
  return byPo
}

function toSummary(
  po: CotizadorPoRow,
  items: CotizadorPoItemRow[]
): CotizadorPurchaseOrderSummary {
  const { total, qtyOrdered, qtyReceived } = sumLineTotals(items)
  return {
    id: po.id,
    source: "cotizador",
    order_id: po.po_number ?? po.id.slice(0, 8).toUpperCase(),
    status: po.status,
    total_amount: total,
    supplier: embedName(po.supplier),
    created_at: po.po_date ?? po.created_at,
    plant_name: embedName(po.plant),
    invoice_count: 0,
    qty_ordered: qtyOrdered,
    qty_received: qtyReceived,
  }
}

export async function listCotizadorPurchaseOrders(
  ctx: SupplierPortalContext
): Promise<CotizadorPurchaseOrderSummary[]> {
  const cotizador = createCotizadorAdminClient()
  if (!cotizador) return []

  const groupIds = await resolveCotizadorGroupIds(cotizador, ctx)
  const supplierIds = await resolveCotizadorSupplierIds(cotizador, groupIds)
  if (supplierIds.length === 0) return []

  const { data, error } = await cotizador
    .from("purchase_orders")
    .select(
      "id, po_number, status, created_at, po_date, notes, currency, payment_terms_days, supplier_id, plant_id, supplier:suppliers!supplier_id (name), plant:plants!plant_id (name)"
    )
    .in("supplier_id", supplierIds)
    .in("status", [...COTIZADOR_VISIBLE_PO_STATUSES])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as CotizadorPoRow[]
  const poIds = rows.map((row) => row.id)
  const itemsByPo = await loadCotizadorPoItems(cotizador, poIds)

  return rows.map((po) => toSummary(po, itemsByPo.get(po.id) ?? []))
}

export async function assertCotizadorPurchaseOrderAccess(
  ctx: SupplierPortalContext,
  purchaseOrderId: string
): Promise<CotizadorPurchaseOrderAccessResult> {
  if (ctx.status !== "active") {
    return {
      ok: false,
      status: 403,
      message: "Su cuenta del portal no está activa.",
    }
  }

  const cotizador = createCotizadorAdminClient()
  if (!cotizador) {
    return {
      ok: false,
      status: 503,
      message: "El sistema de cotizaciones no está configurado.",
    }
  }

  const groupIds = await resolveCotizadorGroupIds(cotizador, ctx)
  const supplierIds = await resolveCotizadorSupplierIds(cotizador, groupIds)
  if (supplierIds.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "No tiene órdenes de compra en el cotizador vinculadas a su RFC.",
    }
  }

  const { data: po, error } = await cotizador
    .from("purchase_orders")
    .select(
      "id, po_number, status, created_at, po_date, notes, currency, payment_terms_days, supplier_id, plant_id, supplier:suppliers!supplier_id (name), plant:plants!plant_id (name)"
    )
    .eq("id", purchaseOrderId)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, message: error.message }
  }
  if (!po) {
    return { ok: false, status: 404, message: "Orden de compra no encontrada." }
  }

  const row = po as CotizadorPoRow
  if (
    !COTIZADOR_VISIBLE_PO_STATUSES.includes(
      row.status as (typeof COTIZADOR_VISIBLE_PO_STATUSES)[number]
    )
  ) {
    return {
      ok: false,
      status: 403,
      message: "Esta orden de compra aún no está disponible para consulta.",
    }
  }

  if (!supplierIds.includes(row.supplier_id)) {
    return {
      ok: false,
      status: 403,
      message: "No tiene acceso a esta orden de compra.",
    }
  }

  const itemsByPo = await loadCotizadorPoItems(cotizador, [purchaseOrderId])
  const items = itemsByPo.get(purchaseOrderId) ?? []
  const summary = toSummary(row, items)

  return {
    ok: true,
    po: {
      ...summary,
      notes: row.notes,
      po_date: row.po_date,
      currency: row.currency,
      payment_terms_days: row.payment_terms_days,
      lines: items.map((item) => ({
        id: item.id,
        description: lineDescription(item),
        qty_ordered: Number(item.qty_ordered ?? 0),
        qty_received: Number(item.qty_received ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        line_total:
          Number(item.qty_ordered ?? 0) * Number(item.unit_price ?? 0),
        uom: item.uom,
      })),
    },
  }
}
