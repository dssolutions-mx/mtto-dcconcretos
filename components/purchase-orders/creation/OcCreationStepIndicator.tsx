"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type OcCreationOrchestratorStep = "select-type" | "wo-line-intent" | "fill-form"

interface OcCreationStepIndicatorProps {
  current: OcCreationOrchestratorStep
  /** When false, the "Origen" step is skipped (no second dot). */
  showOriginStep: boolean
  compact?: boolean
}

const LABELS: Record<string, string> = {
  "select-type": "Tipo",
  "wo-line-intent": "Origen",
  "fill-form": "Detalle",
}

export function OcCreationStepIndicator({
  current,
  showOriginStep,
  compact,
}: OcCreationStepIndicatorProps) {
  const sequence: OcCreationOrchestratorStep[] = showOriginStep
    ? ["select-type", "wo-line-intent", "fill-form"]
    : ["select-type", "fill-form"]

  const currentIndex = sequence.indexOf(current)

  return (
    <nav
      aria-label="Pasos de creación de orden de compra"
      className={cn(
        "flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4",
        compact && "py-2"
      )}
    >
      {sequence.map((key, idx) => {
        const done = currentIndex > idx
        const active = currentIndex === idx
        return (
          <div key={key} className="flex items-center gap-2 sm:gap-3">
            {idx > 0 ? (
              <div
                className={cn(
                  "hidden sm:block h-px w-6 lg:w-10",
                  done ? "bg-primary/60" : "bg-border"
                )}
                aria-hidden
              />
            ) : null}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border",
                  done && "bg-primary text-primary-foreground border-primary",
                  active &&
                    !done &&
                    "border-primary text-primary bg-primary/10",
                  !active && !done && "border-muted-foreground/30 text-muted-foreground bg-background"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "text-xs sm:text-sm font-medium truncate",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {LABELS[key]}
              </span>
            </div>
          </div>
        )
      })}
      <div className="hidden sm:flex items-center gap-2 ml-auto text-[10px] text-muted-foreground uppercase tracking-wide">
        Confirmación al enviar
      </div>
    </nav>
  )
}
