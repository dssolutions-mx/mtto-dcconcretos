import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { assertPurchaseOrderAccess } from "@/lib/portal-proveedores/purchase-order-scope"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const { id } = await params
    const admin = createAdminClient()
    const access = await assertPurchaseOrderAccess(admin, session.ctx, id)
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status })
    }

    const { data: invoices } = await admin
      .from("po_supplier_invoices")
      .select(
        "id, invoice_number, invoice_date, total, status, cfdi_uuid, cfdi_emisor_rfc, created_at"
      )
      .eq("purchase_order_id", id)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      order: access.po,
      invoices: invoices ?? [],
    })
  } catch (error) {
    console.error("GET /api/portal-proveedores/ordenes/[id]", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
