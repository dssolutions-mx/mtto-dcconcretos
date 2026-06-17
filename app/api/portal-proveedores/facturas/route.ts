import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { createPoSupplierInvoice } from "@/lib/ap/createPoSupplierInvoice"
import { createPortalNotification } from "@/lib/portal-proveedores/notifications"
import { assertPurchaseOrderAccess } from "@/lib/portal-proveedores/purchase-order-scope"
import { normalizeSupplierRfc } from "@/lib/portal-proveedores/rfc"
import { requirePortalSession } from "@/lib/portal-proveedores/requirePortalSession"
import type { CreatePoSupplierInvoiceInput } from "@/types/po-invoices"

export const dynamic = "force-dynamic"

type CreatePortalInvoiceBody = CreatePoSupplierInvoiceInput & {
  purchase_order_id: string
}

export async function GET() {
  try {
    const session = await requirePortalSession()
    if (!session.ok) {
      return NextResponse.json({ error: session.message }, { status: session.status })
    }

    const admin = createAdminClient()
    const portalRfc = normalizeSupplierRfc(session.ctx.rfc)

    let query = admin
      .from("po_supplier_invoices")
      .select(
        `
        id,
        purchase_order_id,
        invoice_number,
        invoice_date,
        total,
        status,
        cfdi_uuid,
        cfdi_emisor_rfc,
        created_at,
        purchase_orders ( order_id )
      `
      )
      .order("created_at", { ascending: false })
      .limit(100)

    if (session.ctx.mttoSupplierId) {
      query = query.or(
        `cfdi_emisor_rfc.eq.${portalRfc},supplier_id.eq.${session.ctx.mttoSupplierId}`
      )
    } else {
      query = query.eq("cfdi_emisor_rfc", portalRfc)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const invoices = (data ?? []).map((row) => {
      const po = row.purchase_orders as { order_id?: string } | null
      return {
        id: row.id,
        purchase_order_id: row.purchase_order_id,
        order_id: po?.order_id ?? null,
        invoice_number: row.invoice_number,
        invoice_date: row.invoice_date,
        total: row.total,
        status: row.status,
        cfdi_uuid: row.cfdi_uuid,
        cfdi_emisor_rfc: row.cfdi_emisor_rfc,
        created_at: row.created_at,
      }
    })

    return NextResponse.json({ invoices })
  } catch (error) {
    console.error("GET /api/portal-proveedores/facturas", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

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

    const body = (await request.json()) as CreatePortalInvoiceBody
    const purchaseOrderId = body.purchase_order_id?.trim()
    if (!purchaseOrderId) {
      return NextResponse.json(
        { success: false, error: "purchase_order_id es requerido" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const access = await assertPurchaseOrderAccess(admin, session.ctx, purchaseOrderId)
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.message }, { status: access.status })
    }

    const portalRfc = normalizeSupplierRfc(session.ctx.rfc)
    if (body.cfdi_emisor_rfc) {
      const emisor = normalizeSupplierRfc(body.cfdi_emisor_rfc)
      if (emisor !== portalRfc) {
        return NextResponse.json(
          {
            success: false,
            error: "El RFC emisor de la factura no coincide con su cuenta del portal.",
          },
          { status: 400 }
        )
      }
    }

    const { purchase_order_id: _poId, ...invoiceInput } = body
    const result = await createPoSupplierInvoice(
      admin,
      session.userId,
      purchaseOrderId,
      {
        ...invoiceInput,
        cfdi_capture_mode: invoiceInput.cfdi_uuid ? "cfdi" : invoiceInput.cfdi_capture_mode ?? "manual",
        notes: invoiceInput.notes
          ? `[Portal proveedor] ${invoiceInput.notes}`
          : "[Portal proveedor]",
      }
    )

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })
    }

    const { data: validationWarnings } = await admin.rpc("validate_po_invoice_vs_oc", {
      p_invoice_id: result.invoice.id,
    })

    const warnings = (validationWarnings ?? []) as unknown[]
    await createPortalNotification(admin, {
      userId: session.userId,
      type: "portal_invoice_received",
      title: "Factura recibida",
      message: `Registramos su factura ${result.invoice.invoice_number}. Le avisaremos cuando haya novedades de pago.`,
      relatedEntity: "po_supplier_invoice",
      entityId: result.invoice.id,
    })

    if (warnings.length === 0) {
      await createPortalNotification(admin, {
        userId: session.userId,
        type: "portal_invoice_approved",
        title: "Factura validada",
        message: `Su factura ${result.invoice.invoice_number} fue validada contra la orden de compra.`,
        relatedEntity: "po_supplier_invoice",
        entityId: result.invoice.id,
      })
    }

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      validation_warnings: warnings,
    })
  } catch (error) {
    console.error("POST /api/portal-proveedores/facturas", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error interno",
      },
      { status: 500 }
    )
  }
}
