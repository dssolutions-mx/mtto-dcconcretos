import { Metadata } from "next"
import { MaintenanceChecklistExecution } from "@/components/checklists/maintenance-checklist-execution"

export const metadata: Metadata = {
  title: "Checklist de Mantenimiento | Sistema de Gestión",
  description: "Completar checklist de mantenimiento preventivo",
}

export default function MaintenanceChecklistPage({
  params,
}: {
  params: { workOrderId: string }
}) {
  return (
    <div className="container mx-auto py-6">
      <MaintenanceChecklistExecution workOrderId={params.workOrderId} />
    </div>
  )
} 