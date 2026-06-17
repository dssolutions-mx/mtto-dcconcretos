import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { assertPurchaseOrderAccess } from "@/lib/portal-proveedores/purchase-order-scope"
import {
  formatCurrency,
  formatDate,
  formatPoStatus,
} from "@/lib/portal-proveedores/format"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { PortalInvoiceForm } from "@/components/portal-proveedores/portal-invoice-form"
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
  title: "Detalle OC | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalOrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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
  const access = await assertPurchaseOrderAccess(admin, resolved.ctx, id)
  if (!access.ok) {
    if (access.status === 404) notFound()
    redirect("/portal-proveedores/ordenes")
  }

  const { data: invoices } = await admin
    .from("po_invoice_balances")
    .select(
      "invoice_id, invoice_number, invoice_date, total, invoice_status, paid_to_date, balance, cfdi_uuid"
    )
    .eq("purchase_order_id", id)
    .order("invoice_date", { ascending: false })

  const order = access.po

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link href="/portal-proveedores/ordenes">← Volver a órdenes</Link>
            </Button>
            <h2 className="text-2xl font-semibold tracking-tight">
              {order.order_id}
            </h2>
            <p className="text-muted-foreground">
              {order.supplier ?? "Proveedor"} · {formatPoStatus(order.status)}
            </p>
          </div>
          <Badge variant="secondary">{formatCurrency(order.total_amount)}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Fecha:</span>{" "}
              {formatDate(order.created_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Tipo:</span>{" "}
              {order.po_type ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Propósito:</span>{" "}
              {order.po_purpose ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Contabilidad:</span>{" "}
              {order.accounting_status ?? "—"}
            </p>
            {order.notes ? (
              <p className="sm:col-span-2">
                <span className="text-muted-foreground">Notas:</span> {order.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Facturas registradas</CardTitle>
            <CardDescription>
              Facturas enviadas contra esta orden de compra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(invoices ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay facturas para esta OC.
              </p>
            ) : (
              <ul className="space-y-2">
                {(invoices ?? []).map((inv) => (
                  <li
                    key={inv.invoice_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{inv.invoice_number}</p>
                      <p className="text-muted-foreground">
                        {formatDate(inv.invoice_date)} · {formatCurrency(Number(inv.total))}
                        {inv.cfdi_uuid ? " · CFDI" : ""}
                      </p>
                      <p className="text-muted-foreground">
                        Pagado {formatCurrency(Number(inv.paid_to_date))} · Saldo{" "}
                        <span className="font-medium text-foreground">
                          {formatCurrency(Number(inv.balance))}
                        </span>
                      </p>
                    </div>
                    <Badge variant="outline">
                      {PO_INVOICE_STATUS_LABELS[
                        inv.invoice_status as keyof typeof PO_INVOICE_STATUS_LABELS
                      ] ?? inv.invoice_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <PortalInvoiceForm
              purchaseOrderId={order.id}
              orderLabel={order.order_id}
              poPreTaxAmount={order.total_amount}
            />
          </CardContent>
        </Card>
      </div>
    </PortalProveedoresShell>
  )
}
