"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  computeCohortFunnelMetrics,
  type CohortFunnelMetrics,
} from "@/lib/incidents/inspection-cohort"
import {
  formatDateRangeLabel,
  type DateRangeBounds,
} from "@/lib/incidents/incident-date-filter"
import type { IncidentesPageFilters } from "@/lib/incidents/incident-list-filters"
import { classifyThreadPlanning } from "@/lib/incidents/incident-planning-class"
import { groupIncidentsIntoThreads } from "@/lib/incidents/incident-thread-grouping"
import { REPORTS_CALENDAR_TIMEZONE } from "@/lib/reports/mexico-city-report-window"
import { ArrowRight, FileDown, MapPin } from "lucide-react"
import { useMemo } from "react"

type IncidentsPeriodRibbonProps = {
  incidents: Record<string, unknown>[]
  bounds: DateRangeBounds | null
  filters: IncidentesPageFilters
  onFiltersChange: (patch: Partial<IncidentesPageFilters>) => void
  onExportPdf: () => void
  exportDisabled?: boolean
}

export function IncidentsPeriodRibbon({
  incidents,
  bounds,
  filters,
  onFiltersChange,
  onExportPdf,
  exportDisabled,
}: IncidentsPeriodRibbonProps) {
  const metrics: CohortFunnelMetrics | null = useMemo(() => {
    if (!bounds) return null
    return computeCohortFunnelMetrics(incidents, bounds, filters.dateField)
  }, [incidents, bounds, filters.dateField])

  const reincidenteCount = useMemo(() => {
    if (!bounds) return 0
    const threads = groupIncidentsIntoThreads(incidents)
    let count = 0
    for (const t of threads) {
      const info = classifyThreadPlanning(t.incidents, bounds, filters.dateField)
      if (info.planningClass === "reincidente" || info.planningClass === "mixto") {
        count += 1
      }
    }
    return count
  }, [incidents, bounds, filters.dateField])

  if (!bounds || !metrics) return null

  const planningHref = `/ordenes/planificacion?cohort=june_2026_inspection${
    filters.plantFilter !== "all" ? `&plantId=${filters.plantFilter}` : ""
  }`

  return (
    <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-foreground">{metrics.totalInCohort} en periodo</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
        <span>
          <span className="font-medium">{metrics.openInCohort}</span>{" "}
          <span className="text-muted-foreground">abiertos</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
        <span>
          <span className="font-medium">{metrics.withWorkOrder}</span>{" "}
          <span className="text-muted-foreground">con OT</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:inline" />
        <span>
          <span className="font-medium">{metrics.resolvedInCohort}</span>{" "}
          <span className="text-muted-foreground">cerrados</span>
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Atendidos en revisión</span>
          <span>{metrics.closedPct}%</span>
        </div>
        <Progress value={metrics.closedPct} className="h-2" />
      </div>

      <div className="flex flex-wrap gap-2">
        {metrics.withoutWorkOrder > 0 && (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors",
              filters.workOrderFilter === "without"
                ? "border-amber-600 bg-amber-100 text-amber-900"
                : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
            )}
            onClick={() =>
              onFiltersChange({
                workOrderFilter:
                  filters.workOrderFilter === "without" ? "all" : "without",
              })
            }
          >
            Sin OT ({metrics.withoutWorkOrder})
          </button>
        )}
        {metrics.criticalOpen > 0 && (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer",
              filters.priorityFilter === "critical"
                ? "border-red-600 bg-red-100 text-red-900"
                : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
            )}
            onClick={() =>
              onFiltersChange({
                priorityFilter:
                  filters.priorityFilter === "critical" ? "all" : "critical",
              })
            }
          >
            Críticos +7d ({metrics.criticalOpen})
          </button>
        )}
        {reincidenteCount > 0 && (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer",
              filters.planningClassFilter === "reincidente"
                ? "border-violet-600 bg-violet-100 text-violet-900"
                : "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100",
            )}
            onClick={() =>
              onFiltersChange({
                planningClassFilter:
                  filters.planningClassFilter === "reincidente" ? "all" : "reincidente",
              })
            }
          >
            Reincidentes ({reincidenteCount})
          </button>
        )}
        <button
          type="button"
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer",
            filters.planningClassFilter === "nuevo"
              ? "border-emerald-600 bg-emerald-100 text-emerald-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
          )}
          onClick={() =>
            onFiltersChange({
              planningClassFilter:
                filters.planningClassFilter === "nuevo" ? "all" : "nuevo",
            })
          }
        >
          Nuevos en revisión
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>
          {formatDateRangeLabel(bounds)} · {REPORTS_CALENDAR_TIMEZONE} ·{" "}
          {filters.dateField === "event" ? "Fecha del hecho" : "Fecha de registro"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs cursor-pointer"
            disabled={exportDisabled}
            onClick={onExportPdf}
          >
            <FileDown className="mr-1 h-3 w-3" />
            Exportar PDF
          </Button>
          <Button asChild variant="default" size="sm" className="h-7 text-xs cursor-pointer">
            <Link href={planningHref}>
              <MapPin className="mr-1 h-3 w-3" />
              Ir a planificación
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
