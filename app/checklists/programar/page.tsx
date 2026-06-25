import type { Metadata } from "next"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ChecklistScheduleForm } from "@/components/checklists/checklist-schedule-form"
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Programar Checklist | Sistema de Gestión de Mantenimiento",
  description: "Programar un nuevo checklist para un activo",
}

export default function ScheduleChecklistPage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Programar checklist"
        text="Busque activos y plantillas, filtre por planta o frecuencia, y revise duplicados antes de asignar."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/checklists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Use <span className="font-medium text-foreground">Manual</span> para elegir plantilla y fecha, o{' '}
          <span className="font-medium text-foreground">Desde mantenimiento</span> para generar según modelo e intervalo.
          En activos <span className="font-medium text-foreground">PLANTA</span> se muestran plantillas con puntualidad o cierre de bono.
        </p>
      </div>

      <Suspense fallback={
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-sm">Cargando formulario...</span>
        </div>
      }>
        <ChecklistScheduleForm />
      </Suspense>
    </DashboardShell>
  )
} 