import { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export const metadata: Metadata = {
  title: 'Políticas de confianza · Catálogo',
}

export default function ConfianzaCatalogoPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Políticas de confianza (PR2)"
        text="Ventana por campo: próximamente."
      />
    </DashboardShell>
  )
}
