import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ChecklistExecution } from "@/components/checklists/checklist-execution"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { use } from "react"

export const metadata: Metadata = {
  title: "Ejecutar Checklist | Sistema de Gestión de Mantenimiento",
  description: "Ejecutar un checklist de mantenimiento",
}

export default function ExecuteChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Ejecutar Checklist: ${id}`}
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
