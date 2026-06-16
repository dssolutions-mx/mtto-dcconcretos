"use client"

import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PlanningCenter } from "@/components/planning/planning-center"

export default function AgendaPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Centro de planificación"
        text="Agenda de trabajos, ventanas de servicio por unidad y verificación de disponibilidad vs producción"
      />
      <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" />}>
        <PlanningCenter />
      </Suspense>
    </DashboardShell>
  )
}
