import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ExecutiveReport } from "@/components/analytics/executive-report"
import { FileDown, Share } from "lucide-react"

export const metadata: Metadata = {
  title: "Reportes | Sistema de Gestión de Mantenimiento",
  description: "Dashboard analítico y reportes",
}

export default function ReportsPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Dashboard Analítico y Reportes"
        text="Visualiza indicadores clave y genera reportes personalizados."
      >
        <div className="flex gap-2">
          <Button variant="outline">
            <Share className="mr-2 h-4 w-4" />
            Compartir
          </Button>
          <Button>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </DashboardHeader>
      <ExecutiveReport />
    </DashboardShell>
  )
}
