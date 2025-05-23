import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ChecklistExecution } from "@/components/checklists/checklist-execution"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ExecuteChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Ejecutar Checklist`}
        text="Complete el checklist de mantenimiento para el equipo seleccionado."
      >
        <Button variant="outline" asChild>
          <Link href="/checklists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <ChecklistExecution id={id} />
    </DashboardShell>
  )
}
