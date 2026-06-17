import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"
import { resolvePortalContext } from "@/lib/portal-proveedores/resolvePortalContext"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: "Panel | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default async function PortalProveedoresDashboardPage() {
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

  const { ctx } = resolved

  return (
    <PortalProveedoresShell showNav>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Panel del proveedor</h2>
          <p className="text-muted-foreground">
            Consulte sus órdenes de compra, envíe facturas CFDI y dé seguimiento al estatus.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Su cuenta</CardTitle>
            <CardDescription>Identidad fiscal vinculada al portal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Correo:</span> {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">RFC:</span> {ctx.rfc}
            </p>
            {ctx.supplierName ? (
              <p>
                <span className="text-muted-foreground">Proveedor:</span>{" "}
                {ctx.supplierName}
              </p>
            ) : (
              <p className="text-amber-700">
                Aún no hay un registro de proveedor vinculado en mantenimiento para este RFC.
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Estado:</span>{" "}
              {ctx.status === "active" ? "Activo" : ctx.status}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de compra</CardTitle>
              <CardDescription>
                Revise OC aprobadas y suba facturas contra cada una.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/portal-proveedores/ordenes">Ver órdenes</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facturas enviadas</CardTitle>
              <CardDescription>
                Historial de CFDI registrados desde el portal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/portal-proveedores/facturas">Ver facturas</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagos y saldos</CardTitle>
              <CardDescription>
                Consulte saldo pendiente y pagos recibidos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/portal-proveedores/pagos">Ver pagos</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          <Link href="/portal-proveedores" className="hover:underline">
            Volver al inicio del portal
          </Link>
        </p>
      </div>
    </PortalProveedoresShell>
  )
}
