"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { canAccessRHReportingNav } from "@/lib/auth/client-authorization"
import { Loader2, ShieldAlert } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function RHReportingGuard({ children }: { children: React.ReactNode }) {
  const { profile, isInitialized, isLoading } = useAuthZustand()
  const router = useRouter()

  if (!isInitialized || isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile || !canAccessRHReportingNav(profile)) {
    return (
      <div className="container mx-auto flex min-h-[320px] items-center justify-center px-4 py-8">
        <Card className="max-w-md">
          <CardHeader>
            <ShieldAlert className="mb-2 h-10 w-10 text-destructive" />
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>
              Los reportes de Recursos Humanos solo están disponibles para RRHH y Gerencia General.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
