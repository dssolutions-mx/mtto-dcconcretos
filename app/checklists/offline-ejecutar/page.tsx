"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { ChecklistExecution } from "@/components/checklists/checklist-execution"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { getOfflineChecklistId } from "@/lib/offline/offline-client"

function OfflineExecuteContent() {
  const searchParams = useSearchParams()
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = searchParams.get("id")
    const fromSession = getOfflineChecklistId()
    setId(fromQuery ?? fromSession)
  }, [searchParams])

  if (!id) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Checklist offline"
          text="Seleccione un checklist desde la lista de checklists."
        />
        <Button variant="outline" asChild className="min-h-[44px]">
          <a href="/checklists">Volver a checklists</a>
        </Button>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Ejecutar Checklist"
        text="Complete el checklist de mantenimiento para el equipo seleccionado."
      >
        <Button variant="outline" asChild className="min-h-[44px]">
          <a href="/checklists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </a>
        </Button>
      </DashboardHeader>
      <ChecklistExecution id={id} />
    </DashboardShell>
  )
}

export default function OfflineExecutePage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <DashboardHeader heading="Ejecutar Checklist" text="Cargando checklist…" />
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardShell>
      }
    >
      <OfflineExecuteContent />
    </Suspense>
  )
}
