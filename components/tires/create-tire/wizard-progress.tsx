'use client'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CREATE_TIRE_WIZARD_STEPS,
  type CreateTireWizardStep,
} from '@/lib/tires/create-tire-form'

interface CreateTireWizardProgressProps {
  currentStep: CreateTireWizardStep
}

export function CreateTireWizardProgress({ currentStep }: CreateTireWizardProgressProps) {
  const currentIndex = CREATE_TIRE_WIZARD_STEPS.findIndex((s) => s.key === currentStep)
  const progressPct = ((currentIndex + 1) / CREATE_TIRE_WIZARD_STEPS.length) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Paso {currentIndex + 1} de {CREATE_TIRE_WIZARD_STEPS.length}:{' '}
          {CREATE_TIRE_WIZARD_STEPS[currentIndex]?.label}
        </p>
        <Badge variant="outline">{Math.round(progressPct)}%</Badge>
      </div>
      <Progress value={progressPct} className="h-1.5" />
    </div>
  )
}
