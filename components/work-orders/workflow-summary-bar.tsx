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
  /** Left border + icon bg + text: border-l-4, icon container, number/label */
  borderClass: string
  iconBgClass: string
  numberClass: string
  labelClass: string
}[] = [
  {
    key: "overdue",
    label: "Vencidas",
    icon: AlertCircle,
    borderClass: "border-l-4 border-l-red-500",
    iconBgClass: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
    numberClass: "text-red-600 dark:text-red-400",
    labelClass: "text-red-700/80 dark:text-red-300/80",
  },
  {
    key: "active",
    label: "En curso",
    icon: Clock,
    borderClass: "border-l-4 border-l-blue-500",
    iconBgClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    numberClass: "text-blue-600 dark:text-blue-400",
    labelClass: "text-blue-700/80 dark:text-blue-300/80",
  },
  {
    key: "waiting_po",
    label: "Espera OC",
    icon: Package,
    borderClass: "border-l-4 border-l-amber-500",
    iconBgClass: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
    numberClass: "text-amber-600 dark:text-amber-400",
    labelClass: "text-amber-700/80 dark:text-amber-300/80",
  },
  {
    key: "today_completed",
    label: "Hoy completadas",
    icon: CheckCircle,
    borderClass: "border-l-4 border-l-green-500",
    iconBgClass: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400",
    numberClass: "text-green-600 dark:text-green-400",
    labelClass: "text-green-700/80 dark:text-green-300/80",
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
      {cards.map(({ key, label, icon: Icon, borderClass, iconBgClass, numberClass, labelClass }) => {
        const count =
          key === "overdue"
            ? counts.overdue
            : key === "active"
              ? counts.active
              : key === "waiting_po"
                ? counts.waitingPo
                : counts.todayCompleted
        const isActive = activeFilter === key
        const isEmpty = count === 0
        return (
          <Card
            key={key}
            role="button"
            tabIndex={0}
            className={cn(
              "cursor-pointer transition-all duration-200 overflow-hidden",
              "hover:shadow-md hover:border-muted-foreground/20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              borderClass,
              isActive && "ring-2 ring-primary shadow-md border-primary/30"
            )}
            onClick={() => onFilterChange(isActive ? null : key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onFilterChange(isActive ? null : key)
              }
            }}
          >
            <CardContent className="p-4 pl-5">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex-shrink-0 rounded-lg p-2",
                    iconBgClass,
                    isEmpty && "opacity-50"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-2xl font-bold tabular-nums tracking-tight",
                      isEmpty ? "text-muted-foreground" : numberClass
                    )}
                  >
                    {count}
                  </div>
                  <p className={cn("text-sm font-medium mt-0.5", isEmpty ? "text-muted-foreground" : labelClass)}>
                    {label}
                  </p>
                  {count > 0 && key === "overdue" && (
                    <p className="text-xs text-red-600/90 dark:text-red-400/90 mt-1">
                      Requieren atención
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
