import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { createAdminClient } from "@/lib/supabase-admin"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { listSupplierPurchaseOrders } from "@/lib/portal-proveedores/purchase-order-scope"
import {
  formatCurrency,
  formatDate,
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
  const orders = await listSupplierPurchaseOrders(admin, resolved.ctx)

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Órdenes de compra
          </h2>
          <p className="text-muted-foreground">
            Órdenes de mantenimiento disponibles para facturación con su RFC{" "}
            {resolved.ctx.rfc}.
          </p>
        </div>

        {!resolved.ctx.mttoSupplierId ? (
          <Card>
            <CardHeader>
              <CardTitle>Vinculación pendiente</CardTitle>
              <CardDescription>
                Su cuenta aún no está ligada a un proveedor en el padrón de
                mantenimiento. Compras debe completar la vinculación para ver
                todas sus OC.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No hay órdenes de compra disponibles para facturar en este momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.order_id}</p>
                      <Badge variant="secondary">{formatPoStatus(order.status)}</Badge>
                      {order.invoice_count > 0 ? (
                        <Badge variant="outline">
                          {order.invoice_count} factura
                          {order.invoice_count === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.supplier ?? "Proveedor"} ·{" "}
                      {formatCurrency(order.total_amount)} ·{" "}
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/portal-proveedores/ordenes/${order.id}`}>
                      Ver detalle
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
