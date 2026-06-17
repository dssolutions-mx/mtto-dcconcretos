import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { assertCotizadorPurchaseOrderAccess } from "@/lib/portal-proveedores/cotizador-purchase-orders"
import {
  formatCurrency,
  formatDate,
  formatPoSource,
  formatPoStatus,
} from "@/lib/portal-proveedores/format"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
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
  title: "Detalle OC cotizador | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalCotizadorOrdenDetallePage({
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

  const access = await assertCotizadorPurchaseOrderAccess(resolved.ctx, id)
  if (!access.ok) {
    if (access.status === 404) notFound()
    redirect("/portal-proveedores/ordenes")
  }

  const order = access.po

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
              <Link href="/portal-proveedores/ordenes">← Volver a órdenes</Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {order.order_id}
              </h2>
              <Badge variant="outline">{formatPoSource("cotizador")}</Badge>
            </div>
            <p className="text-muted-foreground">
              {order.supplier ?? "Proveedor"} · {formatPoStatus(order.status)}
              {order.plant_name ? ` · ${order.plant_name}` : ""}
            </p>
          </div>
          <Badge variant="secondary">{formatCurrency(order.total_amount)}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>
              Consulta de solo lectura — la facturación contra OC del cotizador
              se habilitará en una fase posterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Fecha OC:</span>{" "}
              {formatDate(order.po_date ?? order.created_at)}
            </p>
            <p>
              <span className="text-muted-foreground">Moneda:</span>{" "}
              {order.currency}
            </p>
            <p>
              <span className="text-muted-foreground">Plazo de pago:</span>{" "}
              {order.payment_terms_days != null
                ? `${order.payment_terms_days} días`
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Recibido:</span>{" "}
              {order.qty_received} de {order.qty_ordered} unidades
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
            <CardTitle>Líneas de la orden</CardTitle>
          </CardHeader>
          <CardContent>
            {order.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta OC no tiene líneas registradas.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{line.description}</p>
                      <p className="text-muted-foreground">
                        {line.qty_received} / {line.qty_ordered}{" "}
                        {line.uom ?? "u"} · {formatCurrency(line.unit_price)} c/u
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(line.line_total)}</p>
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
