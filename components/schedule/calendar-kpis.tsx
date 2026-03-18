"use client"

import type { MaintenanceSummary } from "@/types/calendar"
import type { WorkOrderEvent } from "@/types/calendar"
import { format } from "date-fns"

interface CalendarKPIsProps {
  summary: MaintenanceSummary
  totalCount: number
  workOrderEvents?: WorkOrderEvent[]
  todayCount?: number
}

export function CalendarKPIs({ summary, totalCount, workOrderEvents = [], todayCount }: CalendarKPIsProps) {
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const woToday = workOrderEvents.filter((wo) => wo.plannedDate.startsWith(todayStr)).length
  const hoy = todayCount ?? woToday

  const cards = [
    { label: "Hoy", value: hoy, color: "text-primary" },
    ...(workOrderEvents.length > 0 ? [{ label: "OT programadas", value: workOrderEvents.length, color: "text-violet-600" }] : []),
    { label: "Vencidos", value: summary.overdue, color: "text-red-600" },
    { label: "Próximos", value: summary.upcoming, color: "text-orange-600" },
    { label: "Urgentes", value: summary.highUrgency, color: "text-amber-600" }
  ].filter(Boolean) as { label: string; value: number; color: string }[]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-2xl border border-border/60 bg-card p-4 relative overflow-hidden"
        >
          <div
            className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-slate-400 to-slate-300"
            aria-hidden
          />
          <div
            className={`font-bold leading-none tabular-num ${color}`}
            style={{ fontSize: "clamp(1.4rem, 5.5vw, 2.5rem)" }}
          >
            {value}
          </div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}
