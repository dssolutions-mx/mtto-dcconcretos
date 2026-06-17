import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { canInviteSupplierPortal } from "@/lib/portal-proveedores/staff-permissions"
import { isValidSupplierRfc, normalizeSupplierRfc } from "@/lib/portal-proveedores/rfc"
import { randomBytes } from "crypto"
import { z } from "zod"

export const dynamic = "force-dynamic"

const inviteSchema = z.object({
  email: z.string().email("Correo inválido"),
  rfc: z.string().min(12, "RFC requerido"),
  mtto_supplier_id: z.string().uuid().optional().nullable(),
})

function appOrigin(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (env) return env.replace(/\/$/, "")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") || "https"
  return host ? `${proto}://${host}` : "http://localhost:3000"
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()

    if (!profile || !canInviteSupplierPortal(profile.role)) {
      return NextResponse.json(
        { error: "No tiene permiso para invitar proveedores al portal." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = inviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 }
      )
    }

    const email = parsed.data.email.trim().toLowerCase()
    const rfc = normalizeSupplierRfc(parsed.data.rfc)
    if (!isValidSupplierRfc(rfc)) {
      return NextResponse.json({ error: "RFC inválido" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: staffProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle()

    if (staffProfile?.id) {
      return NextResponse.json(
        {
          error:
            "Este correo pertenece a un usuario interno. Use un correo distinto para el portal de proveedores.",
        },
        { status: 409 }
      )
    }

    let mttoSupplierId: string | null = parsed.data.mtto_supplier_id ?? null

    if (mttoSupplierId) {
      const { data: supplier } = await admin
        .from("suppliers")
        .select("id, tax_id")
        .eq("id", mttoSupplierId)
        .maybeSingle()
      if (!supplier) {
        return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
      }
      if (supplier.tax_id && normalizeSupplierRfc(supplier.tax_id) !== rfc) {
        return NextResponse.json(
          { error: "El RFC no coincide con el proveedor seleccionado." },
          { status: 400 }
        )
      }
    } else {
      const { data: supplier } = await admin
        .from("suppliers")
        .select("id, tax_id")
        .not("tax_id", "is", null)
        .ilike("tax_id", rfc)
        .limit(1)
        .maybeSingle()
      mttoSupplierId = supplier?.id ?? null
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { error: insertError } = await admin.from("supplier_portal_invitations").insert({
      token,
      email,
      rfc,
      mtto_supplier_id: mttoSupplierId,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

    if (insertError) {
      console.error("supplier portal invitation insert failed", insertError)
      return NextResponse.json(
        { error: "No se pudo crear la invitación" },
        { status: 500 }
      )
    }

    const invitationUrl = `${appOrigin(request)}/portal-proveedores/invitacion?token=${token}`

    return NextResponse.json({
      success: true,
      invitation_url: invitationUrl,
      expires_at: expiresAt.toISOString(),
      email,
      rfc,
      mtto_supplier_id: mttoSupplierId,
    })
  } catch (error) {
    console.error("POST /api/portal-proveedores/invitations", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
