"use client"

import { AlertTriangle, CheckCircle2, Flame, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

type QuickFilter = "needs_ot" | "linked_ot" | "critical" | "resolved" | null

interface IncidentsQueueSummaryProps {
  needsWorkOrderCount: number
  linkedWorkOrderCount: number
  criticalCount: number
  resolvedCount: number
  activeQuickFilter: QuickFilter
  onQuickFilterChange: (filter: QuickFilter) => void
}

const cards = [
  {
    id: "needs_ot" as const,
    label: "Sin OT",
    helper: "Requieren decisión",
    tone: "text-amber-950 bg-amber-50 border-amber-200",
    activeTone: "border-amber-300 bg-amber-100/80 shadow-sm",
    icon: AlertTriangle,
  },
  {
    id: "linked_ot" as const,
    label: "Con OT",
    helper: "Ya escalados a ejecución",
    tone: "text-blue-950 bg-blue-50 border-blue-200",
    activeTone: "border-blue-300 bg-blue-100/80 shadow-sm",
    icon: Wrench,
  },
  {
    id: "critical" as const,
    label: "Críticos",
    helper: "Más de 7 días abiertos",
    tone: "text-red-950 bg-red-50 border-red-200",
    activeTone: "border-red-300 bg-red-100/80 shadow-sm",
    icon: Flame,
  },
  {
    id: "resolved" as const,
    label: "Resueltos",
    helper: "Historial cerrado",
    tone: "text-emerald-950 bg-emerald-50 border-emerald-200",
    activeTone: "border-emerald-300 bg-emerald-100/80 shadow-sm",
    icon: CheckCircle2,
  },
] as const

export function IncidentsQueueSummary({
  needsWorkOrderCount,
  linkedWorkOrderCount,
  criticalCount,
  resolvedCount,
  activeQuickFilter,
  onQuickFilterChange,
}: IncidentsQueueSummaryProps) {
  const counts = {
    needs_ot: needsWorkOrderCount,
    linked_ot: linkedWorkOrderCount,
    critical: criticalCount,
    resolved: resolvedCount,
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const isActive = activeQuickFilter === card.id
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onQuickFilterChange(isActive ? null : card.id)}
            aria-pressed={isActive}
            className={cn(
              "w-full rounded-2xl border px-4 py-4 text-left transition-all duration-200 cursor-pointer",
              "hover:-translate-y-0.5 hover:shadow-sm",
              card.tone,
              isActive && card.activeTone
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">
                  {card.label}
                </div>
                <div className="text-3xl font-semibold tracking-tight">
                  {counts[card.id]}
                </div>
                <p className="text-sm opacity-80">{card.helper}</p>
              </div>
              <span className="rounded-full border border-current/10 bg-white/60 p-2">
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
