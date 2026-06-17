import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const resolved = await resolvePortalContext(supabase, user.id)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status })
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      portal: resolved.ctx,
    })
  } catch (error) {
    console.error("GET /api/portal-proveedores/me", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
