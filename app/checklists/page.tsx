"use client"

import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Loader2 } from "lucide-react"
import { ChecklistDashboard } from "@/components/checklists/dashboard/checklist-dashboard"

export default function ChecklistsPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <DashboardHeader heading="Checklists de Mantenimiento" text="Cargando..." />
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando datos...</span>
          </div>
        </DashboardShell>
      }
    >
      <ChecklistDashboard />
    </Suspense>
  )
}
