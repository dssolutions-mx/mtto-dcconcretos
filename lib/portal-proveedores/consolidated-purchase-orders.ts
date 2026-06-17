import type { SupabaseClient } from "@supabase/supabase-js"
import { isCotizadorConfigured } from "./cotizador-client"
import {
  listCotizadorPurchaseOrders,
  type CotizadorPurchaseOrderSummary,
} from "./cotizador-purchase-orders"
import {
  listSupplierPurchaseOrders,
  type SupplierPurchaseOrderSummary,
} from "./purchase-order-scope"
import type { SupplierPortalContext } from "./types"

export type PurchaseOrderSource = "mtto" | "cotizador"

export type ConsolidatedPurchaseOrderSummary = {
  id: string
  source: PurchaseOrderSource
  order_id: string
  status: string
  total_amount: number
  supplier: string | null
  created_at: string
  plant_label: string | null
  invoice_count: number
  can_upload_invoice: boolean
  qty_ordered?: number
  qty_received?: number
}

function mapMttoOrder(
  order: SupplierPurchaseOrderSummary
): ConsolidatedPurchaseOrderSummary {
  return {
    id: order.id,
    source: "mtto",
    order_id: order.order_id,
    status: order.status,
    total_amount: order.total_amount,
    supplier: order.supplier,
    created_at: order.created_at,
    plant_label: order.plant_id,
    invoice_count: order.invoice_count,
    can_upload_invoice: true,
  }
}

function mapCotizadorOrder(
  order: CotizadorPurchaseOrderSummary
): ConsolidatedPurchaseOrderSummary {
  return {
    id: order.id,
    source: "cotizador",
    order_id: order.order_id,
    status: order.status,
    total_amount: order.total_amount,
    supplier: order.supplier,
    created_at: order.created_at,
    plant_label: order.plant_name,
    invoice_count: order.invoice_count,
    can_upload_invoice: false,
    qty_ordered: order.qty_ordered,
    qty_received: order.qty_received,
  }
}

export async function listConsolidatedPurchaseOrders(
  admin: SupabaseClient,
  ctx: SupplierPortalContext
): Promise<{
  orders: ConsolidatedPurchaseOrderSummary[]
  mtto_linked: boolean
  cotizador_linked: boolean
  cotizador_configured: boolean
}> {
  const mttoOrders = await listSupplierPurchaseOrders(admin, ctx)
  const cotizadorOrders = isCotizadorConfigured()
    ? await listCotizadorPurchaseOrders(ctx)
    : []

  const orders = [
    ...mttoOrders.map(mapMttoOrder),
    ...cotizadorOrders.map(mapCotizadorOrder),
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return {
    orders,
    mtto_linked: Boolean(ctx.mttoSupplierId),
    cotizador_linked: Boolean(ctx.cotizadorGroupId) || cotizadorOrders.length > 0,
    cotizador_configured: isCotizadorConfigured(),
  }
}

export function detailHref(order: ConsolidatedPurchaseOrderSummary): string {
  if (order.source === "cotizador") {
    return `/portal-proveedores/ordenes/cotizador/${order.id}`
  }
  return `/portal-proveedores/ordenes/${order.id}`
}
