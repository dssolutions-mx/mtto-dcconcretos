"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/ui/stepper"
import { BasicInfoCard } from "@/components/checklists/template-editor/basic-info-card"
import { SectionsStep } from "@/components/checklists/template-creation/sections-step"
import { ReviewStep } from "@/components/checklists/template-creation/review-step"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ChecklistTemplate } from "./types"

const STEPS = [
  { label: "Información básica" },
  { label: "Secciones" },
  { label: "Revisar" },
]

function createInitialTemplate(preSelectedModelId?: string): ChecklistTemplate {
  return {
    name: "",
    description: "",
    model_id: preSelectedModelId || "",
    frequency: "mensual",
    sections: [
      {
        title: "Nueva Sección 1",
        order_index: 0,
        section_type: "checklist",
        items: [
          {
            description: "Nuevo Item",
            required: true,
            order_index: 0,
            item_type: "check",
          },
        ],
      },
    ],
  }
}

interface TemplateCreationStepperProps {
  preSelectedModelId?: string
}

export function TemplateCreationStepper({
  preSelectedModelId,
}: TemplateCreationStepperProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [template, setTemplate] = useState<ChecklistTemplate>(() =>
    createInitialTemplate(preSelectedModelId)
  )
  const [expandedSectionIndex, setExpandedSectionIndex] = useState<number | null>(0)
  const [models, setModels] = useState<Array<{ id: string; name: string; manufacturer?: string }>>(
    []
  )

  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch("/api/models")
        if (res.ok) {
          const data = await res.json()
          setModels(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error("Error loading models:", err)
      }
    }
    loadModels()
  }, [])

  const isBasicsValid =
    (template.name || "").trim().length > 0 &&
    !!template.model_id &&
    !!template.frequency &&
    (template.frequency !== "horas" || (template.hours_interval ?? 0) >= 1)

  const canAdvanceFromStep0 = isBasicsValid
  const canAdvanceFromStep1 = true
  const canAdvance =
    (currentStep === 0 && canAdvanceFromStep0) ||
    (currentStep === 1 && canAdvanceFromStep1) ||
    currentStep === 2

  const stepContentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    stepContentRef.current?.focus({ preventScroll: true })
  }, [currentStep])

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} currentStep={currentStep} />
      <div
        ref={stepContentRef}
        tabIndex={-1}
        role="region"
        aria-label={`Paso ${currentStep + 1} de 3: ${STEPS[currentStep].label}`}
        className="rounded-lg border bg-card p-6 focus:outline-none"
      >
        {currentStep === 0 && (
          <div>
            <p className="text-muted-foreground mb-4">Paso 1 de 3: Información básica</p>
            <BasicInfoCard
              templateName={template.name}
              templateDescription={template.description}
              name={template.name}
              description={template.description}
              modelId={template.model_id}
              frequency={template.frequency}
              hoursInterval={template.hours_interval}
              models={models}
              onNameChange={(value) =>
                setTemplate((prev) => ({ ...prev, name: value }))
              }
              onDescriptionChange={(value) =>
                setTemplate((prev) => ({ ...prev, description: value }))
              }
              onModelChange={(value) =>
                setTemplate((prev) => ({ ...prev, model_id: value }))
              }
              onFrequencyChange={(value) =>
                setTemplate((prev) => ({ ...prev, frequency: value }))
              }
              onHoursIntervalChange={(value) =>
                setTemplate((prev) => ({ ...prev, hours_interval: value }))
              }
            />
          </div>
        )}
        {currentStep === 1 && (
          <SectionsStep
            template={template}
            setTemplate={setTemplate}
            expandedSectionIndex={expandedSectionIndex}
            onExpandedChange={setExpandedSectionIndex}
          />
        )}
        {currentStep === 2 && (
          <ReviewStep
            template={template}
            models={models}
            onEditBasics={() => setCurrentStep(0)}
            onEditSections={() => setCurrentStep(1)}
          />
        )}
      </div>
      {currentStep < 2 && (
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
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={currentStep === 0 && !canAdvanceFromStep0}
            aria-label="Siguiente paso"
          >
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
