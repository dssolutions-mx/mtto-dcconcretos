import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MaintenanceSchedule } from "@/components/schedule/maintenance-schedule"
import { Plus } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Calendario | Sistema de Gestión de Mantenimiento",
  description: "Planificación y calendario de mantenimientos",
}

export default function SchedulePage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Planificación y Calendario"
        text="Programa y visualiza los mantenimientos preventivos y vencimientos de garantías."
      >
        <Button asChild>
          <Link href="/checklists/programar">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Programar</span>
          </Link>
        </Button>
      </DashboardHeader>
      <MaintenanceSchedule />
    </DashboardShell>
  )
}
