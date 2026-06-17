import { redirect } from "next/navigation"
import Link from "next/link"
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
    <PortalProveedoresShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Panel del proveedor</h2>
          <p className="text-muted-foreground">
            Bienvenido. Aquí verá sus órdenes de compra, facturas y pagos (próximas fases).
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

        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>Fase 2 — facturas contra OC</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" disabled>
              Subir factura (CFDI)
            </Button>
            <Button variant="outline" disabled>
              Ver órdenes de compra
            </Button>
            <Button variant="outline" disabled>
              Consultar pagos
            </Button>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          <Link href="/portal-proveedores" className="hover:underline">
            Volver al inicio del portal
          </Link>
        </p>
      </div>
    </PortalProveedoresShell>
  )
}
