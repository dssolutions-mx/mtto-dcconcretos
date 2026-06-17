import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { listSupplierPurchaseOrders } from "@/lib/portal-proveedores/purchase-order-scope"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const admin = createAdminClient()
    const orders = await listSupplierPurchaseOrders(admin, session.ctx)

    return NextResponse.json({
      orders,
      supplier_linked: Boolean(session.ctx.mttoSupplierId),
    })
  } catch (error) {
    console.error("GET /api/portal-proveedores/ordenes", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
