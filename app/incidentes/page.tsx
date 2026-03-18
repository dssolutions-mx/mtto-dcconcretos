"use client"

import { Suspense, useState, useEffect, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { IncidentsOTLookup } from "@/components/incidents/incidents-ot-lookup"
import { getAssetName, getAssetFullName, getReporterName } from "@/components/incidents/incidents-list-utils"

function IncidentsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetIdFromUrl = searchParams.get("assetId")
  const assetFromUrl = searchParams.get("asset")

  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([])
  const [assets, setAssets] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  // Initialize search from ?asset= param (used by coordinator dashboard)
  useEffect(() => {
    if (assetFromUrl && !searchTerm) {
      setSearchTerm(assetFromUrl)
    }
  }, [assetFromUrl])

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await fetch("/api/incidents")
        if (res.ok) {
          const data = await res.json()
          setIncidents(data)
        } else {
          setError("Error al cargar los incidentes")
        }
      } catch {
        setError("Error de conexión")
      } finally {
        setLoading(false)
      }
    }
    const fetchAssets = async () => {
      try {
        const res = await fetch("/api/assets")
        if (res.ok) {
          const data = await res.json()
          setAssets(data)
        }
      } catch {
        // ignore
      }
    }
    fetchIncidents()
    fetchAssets()
  }, [])

  const uniqueStatuses = useMemo(() => {
    const seen = new Set<string>()
    incidents.forEach((i) => {
      const s = String(i.status ?? "").trim()
      if (s) seen.add(s)
    })
    return Array.from(seen).sort()
  }, [incidents])

  const uniqueTypes = useMemo(() => {
    const seen = new Set<string>()
    incidents.forEach((i) => {
      const t = String(i.type ?? "").trim()
      if (t) seen.add(t)
    })
    return Array.from(seen).sort()
  }, [incidents])

  const stats = useMemo(() => {
    let open = 0
    let critical = 0
    let resolved = 0

    incidents.forEach((i) => {
      const status = String(i.status ?? "").toLowerCase()
      const isResolved = status === "resolved" || status === "resuelto" || status === "cerrado"
      if (isResolved) resolved++
      else {
        open++
        const dateStr = (i.date ?? i.created_at) as string | undefined
        const days = Math.ceil(Math.abs(new Date().getTime() - new Date(dateStr ?? "").getTime()) / (1000 * 60 * 60 * 24))
        if (days >= 7) critical++
      }
    })

    return { open, critical, resolved }
  }, [incidents])

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (assetIdFromUrl && incident.asset_id !== assetIdFromUrl) return false
      if (statusFilter !== "all" && String(incident.status ?? "") !== statusFilter) return false
      if (typeFilter !== "all" && String(incident.type ?? "") !== typeFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const assetName = getAssetName(incident, assets).toLowerCase()
        const assetFull = getAssetFullName(incident, assets).toLowerCase()
        const reporter = getReporterName(incident).toLowerCase()
        const desc = String(incident.description ?? "").toLowerCase()
        const orderId = incident.work_order_order_id ? String(incident.work_order_order_id) : ""
        if (
          !assetName.includes(q) &&
          !assetFull.includes(q) &&
          !reporter.includes(q) &&
          !desc.includes(q) &&
          !orderId.includes(q)
        ) return false
      }
      return true
    })
  }, [incidents, statusFilter, typeFilter, searchTerm, assets, assetIdFromUrl])

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    if (assetIdFromUrl || assetFromUrl) {
      router.replace("/incidentes")
    }
  }

  const prefilledAssetName = useMemo(() => {
    if (!assetIdFromUrl || assets.length === 0) return null
    const asset = assets.find((a: Record<string, unknown>) => a.id === assetIdFromUrl) as Record<string, unknown> | undefined
    return asset ? String(asset.name ?? asset.asset_id ?? "Activo") : "Activo"
  }, [assetIdFromUrl, assets])

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Incidentes" text="" />
        <div className="space-y-3">
          <div className="h-10 w-full max-w-xl rounded-lg bg-muted animate-pulse" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Incidentes"
        text="Vista de incidentes activos agrupados por activo"
      >
        <Button asChild className="cursor-pointer">
          <Link href="/activos">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Reportar Incidente</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </Button>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Métricas de resumen — texto plano, sin color */}
        <div className="flex items-center gap-6 text-sm">
          <span><span className="font-semibold text-foreground">{incidents.length}</span> <span className="text-muted-foreground">total</span></span>
          <span><span className="font-semibold text-foreground">{stats.open}</span> <span className="text-muted-foreground">abiertos</span></span>
          {stats.critical > 0 && (
            <span><span className="font-semibold text-red-600">{stats.critical}</span> <span className="text-muted-foreground">sin resolver +7 días</span></span>
          )}
          <span><span className="font-semibold text-foreground">{stats.resolved}</span> <span className="text-muted-foreground">resueltos</span></span>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por activo, descripción, reportante u OT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {uniqueStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {uniqueTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || assetIdFromUrl || assetFromUrl) && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>

        {prefilledAssetName && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
            >
              Filtro por activo: {prefilledAssetName}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Lista agrupada por activo */}
        <IncidentsOTLookup incidents={filteredIncidents} assets={assets} />
      </div>
    </DashboardShell>
  )
}

export default function IncidentsPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <DashboardHeader heading="Incidentes" text="" />
          <div className="space-y-3">
            <div className="h-10 w-full max-w-xl rounded-lg bg-muted animate-pulse" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </DashboardShell>
      }
    >
      <IncidentsPageContent />
    </Suspense>
  )
}
