"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { IncidentRoutingTable } from "@/components/incidents/incident-routing-table"
import { useToast } from "@/hooks/use-toast"
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

const PAGE_SIZE = 50

export function DepartmentInboxTab() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [activeSlug, setActiveSlug] = useState<CanonicalRoutingDepartmentSlug | "unrouted" | "all">(
    "unrouted",
  )
  const [items, setItems] = useState<RoutedIncident[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [searchDraft, setSearchDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingList, setLoadingList] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)

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
      if (activeSlug === "unrouted") {
        params.set("unrouted", "true")
      } else if (activeSlug !== "all") {
        params.set("canonical", activeSlug)
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
  }, [activeSlug, offset, search])

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
  }, [activeSlug, search])

  const activeLabel = useMemo(() => {
    if (activeSlug === "all") return "Todos los enrutados"
    if (activeSlug === "unrouted") return "Sin clasificar"
    return CANONICAL_ROUTING_DEPARTMENTS.find((d) => d.slug === activeSlug)?.label ?? activeSlug
  }, [activeSlug])

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showBulkBar = selectedIds.size > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-base font-semibold">Bandejas por departamento</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cuatro destinos de ruteo: Mantenimiento, Operaciones, Recursos Humanos y Calidad.
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
              Revisa códigos/nombres en `departments` (MANT, OPER, RH, CAL).
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

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {CANONICAL_ROUTING_DEPARTMENTS.map((dept) => {
          const resolved = summary?.canonical_departments.find((d) => d.slug === dept.slug)
          const count = summary?.by_canonical_department[dept.slug] ?? 0
          const missing = !resolved?.primaryDepartmentId
          return (
            <button
              key={dept.slug}
              type="button"
              onClick={() => setActiveSlug(dept.slug)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors",
                dept.colorClass,
                activeSlug === dept.slug && "ring-2 ring-primary ring-offset-1",
                missing && "opacity-60",
              )}
            >
              <div className="text-xs font-medium uppercase tracking-wide opacity-80">
                {dept.shortLabel}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{count}</div>
              <div className="text-xs mt-1 truncate">{dept.label}</div>
              {missing && <div className="text-[10px] mt-1">Sin mapear en BD</div>}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setActiveSlug("unrouted")}
          className={cn(
            "rounded-lg border border-dashed px-3 py-3 text-left bg-muted/30",
            activeSlug === "unrouted" && "ring-2 ring-primary ring-offset-1",
          )}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pendiente
          </div>
          <div className="text-2xl font-semibold tabular-nums">{summary?.unrouted ?? 0}</div>
          <div className="text-xs mt-1 text-muted-foreground">Sin clasificar</div>
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
            {CANONICAL_ROUTING_DEPARTMENTS.map((dept) => (
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
                Vista compacta para alto volumen ({total.toLocaleString("es-MX")} coincidencias).
                Mostrando {items.length} por página.
                {activeSlug === "unrouted" && " Selecciona filas y asigna departamento en bloque."}
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
              className={cn("underline-offset-2 hover:underline", activeSlug === "all" && "font-medium")}
              onClick={() => setActiveSlug("all")}
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
              compact={activeSlug !== "all"}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
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
