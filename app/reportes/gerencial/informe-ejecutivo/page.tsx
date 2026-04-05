import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { ExecutiveAnalyticalReportClient } from '@/components/reports/executive-analytical-report/executive-analytical-report-client'

export const metadata: Metadata = {
  title: 'Informe ejecutivo | Reporte gerencial',
  description:
    'Análisis de mantenimiento: costos por categoría, horas, ratios y concentración de gasto.',
}

export default function InformeEjecutivoPage() {
  return (
    <DashboardShell>
      <div className="executive-report-no-print">
        <DashboardHeader
          heading="Informe ejecutivo"
          text="Vista analítica para dirección: mismos indicadores que el reporte gerencial, con narrativa y gráficos en escala de grises."
        />
      </div>
      <ExecutiveAnalyticalReportClient />
    </DashboardShell>
  )
}
