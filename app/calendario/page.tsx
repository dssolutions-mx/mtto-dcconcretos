import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MaintenanceSchedule } from "@/components/schedule/maintenance-schedule"
import { Plus, FileDown } from "lucide-react"

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
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Programar
          </Button>
        </div>
      </DashboardHeader>
      <MaintenanceSchedule />
    </DashboardShell>
  )
}
