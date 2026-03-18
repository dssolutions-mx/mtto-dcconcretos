import type { Metadata } from "next"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MaintenanceSchedule } from "@/components/schedule/maintenance-schedule"

export const metadata: Metadata = {
  title: "Calendario | Sistema de Gestión de Mantenimiento",
  description: "Planificación y calendario de mantenimientos preventivos y vencimientos de garantías",
}

export default function SchedulePage() {
  return (
    <DashboardShell>
      <MaintenanceSchedule />
    </DashboardShell>
  )
}
