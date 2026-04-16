'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CostAnalysisDashboard } from '@/components/reports/cost-analysis/cost-analysis-dashboard'

export default function AnalisisCostosPage() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link href="/reportes/gerencial/ingresos-gastos">
              <ArrowLeft className="mr-2 h-3.5 w-3.5" />
              Ingresos vs Gastos
            </Link>
          </Button>
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)' }}
          >
            Centro de mando financiero
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Ingresos, costos y rentabilidad — investigación interactiva. Navegue del resumen al detalle de cada planta en un clic.
          </p>
        </div>
      </div>

      <CostAnalysisDashboard />
    </div>
  )
}
