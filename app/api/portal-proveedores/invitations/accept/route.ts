import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

/** Valida token de invitación (lectura pública para el formulario). */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim()
    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: invitation, error } = await admin
      .from("supplier_portal_invitations")
      .select("email, rfc, expires_at, accepted_at")
      .eq("token", token)
      .maybeSingle()

    if (error || !invitation) {
      return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: "Invitación ya utilizada" }, { status: 410 })
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Invitación expirada" }, { status: 410 })
    }

    return NextResponse.json({
      email: invitation.email,
      rfc: invitation.rfc,
      expires_at: invitation.expires_at,
    })
  } catch (error) {
    console.error("GET /api/portal-proveedores/invitations/accept", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!token || password.length < 8) {
      return NextResponse.json(
        { error: "Token y contraseña (mín. 8 caracteres) son requeridos." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: invitation, error: inviteError } = await admin
      .from("supplier_portal_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invitación no encontrada." }, { status: 404 })
    }

    if (invitation.accepted_at) {
      return NextResponse.json({ error: "Esta invitación ya fue utilizada." }, { status: 410 })
    }

    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "La invitación expiró." }, { status: 410 })
    }

    const email = invitation.email.toLowerCase()

    const { data: staffProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle()

    if (staffProfile?.id) {
      return NextResponse.json(
        {
          error:
            "Este correo pertenece a un usuario interno. Solicite a compras una invitación con otro correo.",
        },
        { status: 409 }
      )
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        supplier_portal: true,
        rfc: invitation.rfc,
        invited: true,
      },
    })

    if (createError) {
      const alreadyExists =
        createError.message?.toLowerCase().includes("already") ||
        createError.message?.toLowerCase().includes("registered")

      if (alreadyExists) {
        return NextResponse.json(
          {
            error:
              "El correo ya está registrado. Si ya aceptó una invitación, use iniciar sesión. Si necesita ayuda, contacte a compras.",
          },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: createError.message ?? "No se pudo crear el usuario" },
        { status: 500 }
      )
    }

    const userId = created.user?.id
    if (!userId) {
      return NextResponse.json({ error: "No se pudo obtener el usuario" }, { status: 500 })
    }

    const now = new Date().toISOString()
    const { error: membershipError } = await admin.from("supplier_portal_users").upsert(
      {
        auth_user_id: userId,
        rfc: invitation.rfc,
        mtto_supplier_id: invitation.mtto_supplier_id,
        status: "active",
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
        accepted_at: now,
      },
      { onConflict: "auth_user_id" }
    )

    if (membershipError) {
      console.error("supplier portal membership upsert failed", membershipError)
      return NextResponse.json(
        { error: "No se pudo activar la membresía del portal." },
        { status: 500 }
      )
    }

    await admin
      .from("supplier_portal_invitations")
      .update({ accepted_at: now, accepted_by: userId })
      .eq("id", invitation.id)

    return NextResponse.json({
      success: true,
      email,
      rfc: invitation.rfc,
      next: "/portal-proveedores/login?accepted=1",
    })
  } catch (error) {
    console.error("POST /api/portal-proveedores/invitations/accept", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
