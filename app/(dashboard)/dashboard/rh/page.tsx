"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import { Users, FileText } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function RHDashboard() {
  const { profile, isInitialized, isLoading } = useAuthZustand()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && !isLoading && profile?.role && profile.role !== 'RECURSOS_HUMANOS') {
      router.push('/dashboard')
    }
  }, [isInitialized, isLoading, profile?.role, router])

  if (!isInitialized || isLoading || !profile) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Cargando..." text="Preparando tu dashboard." />
      </DashboardShell>
    )
  }

  if (profile.role !== 'RECURSOS_HUMANOS') {
    return null
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Bienvenido, ${profile.nombre} ${profile.apellido}`}
        text="Gestión de usuarios y conciliación de incidencias."
      />
      <DashboardActionStrip
        icon={FileText}
        count={0}
        label="incidencias en conciliación"
        href="/compliance/incidentes"
        ctaLabel="Conciliar"
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/gestion/personal"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Users className="h-4 w-4" />
          Gestionar usuarios
        </Link>
      </div>
    </DashboardShell>
  )
}
