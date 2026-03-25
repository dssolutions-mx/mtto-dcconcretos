"use client"

import { Button } from "@/components/ui/button"
import { FileWarning, Wrench, ChevronDown, ChevronRight, AlertTriangle, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { getAssetName, getAssetFullName, getReporterName } from "./incidents-list-utils"
import { getDaysSinceCreated, getStatusInfo, normalizeStatus, getPriorityInfo } from "./incidents-status-utils"
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

interface AssetGroup {
  assetId: string | null
  assetCode: string
  assetFullName: string
  incidents: Record<string, unknown>[]
  openCount: number
  criticalCount: number
}

interface IncidentsOTLookupProps {
  incidents: Record<string, unknown>[]
  assets: Record<string, unknown>[]
}

export function IncidentsOTLookup({ incidents, assets }: IncidentsOTLookupProps) {
  const router = useRouter()
  const [collapsedAssets, setCollapsedAssets] = useState<Set<string>>(new Set())
  const [allCollapsed, setAllCollapsed] = useState(false)

  const grouped = useMemo((): AssetGroup[] => {
    const map = new Map<string, AssetGroup>()

    incidents.forEach((incident) => {
      const assetId = typeof incident.asset_id === "string" ? incident.asset_id : null
      const key = assetId ?? "__no_asset__"
      const assetCode = getAssetName(incident, assets)
      const assetFullName = getAssetFullName(incident, assets)

      if (!map.has(key)) {
        map.set(key, { assetId, assetCode, assetFullName, incidents: [], openCount: 0, criticalCount: 0 })
      }

      const group = map.get(key)!
      group.incidents.push(incident)

      const status = String(incident.status ?? "")
      if (!isResolved(status)) {
        group.openCount++
        const dateStr = (incident.date ?? incident.created_at) as string | undefined
        if (getDaysSinceCreated(dateStr ?? "") >= 7) group.criticalCount++
      }
    })

    // Sort incidents within each group: most recent first
    for (const group of map.values()) {
      group.incidents.sort((a, b) => {
        const da = new Date((a.date ?? a.created_at ?? "") as string).getTime()
        const db = new Date((b.date ?? b.created_at ?? "") as string).getTime()
        return db - da
      })
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount
      return b.openCount - a.openCount
    })
  }, [incidents, assets])

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
                  <span className="w-20 shrink-0">Fecha</span>
                  <span className="w-[9.5rem] shrink-0">Estado</span>
                  <span className="flex-1 min-w-0">Descripción</span>
                  <span className="w-32 shrink-0 text-right hidden md:block">Reportante</span>
                  <span className="w-28 shrink-0 text-right">OT</span>
                </div>
                {group.incidents.map((incident, idx) => {
                  const incidentId = typeof incident.id === "string" ? incident.id : null
                  const workOrderId = typeof incident.work_order_id === "string" ? incident.work_order_id : null
                  const dateStr = (incident.date ?? incident.created_at) as string | undefined
                  const status = String(incident.status ?? "")
                  const resolved = isResolved(status)
                  const days = getDaysSinceCreated(dateStr ?? "")
                  const statusLabel = getStatusInfo(status).label
                  const priority = getPriorityInfo(status, days)
                  const PriorityIcon = priority.icon

                  return (
                    <div
                      key={incidentId ?? `i-${idx}`}
                      className={cn(
                        "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/40",
                        rowSurfaceClass(resolved, days),
                      )}
                      onClick={() => incidentId && router.push(`/incidentes/${incidentId}`)}
                    >
                      <div className="flex items-center gap-2 sm:contents">
                        <span className="shrink-0 text-xs text-muted-foreground w-20 whitespace-nowrap">
                          {formatDate(dateStr)}
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
                        </div>
                      </div>

                      <p
                        className={cn(
                          "flex-1 text-sm leading-snug line-clamp-2 sm:line-clamp-1 min-w-0",
                          resolved ? "text-muted-foreground" : "text-foreground font-medium",
                        )}
                        title={String(incident.description ?? "")}
                      >
                        {String(incident.description ?? "—")}
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
                              {incident.work_order_order_id
                                ? `OT #${incident.work_order_order_id}`
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
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
