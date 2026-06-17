import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { loadPortalPaymentSummary } from "@/lib/portal-proveedores/payment-summary"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const admin = createAdminClient()
    const summary = await loadPortalPaymentSummary(admin, session.ctx)

    return NextResponse.json(summary)
  } catch (error) {
    console.error("GET /api/portal-proveedores/pagos", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
