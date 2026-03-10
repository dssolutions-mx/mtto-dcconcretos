"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/ui/stepper"
import { ChevronLeft, ChevronRight } from "lucide-react"

const STEPS = [
  { label: "Información básica" },
  { label: "Secciones" },
  { label: "Revisar" },
]

interface TemplateCreationStepperProps {
  preSelectedModelId?: string
}

export function TemplateCreationStepper({
  preSelectedModelId,
}: TemplateCreationStepperProps) {
  const [currentStep, setCurrentStep] = useState(0)

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} currentStep={currentStep} />
      <div className="rounded-lg border bg-card p-6">
        {currentStep === 0 && (
          <div>
            <p className="text-muted-foreground">Paso 1 de 3: Información básica</p>
            <p className="mt-4 text-sm">(Placeholder - BasicInfoCard será integrado en Task 3)</p>
          </div>
        )}
        {currentStep === 1 && (
          <div>
            <p className="text-muted-foreground">Paso 2 de 3: Secciones</p>
            <p className="mt-4 text-sm">(Placeholder - SectionsStep será integrado en Task 4)</p>
          </div>
        )}
        {currentStep === 2 && (
          <div>
            <p className="text-muted-foreground">Paso 3 de 3: Revisar</p>
            <p className="mt-4 text-sm">(Placeholder - ReviewStep será integrado en Task 5)</p>
          </div>
        )}
      </div>
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          aria-label="Paso anterior"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Atrás
        </Button>
        {currentStep < 2 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            aria-label="Siguiente paso"
          >
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled aria-label="Guardar plantilla">
            Guardar plantilla
          </Button>
        )}
      </div>
    </div>
  )
}
