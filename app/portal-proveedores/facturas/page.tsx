import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { normalizeSupplierRfc } from "@/lib/portal-proveedores/rfc"
import {
  formatCurrency,
  formatDate,
} from "@/lib/portal-proveedores/format"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { PO_INVOICE_STATUS_LABELS } from "@/types/po-invoices"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: "Facturas | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalFacturasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/portal-proveedores/login")
  }

  const resolved = await resolvePortalContext(supabase, user.id)
  if (!resolved.ok) {
    redirect("/portal-proveedores/login?error=portal_access")
  }

  const admin = createAdminClient()
  const portalRfc = normalizeSupplierRfc(resolved.ctx.rfc)

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
      created_at,
      purchase_orders ( order_id )
    `
    )
    .order("created_at", { ascending: false })
    .limit(100)

  if (resolved.ctx.mttoSupplierId) {
    query = query.or(
      `cfdi_emisor_rfc.eq.${portalRfc},supplier_id.eq.${resolved.ctx.mttoSupplierId}`
    )
  } else {
    query = query.eq("cfdi_emisor_rfc", portalRfc)
  }

  const { data } = await query

  const invoices = (data ?? []).map((row) => {
    const po = row.purchase_orders as { order_id?: string } | null
    return {
      id: row.id as string,
      purchase_order_id: row.purchase_order_id as string,
      order_id: po?.order_id ?? null,
      invoice_number: row.invoice_number as string,
      invoice_date: row.invoice_date as string,
      total: Number(row.total),
      status: row.status as string,
      cfdi_uuid: row.cfdi_uuid as string | null,
      created_at: row.created_at as string,
    }
  })

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Mis facturas</h2>
          <p className="text-muted-foreground">
            Facturas enviadas desde el portal con su RFC {resolved.ctx.rfc}.
          </p>
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <p className="text-muted-foreground">
                Aún no ha enviado facturas desde el portal.
              </p>
              <Button asChild>
                <Link href="/portal-proveedores/ordenes">Ver órdenes de compra</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Historial</CardTitle>
              <CardDescription>{invoices.length} factura(s) registrada(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      OC {inv.order_id ?? inv.purchase_order_id.slice(0, 8)} ·{" "}
                      {formatDate(inv.invoice_date)} · {formatCurrency(inv.total)}
                      {inv.cfdi_uuid ? " · CFDI" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {PO_INVOICE_STATUS_LABELS[
                        inv.status as keyof typeof PO_INVOICE_STATUS_LABELS
                      ] ?? inv.status}
                    </Badge>
                    {inv.order_id ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/portal-proveedores/ordenes/${inv.purchase_order_id}`}>
                          Ver OC
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalProveedoresShell>
  )
}
