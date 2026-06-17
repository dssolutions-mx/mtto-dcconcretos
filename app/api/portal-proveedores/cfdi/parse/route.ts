import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { normalizeSupplierRfc } from "@/lib/portal-proveedores/rfc"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"
import { parseCfdiXml, CfdiParseError } from "@/lib/sat/cfdiParser"
import { extractXmlFromFormData } from "@/lib/sat/extractXmlFromUpload"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ success: false, error: session.message }, { status: session.status })
    }

    if (session.ctx.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Su cuenta del portal no está activa." },
        { status: 403 }
      )
    }

    const form = await request.formData()
    const extracted = await extractXmlFromFormData(form)
    if ("error" in extracted) {
      return NextResponse.json({ success: false, error: extracted.error }, { status: 400 })
    }

    const entry = extracted.entries[0]
    if (!entry) {
      return NextResponse.json({ success: false, error: "No se encontró XML" }, { status: 400 })
    }

    const cfdi = parseCfdiXml(entry.text)
    if (cfdi.tipo_comprobante !== "I") {
      return NextResponse.json(
        {
          success: false,
          error: `El CFDI debe ser de tipo Ingreso (I), recibido: ${cfdi.tipo_comprobante}`,
        },
        { status: 400 }
      )
    }

    const emisorRfc = normalizeSupplierRfc(cfdi.emisor_rfc)
    const portalRfc = normalizeSupplierRfc(session.ctx.rfc)
    if (emisorRfc !== portalRfc) {
      return NextResponse.json(
        {
          success: false,
          error: `El RFC emisor del CFDI (${emisorRfc}) no coincide con su cuenta (${portalRfc}).`,
        },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: dup } = await admin
      .from("po_supplier_invoices")
      .select("id, invoice_number")
      .eq("cfdi_uuid", cfdi.uuid)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      cfdi,
      file_name: entry.name,
      duplicate_invoice: dup
        ? { id: dup.id, invoice_number: dup.invoice_number }
        : null,
    })
  } catch (err) {
    if (err instanceof CfdiParseError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 })
    }
    console.error("POST /api/portal-proveedores/cfdi/parse", err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    )
  }
}
