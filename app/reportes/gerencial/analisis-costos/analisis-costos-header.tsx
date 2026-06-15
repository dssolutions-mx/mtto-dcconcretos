'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { canAccessIngresosGastosReport } from '@/lib/reports/reports-catalog'

export function AnalisisCostosHeader() {
  const { profile } = useAuthZustand()
  const showIngresosLink = profile ? canAccessIngresosGastosReport(profile) : false

  return (
    <div className="space-y-1.5">
      <Button variant="outline" size="sm" asChild className="w-fit">
        <Link
          href={
            showIngresosLink
              ? '/reportes/gerencial/ingresos-gastos'
              : '/reportes/gerencial'
          }
        >
          <ArrowLeft className="mr-2 h-3.5 w-3.5" />
          {showIngresosLink ? 'Ingresos vs Gastos' : 'Reporte gerencial'}
        </Link>
      </Button>
      <h1
        className="font-bold tracking-tight"
        style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
      >
        Centro de mando financiero
      </h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Ingresos, costos y rentabilidad — investigación interactiva. Navegue del resumen al
        detalle de cada planta en un clic.
      </p>
    </div>
  )
}
