"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, isSameDay, isToday } from "date-fns"
import { es } from "date-fns/locale"
import type { UpcomingMaintenance, WarrantyEvent, WorkOrderEvent } from "@/types/calendar"
import { cn } from "@/lib/utils"

interface CalendarGridProps {
  items: UpcomingMaintenance[]
  warrantyEvents?: WarrantyEvent[]
  workOrderEvents?: WorkOrderEvent[]
  currentMonth: Date
  onMonthChange: (d: Date) => void
  selectedDate: Date | undefined
  onDateSelect: (d: Date) => void
  onMaintenanceSelect?: (m: UpcomingMaintenance) => void
}

function buildMaintenancesByDate(items: UpcomingMaintenance[]): Record<string, UpcomingMaintenance[]> {
  return items.reduce((acc, m) => {
    const key = m.estimatedDate.split("T")[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, UpcomingMaintenance[]>)
}

function buildWarrantiesByDate(events: WarrantyEvent[]): Record<string, WarrantyEvent[]> {
  return events.reduce((acc, w) => {
    const key = w.warrantyExpiration.split("T")[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(w)
    return acc
  }, {} as Record<string, WarrantyEvent[]>)
}

function buildWorkOrdersByDate(events: WorkOrderEvent[]): Record<string, WorkOrderEvent[]> {
  return events.reduce((acc, wo) => {
    const key = wo.plannedDate.split("T")[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(wo)
    return acc
  }, {} as Record<string, WorkOrderEvent[]>)
}

export function CalendarGrid({
  items,
  warrantyEvents = [],
  workOrderEvents = [],
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  onMaintenanceSelect
}: CalendarGridProps) {
  const maintenancesByDate = buildMaintenancesByDate(items)
  const warrantiesByDate = buildWarrantiesByDate(warrantyEvents)
  const workOrdersByDate = buildWorkOrdersByDate(workOrderEvents)
  const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const dayOfWeek = firstDay.getDay()
  const daysToPrepend = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const firstDayOfGrid = new Date(firstDay)
  firstDayOfGrid.setDate(firstDayOfGrid.getDate() - daysToPrepend)

  const totalDays = 42
  const days: Date[] = []
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(firstDayOfGrid)
    d.setDate(firstDayOfGrid.getDate() + i)
    days.push(d)
  }

  const handlePrevMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() - 1)
    onMonthChange(d)
  }

  const handleNextMonth = () => {
    const d = new Date(currentMonth)
    d.setMonth(d.getMonth() + 1)
    onMonthChange(d)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekdays.map((d) => (
          <div
            key={d}
            className="text-center py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {days.map((d, i) => {
          const dateKey = format(d, "yyyy-MM-dd")
          const maintenances = maintenancesByDate[dateKey] || []
          const warranties = warrantiesByDate[dateKey] || []
          const workOrders = workOrdersByDate[dateKey] || []
          const hasItems = maintenances.length > 0 || warranties.length > 0 || workOrders.length > 0
          const totalCount = maintenances.length + warranties.length + workOrders.length
          const isCurrentMonth = d.getMonth() === currentMonth.getMonth()
          const isSelected = selectedDate && isSameDay(d, selectedDate)

          return (
            <div
              key={i}
              className={cn(
                "relative p-1 min-h-[60px] sm:min-h-[80px] border rounded-lg transition-all cursor-pointer",
                !isCurrentMonth && "opacity-50 bg-muted/20",
                isToday(d) && "ring-1 ring-primary border-primary",
                isSelected && "bg-primary/10 border-primary/50",
                "hover:bg-muted/30"
              )}
              role="button"
              tabIndex={0}
              onClick={() => onDateSelect(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onDateSelect(d)
                }
              }}
              aria-pressed={isSelected}
              aria-label={`${format(d, "d MMMM", { locale: es })}${totalCount ? `, ${totalCount} items` : ""}`}
            >
              <div
                className={cn(
                  "text-right text-xs font-medium",
                  isToday(d) ? "text-primary" : "text-foreground"
                )}
              >
                {d.getDate()}
              </div>
              <div className="mt-0.5 space-y-0.5 overflow-hidden">
                {workOrders.slice(0, 2).map((wo) => (
                  <div
                    key={wo.id}
                    className="truncate px-1 py-0.5 rounded border-l-2 text-[10px] font-bold bg-violet-50 border-l-violet-600"
                    title={`OT ${wo.orderId} · ${wo.assetCode || "Sin activo"}`}
                  >
                    {wo.orderId}
                  </div>
                ))}
                {maintenances.slice(0, workOrders.length > 0 ? 1 : 2).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "truncate px-1 py-0.5 rounded border-l-2 text-[10px] font-semibold",
                      m.status === "overdue" && "bg-red-50 border-l-red-500",
                      m.status === "upcoming" && "bg-amber-50 border-l-amber-500",
                      m.status === "scheduled" && "bg-green-50 border-l-green-500",
                      m.status === "covered" && "bg-blue-50 border-l-blue-500"
                    )}
                    title={`${m.assetCode} ${m.intervalType}`}
                  >
                    {m.assetCode}
                  </div>
                ))}
                {warranties.slice(0, 1).map((w) => (
                  <div
                    key={w.id}
                    className="truncate px-1 py-0.5 rounded border-l-2 text-[10px] font-semibold bg-slate-100 border-l-slate-400"
                    title={`Garantía ${w.assetCode}`}
                  >
                    Gar. {w.assetCode}
                  </div>
                ))}
                {totalCount > 3 && (
                  <div className="text-[10px] text-center text-muted-foreground">
                    +{totalCount - 3}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
