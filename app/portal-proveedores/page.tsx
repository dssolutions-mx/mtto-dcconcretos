import Link from "next/link"
import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function PortalProveedoresLandingPage() {
  return (
    <PortalProveedoresShell>
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Bienvenido al portal de proveedores</CardTitle>
          <CardDescription>
            Consulte sus órdenes de compra, envíe facturas (CFDI) y dé seguimiento
            a sus pagos. El acceso estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild disabled>
            <Link href="/portal-proveedores/login">Iniciar sesión</Link>
          </Button>
          <p className="text-sm text-muted-foreground self-center">
            Fase 1 (auth) — próximo sprint
          </p>
        </CardContent>
      </Card>
    </PortalProveedoresShell>
  )
}
