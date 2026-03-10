"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CreationEntryStep } from "@/components/checklists/template-creation/creation-entry-step"
import { TemplateCreationStepper } from "@/components/checklists/template-creation/template-creation-stepper"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function CreateChecklistTemplateContent() {
  const searchParams = useSearchParams()
  const preSelectedModelId = searchParams.get("model") ?? undefined
  const [flowStage, setFlowStage] = useState<"entry" | "wizard">("entry")

  const backUrl = preSelectedModelId
    ? `/checklists/plantillas?model=${preSelectedModelId}`
    : "/checklists/plantillas"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Crear Plantilla de Checklist</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {preSelectedModelId
                ? "Define una nueva plantilla para el modelo seleccionado."
                : "Define una nueva plantilla de checklist para mantenimiento preventivo."}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href={backUrl}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {flowStage === "entry" ? (
          <CreationEntryStep
            preSelectedModelId={preSelectedModelId || undefined}
            onFromScratch={() => setFlowStage("wizard")}
          />
        ) : (
          <TemplateCreationStepper preSelectedModelId={preSelectedModelId} />
        )}
      </CardContent>
    </Card>
  )
}

export default function CreateChecklistTemplatePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      }
    >
      <CreateChecklistTemplateContent />
    </Suspense>
  )
}
