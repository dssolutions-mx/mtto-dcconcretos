import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TemplateEditor } from "@/components/checklists/template-editor"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Crear Plantilla de Checklist | Sistema de Gestión de Mantenimiento",
  description: "Crear una nueva plantilla de checklist para mantenimiento",
}

export default function CreateChecklistTemplatePage() {
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Plantilla de Checklist"
        text="Define una nueva plantilla de checklist para mantenimiento preventivo."
      >
        <Button variant="outline" asChild>
          <Link href="/checklists">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      <TemplateEditor />
    </DashboardShell>
  )
}
