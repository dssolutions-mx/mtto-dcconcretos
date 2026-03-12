"use client"

import { Clock, CheckCircle2, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import { WORK_ORDER_TAB_CONFIG } from "@/lib/work-order-status-tabs"

export interface WorkOrderSummaryMetrics {
  pending: number
  completed: number
  recurrentes: number
}

export interface WorkOrderFiltersForRibbon {
  tab: string
  recurrentesOnly: boolean
}

const SEGMENT_STYLES: Record<string, { icon: typeof Clock; className: string; activeClass: string }> = {
  pending: { icon: Clock, className: "text-yellow-700 hover:bg-yellow-100", activeClass: "ring-2 ring-yellow-400 ring-offset-2" },
  completed: { icon: CheckCircle2, className: "text-slate-600 hover:bg-slate-100", activeClass: "ring-2 ring-slate-400 ring-offset-2" },
}

interface WorkOrdersSummaryRibbonProps {
  metrics: WorkOrderSummaryMetrics
  filters: WorkOrderFiltersForRibbon
  onTabChange: (tab: string) => void
  onRecurrentesClick: () => void
}

export function WorkOrdersSummaryRibbon({
  metrics,
  filters,
  onTabChange,
  onRecurrentesClick,
}: WorkOrdersSummaryRibbonProps) {
  const statusSegments = WORK_ORDER_TAB_CONFIG.map((tab) => {
    const style = SEGMENT_STYLES[tab.id] ?? SEGMENT_STYLES.pending
    const count = metrics[tab.id as keyof WorkOrderSummaryMetrics] ?? 0
    return {
      id: tab.id,
      label: tab.label,
      count,
      icon: style.icon,
      className: style.className,
      activeClass: style.activeClass,
    }
  })

  const recurrentesSegment = {
    id: "recurrentes",
    label: "Recurrentes",
    count: metrics.recurrentes,
    icon: Repeat,
    className: filters.recurrentesOnly ? "text-amber-700 hover:bg-amber-100" : "text-slate-600 hover:bg-slate-100",
    activeClass: "ring-2 ring-amber-400 ring-offset-2",
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-slate-50/80 px-3 py-2">
      {statusSegments.map((seg) => {
        const Icon = seg.icon
        const isActive = !filters.recurrentesOnly && filters.tab === seg.id
        return (
          <button
            key={seg.id}
            type="button"
            onClick={() => onTabChange(seg.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
              seg.className,
              isActive && seg.activeClass
            )}
            aria-pressed={isActive}
            aria-label={`${seg.label}: ${seg.count}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{seg.count}</span>
            <span className="text-slate-600 hidden sm:inline">{seg.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={onRecurrentesClick}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
          recurrentesSegment.className,
          filters.recurrentesOnly && recurrentesSegment.activeClass
        )}
        aria-pressed={filters.recurrentesOnly}
        aria-label={`${recurrentesSegment.label}: ${recurrentesSegment.count}`}
      >
        <Repeat className="h-4 w-4 shrink-0" />
        <span className="font-semibold">{recurrentesSegment.count}</span>
        <span className="text-slate-600 hidden sm:inline">{recurrentesSegment.label}</span>
      </button>
    </div>
  )
}
