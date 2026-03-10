"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { CreationEntryStep } from "@/components/checklists/template-creation/creation-entry-step"
import { TemplateCreationStepper } from "@/components/checklists/template-creation/template-creation-stepper"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

function CreateChecklistTemplateContent() {
  const searchParams = useSearchParams()
  const preSelectedModelId = searchParams.get("model") ?? undefined
  const [flowStage, setFlowStage] = useState<"entry" | "wizard">("entry")

  // If a model is pre-selected, go back to the templates tab, otherwise go to checklists page
  const backUrl = preSelectedModelId
    ? `/checklists?tab=templates`
    : "/checklists"

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Crear Plantilla de Checklist"
        text={
          preSelectedModelId
            ? "Define una nueva plantilla de checklist para el modelo seleccionado."
            : "Define una nueva plantilla de checklist para mantenimiento preventivo."
        }
      >
        <Button variant="outline" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
      </DashboardHeader>
      {flowStage === "entry" ? (
        <CreationEntryStep
          preSelectedModelId={preSelectedModelId || undefined}
          onFromScratch={() => setFlowStage("wizard")}
        />
      ) : (
        <TemplateCreationStepper preSelectedModelId={preSelectedModelId} />
      )}
    </DashboardShell>
  )
}

export default function CreateChecklistTemplatePage() {
  return (
    <Suspense fallback={
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
        <div>Cargando...</div>
      </DashboardShell>
    }>
      <CreateChecklistTemplateContent />
    </Suspense>
  )
}
