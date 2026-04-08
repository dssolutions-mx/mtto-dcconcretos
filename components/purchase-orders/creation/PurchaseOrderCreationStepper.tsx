"use client"

import { cn } from "@/lib/utils"

type Props = {
  /** Step 2 active when review modal/sheet is open */
  reviewOpen: boolean
  className?: string
}

export function PurchaseOrderCreationStepper({ reviewOpen, className }: Props) {
  return (
    <nav
      aria-label="Pasos de creación de la orden"
      className={cn(
        "rounded-lg border bg-muted/30 px-3 py-2.5 transition-colors motion-reduce:transition-none",
        className
      )}
    >
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <li
          className={cn(
            "flex items-center gap-2 transition-colors motion-reduce:transition-none",
            !reviewOpen ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border bg-background text-xs tabular-nums",
              !reviewOpen && "border-primary text-primary"
            )}
            aria-current={!reviewOpen ? "step" : undefined}
          >
            1
          </span>
          <span>Datos de la solicitud</span>
        </li>
        <span className="text-muted-foreground" aria-hidden>
          →
        </span>
        <li
          className={cn(
            "flex items-center gap-2 transition-colors motion-reduce:transition-none",
            reviewOpen ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          <span
            className={cn(
              "flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border bg-background text-xs tabular-nums",
              reviewOpen && "border-primary text-primary"
            )}
            aria-current={reviewOpen ? "step" : undefined}
          >
            2
          </span>
          <span>Confirmación</span>
        </li>
      </ol>
    </nav>
  )
}
