'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { canAccessIngresosGastosReport } from '@/lib/reports/reports-catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function IngresosGastosAccessGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { profile, isLoading } = useAuthZustand()
  const allowed = profile ? canAccessIngresosGastosReport(profile) : false

  useEffect(() => {
    if (!isLoading && profile && !allowed) {
      router.replace('/reportes?error=ingresos_gastos_denied')
    }
  }, [isLoading, profile, allowed, router])

  if (isLoading || !profile) {
    return <p className="p-6 text-sm text-muted-foreground">Verificando permisos…</p>
  }

  if (!allowed) {
    return (
      <Card className="mx-4 my-8 max-w-lg border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base text-amber-950">Acceso restringido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-amber-900">
          <p>
            El reporte <strong>Ingresos vs gastos</strong> solo está disponible para{' '}
            <strong>Gerencia General</strong> y <strong>Jefe de Unidad de Negocio</strong>.
          </p>
          <Button variant="outline" asChild>
            <Link href="/reportes">Volver al centro de reportes</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
