"use client"

import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { WorkAgendaBoard } from "@/components/agenda/work-agenda-board"

export default function AgendaPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Agenda de trabajos"
        text="Planeación semanal de órdenes de trabajo por mecánico, derivadas de incidencias y mantenimiento"
      />
      <Suspense fallback={<div className="h-64 rounded-lg bg-muted animate-pulse" />}>
        <WorkAgendaBoard />
      </Suspense>
    </DashboardShell>
  )
}
