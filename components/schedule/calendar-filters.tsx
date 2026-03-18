"use client"

import type { StatusFilter } from "@/types/calendar"
import type { MaintenanceSummary } from "@/types/calendar"
import { cn } from "@/lib/utils"

interface CalendarFiltersProps {
  statusFilter: StatusFilter
  onStatusFilterChange: (s: StatusFilter) => void
  summary: MaintenanceSummary
  totalCount: number
}

const FILTERS: { value: StatusFilter; label: string; getCount: (s: MaintenanceSummary, total: number) => number }[] = [
  { value: null, label: "Todos", getCount: (_, total) => total },
  { value: "overdue", label: "Vencidos", getCount: (s) => s.overdue },
  { value: "upcoming", label: "Próximos", getCount: (s) => s.upcoming },
  { value: "covered", label: "Cubiertos", getCount: (s) => s.covered },
  { value: "scheduled", label: "Programados", getCount: (s) => s.scheduled },
  { value: "urgent", label: "Urgentes", getCount: (s) => s.highUrgency }
]

export function CalendarFilters({
  statusFilter,
  onStatusFilterChange,
  summary,
  totalCount
}: CalendarFiltersProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden z-10" />
      <div className="flex overflow-x-auto scrollbar-none gap-2 pb-1 sm:flex-wrap">
        {FILTERS.map(({ value, label, getCount }) => {
          const count = getCount(summary, totalCount)
          const isActive =
            value === null ? statusFilter === null : statusFilter === value
          return (
            <button
              key={label}
              type="button"
              onClick={() => onStatusFilterChange(value)}
              className={cn(
                "shrink-0 min-h-[36px] px-3 py-2 rounded-full text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>
    </div>
  )
}
