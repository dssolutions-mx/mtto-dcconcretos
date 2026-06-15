"use client"

import { Button } from "@/components/ui/button"
import { FileWarning, Wrench, ChevronDown, ChevronRight, AlertTriangle, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { getReporterName } from "./incidents-list-utils"
import { getDaysSinceCreated, getStatusInfo, normalizeStatus, getPriorityInfo } from "./incidents-status-utils"
import { groupIncidentsForIncidentesLookup } from "@/lib/incidents/incident-snapshot-grouping"
import { groupIncidentsIntoThreads } from "@/lib/incidents/incident-thread-grouping"
import {
  classifyThreadPlanning,
  filterThreadOccurrencesForDisplay,
  isOccurrenceInBounds,
} from "@/lib/incidents/incident-planning-class"
import type { DateRangeBounds } from "@/lib/incidents/incident-date-filter"
import type { ThreadDateMode } from "@/lib/incidents/incident-list-filters"
import {
  summarizeThreadDates,
} from "@/lib/incidents/incident-thread-dates"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return format(new Date(dateStr), "dd MMM yy", { locale: es })
  } catch {
    return "—"
  }
}

function isResolved(status: string): boolean {
  return normalizeStatus(status) === "resolved"
}

function statusBadgeClass(status: string): string {
  const n = normalizeStatus(status)
  switch (n) {
    case "resolved":
      return "border-green-200 bg-green-50 text-green-800"
    case "open":
      return "border-red-200 bg-red-50 text-red-800"
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800"
    case "in_progress":
      return "border-sky-200 bg-sky-50 text-sky-800"
    default:
      return "border-border bg-muted/50 text-foreground"
  }
}

function urgencyBadgeClass(level: string): string {
  switch (level) {
    case "critical":
      return "border-red-300 bg-red-100 text-red-900"
    case "high":
      return "border-amber-300 bg-amber-100 text-amber-900"
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "low":
      return "border-sky-200 bg-sky-50 text-sky-800"
    default:
      return "border-border bg-muted/40 text-muted-foreground"
  }
}

function rowSurfaceClass(resolved: boolean, days: number): string {
  if (resolved) {
    return "bg-muted/20 border-l-4 border-l-muted-foreground/25"
  }
  if (days >= 7) {
    return "bg-red-50 border-l-4 border-l-red-500"
  }
  if (days >= 3) {
    return "bg-amber-50/80 border-l-4 border-l-amber-500"
  }
  return "bg-sky-50/60 border-l-4 border-l-sky-500"
}

interface IncidentsOTLookupProps {
  incidents: Record<string, unknown>[]
  assets: Record<string, unknown>[]
  dateBounds?: DateRangeBounds | null
  threadDateMode?: ThreadDateMode
}

