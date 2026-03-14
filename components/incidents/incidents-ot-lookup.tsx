"use client"

import { Button } from "@/components/ui/button"
import { FileWarning, Wrench, ChevronDown, ChevronRight, AlertTriangle, ChevronsUpDown } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect } from "react"
import { getAssetName, getAssetFullName, getReporterName } from "./incidents-list-utils"
import { getDaysSinceCreated } from "./incidents-status-utils"
import { cn } from "@/lib/utils"

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    return format(new Date(dateStr), "dd MMM yy", { locale: es })
  } catch {
    return "—"
  }
}

function isResolved(status: string): boolean {
  const s = status.toLowerCase()
  return s === "resolved" || s === "resuelto" || s === "cerrado"
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
                  · {group.incidents.length} incidente{group.incidents.length !== 1 ? "s" : ""}
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
                {group.incidents.map((incident, idx) => {
                  const incidentId = typeof incident.id === "string" ? incident.id : null
                  const workOrderId = typeof incident.work_order_id === "string" ? incident.work_order_id : null
                  const dateStr = (incident.date ?? incident.created_at) as string | undefined
                  const status = String(incident.status ?? "")
                  const resolved = isResolved(status)
                  const days = getDaysSinceCreated(dateStr ?? "")
                  const isCritical = !resolved && days >= 7

                  return (
                    <div
                      key={incidentId ?? `i-${idx}`}
                      className={cn(
                        "flex items-center gap-4 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/30",
                        resolved && "opacity-50",
                        isCritical && "bg-red-50/50"
                      )}
                      onClick={() => incidentId && router.push(`/incidentes/${incidentId}`)}
                    >
                      <span className="shrink-0 text-xs text-muted-foreground w-20 whitespace-nowrap">
                        {formatDate(dateStr)}
                      </span>

                      <p
                        className="flex-1 text-sm text-foreground leading-snug line-clamp-1"
                        title={String(incident.description ?? "")}
                      >
                        {String(incident.description ?? "—")}
                      </p>

                      <span className="shrink-0 hidden md:block text-xs text-muted-foreground w-32 truncate text-right">
                        {getReporterName(incident)}
                      </span>

                      <div
                        className="shrink-0 w-28 flex justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {workOrderId ? (
                          <Button asChild size="sm" variant="outline" className="h-7 text-xs cursor-pointer">
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
