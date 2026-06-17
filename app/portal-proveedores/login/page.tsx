import type { Metadata } from "next"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { PortalProveedoresLoginForm } from "@/components/portal-proveedores/portal-login-form"

export const metadata: Metadata = {
  title: "Iniciar sesión | Portal de proveedores",
  robots: { index: false, follow: false },
}

export default function PortalProveedoresLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      }
    >
      <PortalProveedoresLoginForm />
    </Suspense>
  )
}
