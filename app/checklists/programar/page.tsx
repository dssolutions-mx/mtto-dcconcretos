import type { Metadata } from "next"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ChecklistScheduleForm } from "@/components/checklists/checklist-schedule-form"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Programar Checklist | Sistema de Gestión de Mantenimiento",
  description: "Programar un nuevo checklist para un activo",
}

export default function ScheduleChecklistPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Programar Checklist"
        text="Asigne un checklist a un activo y un técnico para una fecha específica."
      >
        <Button variant="outline" asChild>
          <Link href="/checklists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <Suspense fallback={
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando formulario...</span>
        </div>
      }>
        <ChecklistScheduleForm />
      </Suspense>
    </DashboardShell>
  )
} 