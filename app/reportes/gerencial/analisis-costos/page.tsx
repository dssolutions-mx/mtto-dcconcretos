'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CostAnalysisDashboard } from '@/components/reports/cost-analysis/cost-analysis-dashboard'

export default function AnalisisCostosPage() {
  return (
    <div className="container mx-auto max-w-[1600px] space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="outline" size="sm" asChild className="mb-2 w-fit">
            <Link href="/reportes/gerencial/ingresos-gastos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ingresos vs Gastos
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Análisis de costos operativos</h1>
          <p className="text-muted-foreground">
            Tendencias de nómina e indirectos, categorías de gasto y comparativo por planta para dirección.
          </p>
        </div>
      </div>

      <CostAnalysisDashboard />
    </div>
  )
}
