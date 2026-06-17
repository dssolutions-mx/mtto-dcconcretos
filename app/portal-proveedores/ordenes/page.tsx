import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import {
  detailHref,
  listConsolidatedPurchaseOrders,
} from "@/lib/portal-proveedores/consolidated-purchase-orders"
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
  title: "Órdenes de compra | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalOrdenesPage() {
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
  const { orders, mtto_linked, cotizador_linked, cotizador_configured } =
    await listConsolidatedPurchaseOrders(admin, resolved.ctx)

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Órdenes de compra
          </h2>
          <p className="text-muted-foreground">
            Órdenes de mantenimiento y del cotizador ERP disponibles para su RFC{" "}
            {resolved.ctx.rfc}.
          </p>
        </div>

        {!mtto_linked ? (
          <Card>
            <CardHeader>
              <CardTitle>Vinculación pendiente (mantenimiento)</CardTitle>
              <CardDescription>
                Su cuenta aún no está ligada a un proveedor en el padrón de
                mantenimiento. Compras debe completar la vinculación para ver
                todas sus OC de ese sistema.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {cotizador_configured && !cotizador_linked ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin OC del cotizador</CardTitle>
              <CardDescription>
                No hay un grupo de proveedor del cotizador vinculado a su RFC.
                Compras puede asignar el `cotizador_group_id` en su invitación.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No hay órdenes de compra disponibles en este momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={`${order.source}-${order.id}`}>
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.order_id}</p>
                      <Badge variant="outline">{formatPoSource(order.source)}</Badge>
                      <Badge variant="secondary">{formatPoStatus(order.status)}</Badge>
                      {order.source === "mtto" && order.invoice_count > 0 ? (
                        <Badge variant="outline">
                          {order.invoice_count} factura
                          {order.invoice_count === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.supplier ?? "Proveedor"}
                      {order.plant_label ? ` · ${order.plant_label}` : ""} ·{" "}
                      {formatCurrency(order.total_amount)} ·{" "}
                      {formatDate(order.created_at)}
                    </p>
                    {order.source === "cotizador" &&
                    order.qty_ordered != null &&
                    order.qty_received != null ? (
                      <p className="text-xs text-muted-foreground">
                        Recibido {order.qty_received} de {order.qty_ordered} unidades
                      </p>
                    ) : null}
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={detailHref(order)}>
                      {order.can_upload_invoice ? "Ver y facturar" : "Ver detalle"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalProveedoresShell>
  )
}
