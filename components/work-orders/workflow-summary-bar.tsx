"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { AlertCircle, CheckCircle, Clock, Package } from "lucide-react"

export type WorkflowSummaryFilter =
  | "overdue"
  | "active"
  | "waiting_po"
  | "today_completed"
  | null

export interface WorkflowSummaryCounts {
  overdue: number
  active: number
  waitingPo: number
  todayCompleted: number
}

export interface WorkflowSummaryBarProps {
  counts: WorkflowSummaryCounts
  activeFilter: WorkflowSummaryFilter
  onFilterChange: (filter: WorkflowSummaryFilter) => void
  className?: string
}

const cards: {
  key: WorkflowSummaryFilter
  label: string
  icon: typeof Clock
  accentClass: string
}[] = [
  {
    key: "overdue",
    label: "Vencidas",
    icon: AlertCircle,
    accentClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 ring-amber-400",
  },
  {
    key: "active",
    label: "En curso",
    icon: Clock,
    accentClass: "text-blue-600 bg-blue-50 dark:bg-blue-950/50 ring-blue-400",
  },
  {
    key: "waiting_po",
    label: "Espera OC",
    icon: Package,
    accentClass: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 ring-indigo-400",
  },
  {
    key: "today_completed",
    label: "Hoy completadas",
    icon: CheckCircle,
    accentClass: "text-green-600 bg-green-50 dark:bg-green-950/50 ring-green-400",
  },
]

export function WorkflowSummaryBar({
  counts,
  activeFilter,
  onFilterChange,
  className,
}: WorkflowSummaryBarProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6",
        className
      )}
    >
      {cards.map(({ key, label, icon: Icon, accentClass }) => {
        const count = key === "overdue" ? counts.overdue
          : key === "active" ? counts.active
          : key === "waiting_po" ? counts.waitingPo
          : counts.todayCompleted
        const isActive = activeFilter === key
        return (
          <Card
            key={key}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "ring-2 ring-primary shadow-md"
            )}
            onClick={() => onFilterChange(isActive ? null : key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onFilterChange(isActive ? null : key)
              }
            }}
          >
            <CardContent className="p-4">
              <div className="text-center">
                <div
                  className={cn(
                    "inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full text-2xl sm:text-3xl font-bold",
                    count > 0 && key === "overdue"
                      ? "text-amber-600 bg-amber-50 dark:bg-amber-950/50 ring-2 ring-amber-400"
                      : count > 0
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {count}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
