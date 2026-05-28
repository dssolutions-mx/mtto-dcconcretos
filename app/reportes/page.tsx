import type { Metadata } from 'next'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { ReportsHub } from '@/components/reports/reports-hub'

export const metadata: Metadata = {
  title: 'Centro de reportes | Sistema de Gestión de Mantenimiento',
  description: 'Acceso a reportes gerenciales, eficiencia diésel e informes de mantenimiento',
}

export default function ReportsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Centro de reportes"
        text="Reportes gerenciales, informe de mantenimiento, ingresos-gastos y eficiencia diésel en un solo lugar."
      />
      <ReportsHub />
    </DashboardShell>
  )
}
