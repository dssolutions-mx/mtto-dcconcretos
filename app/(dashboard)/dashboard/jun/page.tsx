"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import { Building2, ClipboardList } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function JUNDashboard() {
  const { profile, isInitialized, isLoading } = useAuthZustand()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && !isLoading && profile?.role && profile.role !== 'JEFE_UNIDAD_NEGOCIO') {
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

  if (profile.role !== 'JEFE_UNIDAD_NEGOCIO') {
    return null
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Bienvenido, ${profile.nombre} ${profile.apellido}`}
        text="Resumen de tu unidad de negocio."
      />
      <DashboardActionStrip
        icon={Building2}
        count={0}
        label="servicios pendientes en tu unidad"
        href="/ordenes"
        ctaLabel="Ver servicios"
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/compliance"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ClipboardList className="h-4 w-4" />
          Cumplimiento checklist
        </Link>
      </div>
    </DashboardShell>
  )
}
