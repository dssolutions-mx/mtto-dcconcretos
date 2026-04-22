import { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export const metadata: Metadata = {
  title: 'Retirar duplicados de catálogo · PR4',
}

export default function RetirarDuplicadosPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Fusión de modelos duplicados"
        text="Herramienta admin para fusionar filas SAVEIRO 2024 → SAVEIRO + fabrication_year (PR4)."
      />
    </DashboardShell>
  )
}
