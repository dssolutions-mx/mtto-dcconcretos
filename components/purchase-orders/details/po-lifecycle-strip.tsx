import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle } from "lucide-react"

export interface POLifecycleStripProps {
  status: string
  workflowStage?: string // "Validación técnica" | "Viabilidad administrativa" | "Aprobación final"
}

const STEPS = [
  {
    key: "requested",
    label: "Solicitada",
    matchStatuses: ["draft"],
  },
  {
    key: "pending",
    label: "En aprobación",
    matchStatuses: ["pending_approval"],
  },
  {
    key: "approved",
    label: "Aprobada",
    matchStatuses: ["approved"],
  },
  {
    key: "completed",
    label: "Completada",
    matchStatuses: ["purchased", "ordered", "received", "receipt_uploaded", "fulfilled"],
  },
  {
    key: "validated",
    label: "Validada",
    matchStatuses: ["validated"],
  },
] as const

function getStepIndex(status: string): number {
  if (status === "rejected") return -1 // special case
  for (let i = 0; i < STEPS.length; i++) {
    if ((STEPS[i].matchStatuses as readonly string[]).includes(status)) return i
  }
  // draft / unknown → step 0
  return 0
}

export function POLifecycleStrip({ status, workflowStage }: POLifecycleStripProps) {
  const isRejected = status === "rejected"
  const activeIdx = getStepIndex(status)

  // On mobile: compact text strip
  const mobileLabel = isRejected
    ? "Rechazada"
    : activeIdx >= 0
    ? STEPS[activeIdx].label
    : "Desconocido"

  const mobileSubLabel =
    status === "pending_approval" && workflowStage ? workflowStage : undefined

  return (
    <div className="no-print">
      {/* Mobile: compact text strip */}
      <div className="flex items-center gap-2 sm:hidden text-sm">
        {isRejected ? (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Estado
          </span>
        )}
        <span
          className={cn(
            "font-semibold",
            isRejected ? "text-destructive" : "text-foreground"
          )}
        >
          {mobileLabel}
        </span>
        {mobileSubLabel && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{mobileSubLabel}</span>
          </>
        )}
      </div>

      {/* Desktop: full horizontal strip */}
      <div className="hidden sm:flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const isCurrent = !isRejected && idx === activeIdx
          const isCompleted = !isRejected && idx < activeIdx
          const isFuture = isRejected ? true : idx > activeIdx
          const isLastBeforeRejected = isRejected && idx === 0 // show at first step when rejected

          return (
            <div key={step.key} className="flex items-center">
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center transition-all",
                    isCompleted && "bg-foreground",
                    isCurrent && "bg-foreground ring-[3px] ring-foreground/20",
                    isFuture && "bg-muted border border-border/60",
                    isRejected && "bg-destructive/10 border border-destructive/30"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-background" />
                  ) : isCurrent ? (
                    <div className="h-2 w-2 rounded-full bg-background" />
                  ) : isRejected && idx === 0 ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] whitespace-nowrap leading-tight text-center",
                    isCompleted && "font-medium text-foreground",
                    isCurrent && "font-semibold text-foreground",
                    isFuture && "text-muted-foreground",
                    isRejected && idx === 0 && "font-semibold text-destructive"
                  )}
                >
                  {isRejected && idx === 0 ? "Rechazada" : step.label}
                </span>
                {/* Sub-label for current pending step */}
                {isCurrent && status === "pending_approval" && workflowStage && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {workflowStage}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && !isRejected && (
                <div
                  className={cn(
                    "h-px w-10 mx-1 mb-4 transition-colors",
                    idx < activeIdx ? "bg-foreground/60" : "bg-border"
                  )}
                />
              )}
              {/* No connector after rejection */}
              {isRejected && idx === 0 && (
                <div className="h-px w-10 mx-1 mb-4 bg-border/40" />
              )}
              {isRejected && idx > 0 && idx < STEPS.length - 1 && (
                <div className="h-px w-10 mx-1 mb-4 bg-border/20" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
