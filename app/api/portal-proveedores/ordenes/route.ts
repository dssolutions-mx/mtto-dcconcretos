import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { listConsolidatedPurchaseOrders } from "@/lib/portal-proveedores/consolidated-purchase-orders"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const admin = createAdminClient()
    const result = await listConsolidatedPurchaseOrders(admin, session.ctx)

    return NextResponse.json(result)
  } catch (error) {
    console.error("GET /api/portal-proveedores/ordenes", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
