"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"
import type { UpcomingMaintenance } from "@/types/calendar"
import { useCalendarMaintenance } from "@/hooks/useCalendarMaintenance"
import { CalendarHero } from "@/components/schedule/calendar-hero"
import { CalendarShortcuts } from "@/components/schedule/calendar-shortcuts"
import { CalendarKPIs } from "@/components/schedule/calendar-kpis"
import { CalendarFilters } from "@/components/schedule/calendar-filters"
import { CalendarGrid } from "@/components/schedule/calendar-grid"
import { CalendarDayDetail } from "@/components/schedule/calendar-day-detail"
import { CalendarLegend } from "@/components/schedule/calendar-legend"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { Fuel, Package, Wrench, ClipboardList, BarChart3 } from "lucide-react"

export function MaintenanceSchedule() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedMaintenance, setSelectedMaintenance] = useState<UpcomingMaintenance | null>(null)

  const monthStr = format(currentMonth, "yyyy-MM")
  const {
    items,
    warrantyEvents,
    summary,
    loading,
    error,
    refetch,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    totalCount
  } = useCalendarMaintenance({
    month: monthStr,
    includeWarranties: true
  })

  const maintenancesByDate = useMemo(() => {
    return items.reduce((acc, m) => {
      const key = m.estimatedDate.split("T")[0]
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
      return acc
    }, {} as Record<string, typeof items>)
  }, [items])

  const maintenancesForSelectedDate = selectedDate
    ? maintenancesByDate[format(selectedDate, "yyyy-MM-dd")] ?? []
    : []

  const todayStr = format(new Date(), "yyyy-MM-dd")
  const todayCount = (workOrderEvents?.filter((wo) => wo.plannedDate.startsWith(todayStr)).length ?? 0) +
    (maintenancesByDate[todayStr]?.length ?? 0)

  const handleDateSelect = (d: Date) => {
    setSelectedDate(d)
    const key = format(d, "yyyy-MM-dd")
    const list = maintenancesByDate[key] ?? []
    setSelectedMaintenance(list[0] ? { ...list[0] } : null)
  }

  const handleMaintenanceSelect = (m: (typeof items)[0]) => {
    setSelectedMaintenance({ ...m })
  }

  const { ui } = useAuthZustand()
  const moduleCards = [
    { title: "Calendario", href: "/calendario", icon: ClipboardList, module: "checklists" as const },
    { title: "Activos", href: "/activos", icon: Package, module: "assets" as const },
    { title: "Mantenimiento", href: "/preventivo", icon: Wrench, module: "maintenance" as const },
    { title: "Diésel", href: "/diesel", icon: Fuel, module: "inventory" as const },
    { title: "Reportes", href: "/reportes", icon: BarChart3, module: "reports" as const }
  ]
  const moduleLinks = moduleCards
    .filter((c) => ui.shouldShowInNavigation(c.module))
    .map((c) => ({
      title: c.title,
      href: c.href,
      icon: c.icon,
      hasAccess: true
    }))

  if (loading) {
    return (
      <div className="space-y-6 pb-16 sm:pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-[100px] sm:h-[120px] rounded-2xl bg-muted/30 animate-pulse"
            />
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="h-[400px] rounded-xl bg-muted/30 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 pb-16 sm:pb-12">
      {/* Hero + Shortcuts */}
      <div>
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <CalendarHero />
          </div>
        </div>
        <div className="mt-5">
          <CalendarShortcuts
            urgentCount={summary.highUrgency}
            onRefresh={refetch}
            isRefreshing={loading}
          />
        </div>
      </div>

      {/* Section: KPIs */}
      <div id="urgentes" className="scroll-mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Resumen Estratégico
        </p>
        <CalendarKPIs summary={summary} totalCount={totalCount} />
      </div>

      {/* Filters */}
      <div>
        <CalendarFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          summary={summary}
          totalCount={totalCount}
        />
      </div>

      {/* Calendar + Day Detail */}
      <Card className="relative rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-slate-400 to-slate-300" aria-hidden />
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Calendario de Mantenimientos Proyectados</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Mantenimientos calculados según la lógica cíclica de cada activo. Incluye vencidos, próximos, cubiertos y programados.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <CalendarGrid
            items={items}
            warrantyEvents={warrantyEvents}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onMaintenanceSelect={handleMaintenanceSelect}
          />

          {/* Day detail - replaces sidebar + table */}
          <div className="border-t border-border/40 pt-4">
            <CalendarDayDetail
              date={selectedDate ?? new Date()}
              maintenances={maintenancesForSelectedDate}
              warrantyEvents={warrantyEvents.filter(
                (w) => w.warrantyExpiration.startsWith(format(selectedDate ?? new Date(), "yyyy-MM-dd"))
              )}
              onSelectMaintenance={handleMaintenanceSelect}
              selectedMaintenance={selectedMaintenance}
            />
          </div>

          <div className="pt-2">
            <CalendarLegend />
          </div>
        </CardContent>
      </Card>

      {/* Empty state when no items in month */}
      {items.length === 0 && (
        <div className="flex items-center gap-3 py-5 rounded-2xl border border-border/60 bg-card">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-muted-foreground">
            {statusFilter
              ? `Sin mantenimientos ${statusFilter === "urgent" ? "urgentes" : statusFilter} en este mes`
              : "Sin mantenimientos programados para este mes · Todo al día"}
          </span>
        </div>
      )}

      {/* Module chips */}
      <div className="mt-10 border-t border-border/40 pt-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Módulos
        </p>
        <DashboardModuleLinks modules={moduleLinks} />
      </div>
    </div>
  )
}
