"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepperProps {
  steps: { label: string }[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol
      role="list"
      aria-label="Pasos de creación"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isLast = index === steps.length - 1
        return (
          <li
            key={index}
            className="flex items-center gap-2"
            aria-current={isCurrent ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                isCompleted && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                !isCompleted && !isCurrent && "border-muted-foreground/30 bg-muted/50"
              )}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                isCurrent && "text-foreground",
                !isCurrent && "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  "mx-2 h-px w-6 shrink-0",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
