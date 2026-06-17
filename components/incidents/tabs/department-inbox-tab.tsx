"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, User, Wand2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { IncidentRoutingTable } from "@/components/incidents/incident-routing-table"
import { useToast } from "@/hooks/use-toast"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import {
  CANONICAL_ROUTING_DEPARTMENTS,
  type CanonicalRoutingDepartmentSlug,
  type ResolvedCanonicalDepartment,
} from "@/lib/incidents/incident-routing-departments"
import type { RoutedIncident } from "@/lib/incidents/incident-routing"
import { cn } from "@/lib/utils"

type SummaryResponse = {
  total_open: number
  unrouted: number
  sla_breached: number
  by_canonical_department: Record<CanonicalRoutingDepartmentSlug, number>
  canonical_departments: ResolvedCanonicalDepartment[]
}

type ListResponse = {
  items: RoutedIncident[]
  total: number
  limit: number
  offset: number
}

type InboxView = "mine" | CanonicalRoutingDepartmentSlug | "unrouted" | "all"

const PAGE_SIZE = 50

export function DepartmentInboxTab() {
  const { toast } = useToast()
  const { user } = useAuthZustand()
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [activeView, setActiveView] = useState<InboxView>("mine")
  const [items, setItems] = useState<RoutedIncident[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [searchDraft, setSearchDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingList, setLoadingList] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [autoRouting, setAutoRouting] = useState(false)
  const [rowActionLoadingId, setRowActionLoadingId] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/incidents/routed?summary=true")
    if (res.ok) setSummary(await res.json())
  }, [])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })

      if (activeView === "mine") {
        params.set("inbox", "mine")
      } else if (activeView === "unrouted") {
        params.set("unrouted", "true")
      } else if (activeView !== "all") {
        params.set("canonical", activeView)
      }

      if (search.trim()) params.set("search", search.trim())

      const res = await fetch(`/api/incidents/routed?${params}`)
      if (res.ok) {
        const data = (await res.json()) as ListResponse
        setItems(data.items)
        setTotal(data.total)
      }
    } finally {
      setLoadingList(false)
    }
  }, [activeView, offset, search])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadSummary()
      setLoading(false)
    }
    void init()
  }, [loadSummary])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    setOffset(0)
    setSelectedIds(new Set())
  }, [activeView, search])

  const activeLabel = useMemo(() => {
    if (activeView === "mine") return "Mi bandeja"
    if (activeView === "all") return "Todos los enrutados"
    if (activeView === "unrouted") return "Sin clasificar"
    return CANONICAL_ROUTING_DEPARTMENTS.find((d) => d.slug === activeView)?.label ?? activeView
  }, [activeView])

  const configuredCount = useMemo(() => {
    if (!summary) return 0
    return summary.canonical_departments.filter((d) => d.primaryDepartmentId).length
  }, [summary])

  const bulkAssign = async (canonical: CanonicalRoutingDepartmentSlug) => {
    if (selectedIds.size === 0) return

    const bucket = summary?.canonical_departments.find((d) => d.slug === canonical)
    if (!bucket?.primaryDepartmentId) {
      toast({
        title: "Departamento no configurado",
        description: `No hay fila en BD para ${CANONICAL_ROUTING_DEPARTMENTS.find((d) => d.slug === canonical)?.label}.`,
        variant: "destructive",
      })
      return
    }

    setBulkAssigning(true)
    try {
      const res = await fetch("/api/incidents/routed/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_ids: Array.from(selectedIds),
          canonical,
          reason: `Clasificación masiva → ${CANONICAL_ROUTING_DEPARTMENTS.find((d) => d.slug === canonical)?.label}`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Error en clasificación masiva")

      toast({
        title: "Clasificación aplicada",
        description: `${data.succeeded ?? 0} incidente(s) asignados${data.failed ? ` · ${data.failed} fallidos` : ""}.`,
      })
      setSelectedIds(new Set())
      await loadSummary()
      await loadList()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo clasificar",
        variant: "destructive",
      })
    } finally {
      setBulkAssigning(false)
    }
  }

  const bulkAssignToMe = async () => {
    if (!user?.id || selectedIds.size === 0) return
    setBulkAssigning(true)
    try {
      const res = await fetch("/api/incidents/routed/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_ids: Array.from(selectedIds),
          assigned_to_id: user.id,
          reason: "Asignación masiva a mi bandeja",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Error al asignar")

      toast({
        title: "Asignación aplicada",
        description: `${data.succeeded ?? 0} incidente(s) en tu bandeja.`,
      })
      setSelectedIds(new Set())
      await loadSummary()
      await loadList()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo asignar",
        variant: "destructive",
      })
    } finally {
      setBulkAssigning(false)
    }
  }

  const autoRouteSelected = async () => {
    if (selectedIds.size === 0) return
    setAutoRouting(true)
    try {
      const res = await fetch("/api/incidents/routed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_ids: Array.from(selectedIds) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Error en auto-clasificación")

      const succeeded = (data.results ?? []).filter((r: { ok: boolean }) => r.ok).length
      const failed = (data.results ?? []).length - succeeded

      toast({
        title: "Auto-clasificación",
        description: `${succeeded} clasificados por reglas${failed ? ` · ${failed} sin regla` : ""}.`,
      })
      setSelectedIds(new Set())
      await loadSummary()
      await loadList()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo auto-clasificar",
        variant: "destructive",
      })
    } finally {
      setAutoRouting(false)
    }
  }

  const claimIncident = async (incidentId: string) => {
    setRowActionLoadingId(incidentId)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/claim`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo tomar el incidente")
      toast({ title: "Incidente tomado", description: "Quedó asignado en tu bandeja." })
      await loadSummary()
      await loadList()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo tomar",
        variant: "destructive",
      })
    } finally {
      setRowActionLoadingId(null)
    }
  }

  const acknowledgeIncident = async (incidentId: string) => {
    setRowActionLoadingId(incidentId)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "No se pudo acusar recibo")
      toast({ title: "Acuse registrado", description: "El departamento tomó conocimiento." })
      await loadSummary()
      await loadList()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo acusar",
        variant: "destructive",
      })
    } finally {
      setRowActionLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showBulkBar = selectedIds.size > 0
  const showDeptBulk = activeView === "unrouted" || activeView === "all"

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold">Bandejas por departamento</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Mi bandeja muestra incidentes asignados a ti y sin responsable en tus departamentos.
            {summary && (
              <>
                {" "}
                <span className="font-medium text-foreground">{summary.total_open}</span> abiertos
                · <span className="font-medium text-foreground">{summary.unrouted}</span> sin
                clasificar
              </>
            )}
          </p>
          {configuredCount < 4 && (
            <p className="text-xs text-amber-700 mt-2">
              Solo {configuredCount}/4 departamentos canónicos están mapeados en la base de datos.
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void loadSummary()
            void loadList()
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveView("mine")}
          className={cn(
            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            activeView === "mine" && "ring-2 ring-primary ring-offset-1 bg-primary/5",
          )}
        >
          <User className="inline h-3.5 w-3.5 mr-1" />
          Mi bandeja
        </button>
        {CANONICAL_ROUTING_DEPARTMENTS.map((dept) => {
          const resolved = summary?.canonical_departments.find((d) => d.slug === dept.slug)
          const count = summary?.by_canonical_department[dept.slug] ?? 0
          const missing = !resolved?.primaryDepartmentId
          return (
            <button
              key={dept.slug}
              type="button"
              onClick={() => setActiveView(dept.slug)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                dept.colorClass,
                activeView === dept.slug && "ring-2 ring-primary ring-offset-1",
                missing && "opacity-60",
              )}
            >
              <span className="font-medium">{dept.shortLabel}</span>
              <span className="ml-2 tabular-nums text-muted-foreground">{count}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setActiveView("unrouted")}
          className={cn(
            "rounded-lg border border-dashed px-3 py-2 text-sm",
            activeView === "unrouted" && "ring-2 ring-primary ring-offset-1",
          )}
        >
          Sin clasificar
          <span className="ml-2 tabular-nums font-medium">{summary?.unrouted ?? 0}</span>
        </button>
      </div>

      {showBulkBar && (
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">{selectedIds.size} seleccionados</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Limpiar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeView === "unrouted" && (
              <Button
                size="sm"
                variant="default"
                disabled={autoRouting}
                onClick={() => void autoRouteSelected()}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                Auto-clasificar
              </Button>
            )}
            {user?.id && activeView !== "unrouted" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={bulkAssigning}
                onClick={() => void bulkAssignToMe()}
              >
                Asignarme
              </Button>
            )}
            {showDeptBulk &&
              CANONICAL_ROUTING_DEPARTMENTS.map((dept) => (
                <Button
                  key={dept.slug}
                  size="sm"
                  variant="secondary"
                  disabled={bulkAssigning}
                  className={cn("text-xs", dept.colorClass)}
                  onClick={() => void bulkAssign(dept.slug)}
                >
                  → {dept.shortLabel}
                </Button>
              ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">{activeLabel}</CardTitle>
              <CardDescription>
                {total.toLocaleString("es-MX")} coincidencias · página de {PAGE_SIZE}.
                {activeView === "mine" &&
                  " Usa Tomar / Acusar en fila o abre el detalle para más opciones."}
                {activeView === "unrouted" &&
                  " Selecciona filas y auto-clasifica por reglas o asigna departamento manualmente."}
              </CardDescription>
            </div>
            <form
              className="flex w-full max-w-md gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(searchDraft)
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Buscar tipo o descripción…"
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="secondary">
                Buscar
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {summary && summary.sla_breached > 0 && (
              <Badge variant="destructive">{summary.sla_breached} fuera de SLA</Badge>
            )}
            <button
              type="button"
              className={cn("underline-offset-2 hover:underline", activeView === "all" && "font-medium")}
              onClick={() => setActiveView("all")}
            >
              Ver todos los enrutados
            </button>
          </div>

          {loadingList ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <IncidentRoutingTable
              incidents={items}
              compact={activeView !== "all" && activeView !== "unrouted"}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showRowActions={activeView === "mine" || activeView !== "unrouted"}
              rowActionLoadingId={rowActionLoadingId}
              onClaim={claimIncident}
              onAcknowledge={acknowledgeIncident}
            />
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {total === 0
                ? "Sin resultados"
                : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} de ${total}`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0 || loadingList}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total || loadingList}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
