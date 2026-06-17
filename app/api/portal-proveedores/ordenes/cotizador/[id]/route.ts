import { NextResponse } from "next/server"
import { assertCotizadorPurchaseOrderAccess } from "@/lib/portal-proveedores/cotizador-purchase-orders"
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
    const access = await assertCotizadorPurchaseOrderAccess(session.ctx, id)
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status })
    }

    return NextResponse.json({ order: access.po })
  } catch (error) {
    console.error("GET /api/portal-proveedores/ordenes/cotizador/[id]", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
