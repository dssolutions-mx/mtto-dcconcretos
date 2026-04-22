import { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { FleetPageClient } from '@/components/assets/fleet/fleet-page'

export const metadata: Metadata = {
  title: 'Flota · Activos | Mantenimiento',
  description: 'Vista de flota: árbol, confianza y datos',
}

export default function FlotaPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Flota de activos"
        text="Organización jerárquica, confianza de datos y corrección rápida"
      />
      <div className="px-4 pb-8">
        <FleetPageClient />
      </div>
    </DashboardShell>
  )
}
