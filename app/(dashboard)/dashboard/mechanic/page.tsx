"use client"

import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardActionStrip } from "@/components/dashboard/dashboard-action-strip"
import { Wrench, Camera } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function MechanicDashboard() {
  const { profile, isInitialized, isLoading } = useAuthZustand()
  const router = useRouter()

  useEffect(() => {
    if (isInitialized && !isLoading && profile?.role && !['MECANICO'].includes(profile.role)) {
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

  if (profile.role !== 'MECANICO') {
    return null
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Bienvenido, ${profile.nombre} ${profile.apellido}`}
        text="Órdenes de trabajo asignadas y acciones disponibles."
      />
      <DashboardActionStrip
        icon={Wrench}
        count={0}
        label="órdenes de trabajo asignadas"
        href="/ordenes"
        ctaLabel="Ver mis OTs"
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/ordenes"
          className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Wrench className="h-4 w-4" />
          Ver todas las órdenes
        </Link>
      </div>
    </DashboardShell>
  )
}
