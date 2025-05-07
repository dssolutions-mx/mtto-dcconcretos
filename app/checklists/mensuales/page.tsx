import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MonthlyChecklistList } from "@/components/checklists/monthly-checklist-list"
import { Plus, FileDown } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Checklists Mensuales | Sistema de Gestión de Mantenimiento",
  description: "Gestión de checklists mensuales para mantenimiento",
}

export default function MonthlyChecklistsPage() {
  return (
    <DashboardShell>
      <DashboardHeader heading="Checklists Mensuales" text="Gestiona los checklists mensuales para diferentes equipos.">
        <div className="flex gap-2">
          <Button variant="outline">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button asChild>
            <Link href="/checklists/crear?frequency=monthly">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Checklist
            </Link>
          </Button>
        </div>
      </DashboardHeader>
      <MonthlyChecklistList />
    </DashboardShell>
  )
}
