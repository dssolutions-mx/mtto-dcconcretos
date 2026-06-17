import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { loadPortalProfile, updatePortalProfile } from "@/lib/portal-proveedores/profile"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const supabase = await createClient()
    const profile = await loadPortalProfile(
      supabase,
      session.userId,
      session.email,
      session.ctx
    )

    return NextResponse.json({ profile })
  } catch (error) {
    console.error("GET /api/portal-proveedores/perfil", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    if (session.ctx.status !== "active") {
      return NextResponse.json(
        { error: "Su cuenta del portal no está activa." },
        { status: 403 }
      )
    }

    const body = (await request.json()) as {
      contact_name?: string | null
      contact_phone?: string | null
      notification_email?: string | null
    }

    const supabase = await createClient()
    const result = await updatePortalProfile(supabase, session.userId, {
      contactName: body.contact_name,
      contactPhone: body.contact_phone,
      notificationEmail: body.notification_email,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    const profile = await loadPortalProfile(
      supabase,
      session.userId,
      session.email,
      session.ctx
    )

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("PATCH /api/portal-proveedores/perfil", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
