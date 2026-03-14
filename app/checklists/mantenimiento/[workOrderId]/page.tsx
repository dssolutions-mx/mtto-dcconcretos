import { Metadata } from "next"
import { MaintenanceChecklistExecution } from "@/components/checklists/maintenance-checklist-execution"

export const metadata: Metadata = {
  title: "Checklist de Mantenimiento | Sistema de Gestión",
  description: "Completar checklist de mantenimiento preventivo",
}

export default async function MaintenanceChecklistPage({
  params,
}: {
  params: Promise<{ workOrderId: string }>
}) {
  const { workOrderId } = await params
  return (
    <div className="container mx-auto py-6">
      <MaintenanceChecklistExecution workOrderId={workOrderId} />
    </div>
  )
} 