export function IncidentsOTLookup({
  incidents,
  assets,
  dateBounds = null,
  threadDateMode = "thread_in_period",
}: IncidentsOTLookupProps) {
  const router = useRouter()
  const [collapsedAssets, setCollapsedAssets] = useState<Set<string>>(new Set())
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const [allCollapsed, setAllCollapsed] = useState(false)

  const grouped = useMemo(
    () => groupIncidentsForIncidentesLookup(incidents, assets),
    [incidents, assets],
  )

  // On initial load: collapse groups that have no critical/open incidents
  useEffect(() => {
    const toCollapse = new Set<string>()
    grouped.forEach((group) => {
      if (group.criticalCount === 0 && group.openCount === 0) {
        toCollapse.add(group.assetId ?? "__no_asset__")
      }
    })
    setCollapsedAssets(toCollapse)
  }, [grouped])

  const toggleAsset = (key: string) => {
    setCollapsedAssets((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedAssets(new Set())
      setAllCollapsed(false)
    } else {
      setCollapsedAssets(new Set(grouped.map((g) => g.assetId ?? "__no_asset__")))
      setAllCollapsed(true)
    }
  }

  const toggleThread = (threadKey: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      next.has(threadKey) ? next.delete(threadKey) : next.add(threadKey)
      return next
    })
  }

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-md border border-dashed p-4">
        <FileWarning className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">No se encontraron incidentes</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Control expandir/colapsar todo */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs text-muted-foreground">
          {grouped.length} activo{grouped.length !== 1 ? "s" : ""} con incidentes
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronsUpDown className="h-3 w-3" />
          {allCollapsed ? "Expandir todo" : "Colapsar todo"}
        </button>
      </div>

      {grouped.map((group) => {
        const key = group.assetId ?? "__no_asset__"
        const isCollapsed = collapsedAssets.has(key)

        return (
          <div key={key} className="rounded-lg border border-border/60 overflow-hidden">
            {/* Cabecera del activo */}
            <button
              type="button"
              onClick={() => toggleAsset(key)}
              className="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              {isCollapsed
                ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              }

              <div className="flex-1 flex items-center gap-2 min-w-0">
                {group.assetId ? (
                  <>
                    <Link
                      href={`/activos/${group.assetId}`}
                      className="font-semibold text-sm hover:underline text-foreground shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.assetCode}
                    </Link>
                    {group.assetFullName && group.assetFullName !== group.assetCode && group.assetFullName !== "Activo no encontrado" && (
                      <span className="text-xs text-muted-foreground truncate">
                        {group.assetFullName}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-semibold text-sm text-muted-foreground">Sin activo</span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  · {group.incidents.length} total
                  <span className="text-foreground/90 font-medium">
                    {" "}
                    ({group.openCount} abierto{group.openCount !== 1 ? "s" : ""}
                    {group.incidents.length - group.openCount > 0
                      ? ` · ${group.incidents.length - group.openCount} resuelto${group.incidents.length - group.openCount !== 1 ? "s" : ""}`
                      : ""}
                    )
                  </span>
                </span>
              </div>

              {group.criticalCount > 0 && (
                <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {group.criticalCount} sin resolver +7d
                </span>
              )}
            </button>

            {/* Filas de incidentes — más recientes primero */}
            {!isCollapsed && (
              <div className="divide-y divide-border/30">
                <div className="hidden sm:flex items-center gap-4 px-4 py-1.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <span className="w-24 shrink-0">Creación</span>
                  <span className="w-24 shrink-0">Última</span>
                  <span className="w-[9.5rem] shrink-0">Estado</span>
                  <span className="flex-1 min-w-0">Problema</span>
                  <span className="w-32 shrink-0 text-right hidden md:block">Reportante</span>
                  <span className="w-28 shrink-0 text-right">OT</span>
                </div>
                {groupIncidentsIntoThreads(group.incidents).map((thread) => {
                  const threadKey = `${key}:${thread.canonicalKey}`
                  const isThreadExpanded = expandedThreads.has(threadKey)
                  const planningInfo = classifyThreadPlanning(
                    thread.incidents,
                    dateBounds,
                  )
                  const threadDates = summarizeThreadDates(thread.incidents)
                  const displayIncidents = isThreadExpanded
                    ? filterThreadOccurrencesForDisplay(
                        thread.incidents,
                        dateBounds,
                        threadDateMode,
                      )
                    : [thread.primaryIncident]
                  const rows = displayIncidents.length > 0 ? displayIncidents : [thread.primaryIncident]

                  return (
                    <div key={threadKey} className="border-b border-border/20 last:border-b-0">
                      {rows.map((incident, idx) => {
                        const incidentId = typeof incident.id === "string" ? incident.id : null
                        const workOrderId =
                          typeof incident.work_order_id === "string"
                            ? incident.work_order_id
                            : thread.workOrderId
                        const dateStr = (incident.date ?? incident.created_at) as string | undefined
                        const createdAtStr = incident.created_at as string | undefined
                        const inBounds = isOccurrenceInBounds(incident, dateBounds)
                        const status = String(incident.status ?? "")
                        const resolved = isResolved(status)
                        const isPrimaryRow = idx === 0 && !isThreadExpanded
                        const days = getDaysSinceCreated(
                          isPrimaryRow && Number.isFinite(threadDates.latestObservedMs)
                            ? new Date(threadDates.latestObservedMs).toISOString()
                            : (dateStr ?? ""),
                        )
                        const statusLabel = getStatusInfo(status).label
                        const priority = getPriorityInfo(status, days)
                        const PriorityIcon = priority.icon

                        return (
                          <div
                            key={incidentId ?? `t-${idx}`}
                            className={cn(
                              "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/40",
                              rowSurfaceClass(resolved, days),
                              !isPrimaryRow && "bg-muted/10 pl-8",
                              dateBounds && !inBounds && isThreadExpanded && "opacity-60",
                            )}
                            onClick={() => incidentId && router.push(`/incidentes/${incidentId}`)}
                          >
                            <div className="flex items-center gap-2 sm:contents">
                              <span className="shrink-0 text-xs text-muted-foreground w-24 whitespace-nowrap">
                                {isPrimaryRow ? (
                                  <>
                                    <span className="block">
                                      {Number.isFinite(threadDates.firstCreatedMs)
                                        ? formatDate(
                                            new Date(threadDates.firstCreatedMs).toISOString(),
                                          )
                                        : "—"}
                                    </span>
                                  </>
                                ) : (
                                  formatDate(createdAtStr ?? dateStr)
                                )}
                              </span>
                              <span className="shrink-0 text-xs w-24 whitespace-nowrap">
                                {isPrimaryRow ? (
                                  <span
                                    className={cn(
                                      "font-medium",
                                      dateBounds &&
                                        Number.isFinite(threadDates.latestObservedMs) &&
                                        threadDates.latestObservedMs >= dateBounds.fromMs &&
                                        threadDates.latestObservedMs <= dateBounds.toMs
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {Number.isFinite(threadDates.latestObservedMs)
                                      ? formatDate(
                                          new Date(threadDates.latestObservedMs).toISOString(),
                                        )
                                      : "—"}
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      inBounds && dateBounds
                                        ? "font-medium text-foreground"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {formatDate(dateStr)}
                                  </span>
                                )}
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5 sm:w-[9.5rem] sm:shrink-0">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold px-2 py-0 h-5 border",
                                    statusBadgeClass(status),
                                  )}
                                >
                                  {statusLabel}
                                </Badge>
                                {!resolved && (
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-semibold px-2 py-0 h-5 border gap-0.5",
                                      urgencyBadgeClass(priority.level),
                                    )}
                                  >
                                    <PriorityIcon className="h-2.5 w-2.5" aria-hidden />
                                    {priority.label}
                                  </Badge>
                                )}
                                {isPrimaryRow && thread.occurrenceCount > 1 && (
                                  <button
                                    type="button"
                                    className="text-[10px] font-medium text-primary hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleThread(threadKey)
                                    }}
                                  >
                                    {dateBounds && planningInfo.inCohortCount > 0
                                      ? `${planningInfo.inCohortCount} en periodo · ${thread.occurrenceCount} reapariciones`
                                      : `${thread.occurrenceCount} reapariciones`}
                                  </button>
                                )}
                                {isPrimaryRow &&
                                  dateBounds &&
                                  planningInfo.planningClass !== "none" && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-medium px-1.5 py-0 h-5",
                                        planningInfo.planningClass === "nuevo" &&
                                          "border-emerald-300 bg-emerald-50 text-emerald-800",
                                        planningInfo.planningClass === "reincidente" &&
                                          "border-violet-300 bg-violet-50 text-violet-800",
                                        planningInfo.planningClass === "mixto" &&
                                          "border-amber-300 bg-amber-50 text-amber-800",
                                      )}
                                    >
                                      {planningInfo.label}
                                    </Badge>
                                  )}
                              </div>
                            </div>

                            <p
                              className={cn(
                                "flex-1 text-sm leading-snug line-clamp-2 sm:line-clamp-1 min-w-0",
                                resolved ? "text-muted-foreground" : "text-foreground font-medium",
                              )}
                              title={String(incident.description ?? "")}
                            >
                              {isPrimaryRow
                                ? thread.coreItemLabel
                                : String(incident.description ?? "—")}
                            </p>

                            <span className="shrink-0 hidden md:block text-xs text-muted-foreground w-32 truncate text-right">
                              {getReporterName(incident)}
                            </span>

                            <div
                              className="shrink-0 w-full sm:w-28 flex justify-start sm:justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {workOrderId ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant={resolved ? "ghost" : "outline"}
                                  className={cn(
                                    "h-7 text-xs cursor-pointer",
                                    resolved && "text-muted-foreground border border-border/60",
                                  )}
                                >
                                  <Link href={`/ordenes/${workOrderId}`}>
                                    <Wrench className="mr-1 h-3 w-3" />
                                    {(incident.work_order_order_id ?? thread.workOrderOrderId)
                                      ? `OT #${incident.work_order_order_id ?? thread.workOrderOrderId}`
                                      : "Ver OT"}
                                  </Link>
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {isThreadExpanded && (
                        <button
                          type="button"
                          className="w-full px-4 py-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => toggleThread(threadKey)}
                        >
                          Ocultar historial de ocurrencias
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
