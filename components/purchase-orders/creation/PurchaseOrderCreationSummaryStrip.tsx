"use client"

import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

export type PurchaseOrderChecklistItem = {
  id: string
  /** Short label shown in the checklist */
  label: string
  done: boolean
}

export type PurchaseOrderCreationSummaryStripProps = {
  totalAmount: number
  approvalAmount?: number
  /** First workflow / policy line (compact) */
  workflowHintLine?: string | null
  /**
   * Requirements with done/pending state so users see what is already OK and what is missing.
   * When provided, replaces the old blockers-only list.
   */
  checklist?: PurchaseOrderChecklistItem[]
  /** @deprecated Prefer checklist with explicit done flags */
  blockers?: string[]
  className?: string
}

export function PurchaseOrderCreationSummaryStrip({
  totalAmount,
  approvalAmount,
  workflowHintLine,
  checklist,
  blockers = [],
  className,
}: PurchaseOrderCreationSummaryStripProps) {
  const fmt = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const checklistItems = checklist ?? []
  const useChecklist = checklistItems.length > 0
  const doneCount = useChecklist ? checklistItems.filter((i) => i.done).length : 0
  const totalCount = checklistItems.length
  const allDone = useChecklist && totalCount > 0 && doneCount === totalCount

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2.5 text-sm shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span>
            <span className="text-muted-foreground">Total OC </span>
            <span className="font-semibold tabular-nums">{fmt(totalAmount)}</span>
          </span>
          {approvalAmount !== undefined && (
            <span>
              <span className="text-muted-foreground">Aprobación </span>
              <span className="font-medium tabular-nums">{fmt(approvalAmount)}</span>
            </span>
          )}
        </div>
        {workflowHintLine ? (
          <p className="max-w-full text-xs text-muted-foreground line-clamp-2">{workflowHintLine}</p>
        ) : null}
      </div>

      {useChecklist ? (
        <div className="mt-2 border-t border-border/80 pt-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Requisitos para continuar</p>
            <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
              {doneCount}/{totalCount} cumplidos
            </span>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Revise lo pendiente; al completarlo podrá abrir el resumen y confirmar la orden.
          </p>
          <ul className="flex flex-col gap-1.5" aria-label="Requisitos para continuar">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                {item.done ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "text-xs leading-snug",
                    item.done ? "text-muted-foreground" : "font-medium text-foreground"
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          {allDone ? (
            <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-200/95">
              Listo: puede pulsar «Revisar y confirmar» para ver el resumen.
            </p>
          ) : null}
        </div>
      ) : blockers.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border/80 pt-2 text-xs text-amber-900 dark:text-amber-100/95">
          {blockers.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
