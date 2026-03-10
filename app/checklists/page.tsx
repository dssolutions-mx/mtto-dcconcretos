"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Loader2 } from "lucide-react"
import { ChecklistDashboard } from "@/components/checklists/dashboard/checklist-dashboard"

function ChecklistsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams?.get("tab") === "templates") {
      const model = searchParams.get("model")
      const target = model
        ? `/checklists/plantillas?model=${model}`
        : "/checklists/plantillas"
      router.replace(target)
    }
  }, [router, searchParams])

  if (searchParams?.get("tab") === "templates") {
    return (
      <DashboardShell>
        <DashboardHeader heading="Checklists de Mantenimiento" text="Redirigiendo..." />
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Redirigiendo a plantillas...</span>
        </div>
      </DashboardShell>
    )
  }

  return <ChecklistDashboard />
}

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
      <ChecklistsPageContent />
    </Suspense>
  )
}
