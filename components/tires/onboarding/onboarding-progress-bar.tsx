'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ONBOARDING_STEPS, type OnboardingWizardStep } from './constants'

interface OnboardingProgressBarProps {
  currentStep: OnboardingWizardStep
  completedSteps?: Set<string>
}

export function OnboardingProgressBar({
  currentStep,
  completedSteps = new Set(),
}: OnboardingProgressBarProps) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.key === currentStep)
  const progressPct = ((currentIndex + 1) / ONBOARDING_STEPS.length) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Paso {currentIndex + 1} de {ONBOARDING_STEPS.length}:{' '}
          {ONBOARDING_STEPS[currentIndex]?.label}
        </p>
        <Badge variant="outline">{Math.round(progressPct)}%</Badge>
      </div>
      <Progress value={progressPct} className="h-2" />
      <div className="hidden flex-wrap gap-2 sm:flex">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isCurrent = step.key === currentStep
          const isDone = completedSteps.has(step.key)
          return (
            <Badge
              key={step.key}
              variant={isCurrent ? 'default' : isDone ? 'secondary' : 'outline'}
              className="font-normal"
            >
              {idx + 1}. {step.label}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

export function useOnboardingResumeStep(completedSteps: Set<string>): OnboardingWizardStep {
  return useMemo(() => {
    if (!completedSteps.has('scope')) return 'scope'
    if (!completedSteps.has('layouts')) return 'layouts'
    return 'layouts'
  }, [completedSteps])
}
