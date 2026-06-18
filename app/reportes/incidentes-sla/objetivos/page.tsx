import type { Metadata } from 'next'
import { SlaTargetsAdmin } from '@/components/incidents/sla-targets/sla-targets-admin'
import { canManageIncidentSlaTargets } from '@/lib/incidents/incident-sla-targets'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Objetivos SLA de incidencias | Sistema de Mantenimiento',
  description: 'Administración de políticas SLA para tiempos de atención, programación y resolución.',
}

function SlaTargetsAccessDenied() {
  return (
    <div className="container mx-auto py-8">
      <p className="text-center text-muted-foreground">
        No tienes permiso para administrar objetivos SLA. Se requiere liderazgo de mantenimiento o
        acceso de configuración.
      </p>
    </div>
  )
}

export default async function IncidentSlaTargetsAdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_role')
    .eq('id', user.id)
    .single()

  if (!profile || !canManageIncidentSlaTargets(profile)) {
    return <SlaTargetsAccessDenied />
  }

  return (
    <div className="container mx-auto py-6">
      <SlaTargetsAdmin />
    </div>
  )
}
