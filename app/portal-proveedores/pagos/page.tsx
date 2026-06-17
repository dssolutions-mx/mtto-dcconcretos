import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import {
  formatCurrency,
  formatDate,
  formatPoSource,
} from "@/lib/portal-proveedores/format"
import { loadPortalPaymentSummary } from "@/lib/portal-proveedores/payment-summary"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { PO_INVOICE_STATUS_LABELS } from "@/types/po-invoices"
import type { PoInvoiceStatus } from "@/types/po-invoices"
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
  title: "Pagos y saldos | Portal de proveedores",
  robots: { index: false, follow: false },
}

function statusLabel(status: string): string {
  return (
    PO_INVOICE_STATUS_LABELS[status as PoInvoiceStatus] ??
    (status === "partially_paid" ? "Parcialmente pagada" : status)
  )
}

function SummaryCard({
  title,
  summary,
}: {
  title: string
  summary: {
    invoice_count: number
    open_count: number
    partially_paid_count: number
    paid_count: number
    total_invoiced: number
    total_paid: number
    total_balance: number
    configured: boolean
  }
}) {
  if (!summary.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Sistema no configurado en este entorno.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{summary.invoice_count} factura(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Facturado</span>
          <span className="font-medium">{formatCurrency(summary.total_invoiced)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Pagado</span>
          <span className="font-medium text-green-700">
            {formatCurrency(summary.total_paid)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-t pt-2">
          <span className="text-muted-foreground">Saldo pendiente</span>
          <span className="font-semibold">{formatCurrency(summary.total_balance)}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {summary.open_count > 0 ? (
            <Badge variant="outline">{summary.open_count} abierta(s)</Badge>
          ) : null}
          {summary.partially_paid_count > 0 ? (
            <Badge variant="outline">
              {summary.partially_paid_count} parcial(es)
            </Badge>
          ) : null}
          {summary.paid_count > 0 ? (
            <Badge variant="secondary">{summary.paid_count} pagada(s)</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function PortalPagosPage() {
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
  const summary = await loadPortalPaymentSummary(admin, resolved.ctx)

  const openInvoices = summary.invoices.filter(
    (inv) => inv.status === "open" || inv.status === "partially_paid"
  )

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pagos y saldos</h2>
          <p className="text-muted-foreground">
            Resumen de facturas abiertas, pagadas y saldo pendiente por sistema.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard title="Consolidado" summary={summary.combined} />
          <SummaryCard title="Mantenimiento" summary={summary.mtto} />
          <SummaryCard title="Cotizador" summary={summary.cotizador} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Facturas con saldo</CardTitle>
            <CardDescription>
              {openInvoices.length === 0
                ? "No hay facturas pendientes de pago."
                : `${openInvoices.length} factura(s) con saldo pendiente`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Cuando registremos pagos contra sus facturas, aparecerán aquí.
              </p>
            ) : (
              openInvoices.map((inv) => (
                <div
                  key={`${inv.source}-${inv.id}`}
                  className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{inv.invoice_number}</p>
                      <Badge variant="secondary">{formatPoSource(inv.source)}</Badge>
                      {inv.is_overdue ? (
                        <Badge variant="destructive">Vencida</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(inv.invoice_date)}
                      {inv.due_date ? ` · Vence ${formatDate(inv.due_date)}` : ""}
                      {inv.order_id ? ` · OC ${inv.order_id}` : ""}
                    </p>
                    <p className="text-sm">
                      Total {formatCurrency(inv.total)} · Pagado{" "}
                      {formatCurrency(inv.paid_to_date)} · Saldo{" "}
                      <span className="font-medium">{formatCurrency(inv.balance)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{statusLabel(inv.status)}</Badge>
                    {inv.source === "mtto" && inv.purchase_order_id ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/portal-proveedores/ordenes/${inv.purchase_order_id}`}>
                          Ver OC
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagos recientes</CardTitle>
            <CardDescription>
              Últimos pagos registrados contra sus facturas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.recent_payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay pagos registrados para su RFC.
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.recent_payments.map((payment) => (
                  <li
                    key={`${payment.source}-${payment.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payment.amount)} · {payment.invoice_number}
                      </p>
                      <p className="text-muted-foreground">
                        {formatDate(payment.payment_date)} · {formatPoSource(payment.source)}
                        {payment.reference ? ` · Ref. ${payment.reference}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalProveedoresShell>
  )
}
