"use client"

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, X, FileDown, Loader2 } from "lucide-react"
import Link from "next/link"
import { IncidentsOTLookup } from "@/components/incidents/incidents-ot-lookup"
import { IncidentSnapshotPrintDocument } from "@/components/incidents/incident-snapshot-print-document"
import { useToast } from "@/hooks/use-toast"
import {
  filterIncidentsForIncidentesPage,
  buildIncidentesFilterSummary,
} from "@/lib/incidents/incident-list-filters"
import { generateIncidentSnapshotPdf } from "@/lib/incidents/generate-incident-snapshot-pdf"
import { aggregateIncidentDashboardStats } from "@/lib/incident-dashboard-metrics"

function IncidentsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const assetIdFromUrl = searchParams.get("assetId")
  const assetFromUrl = searchParams.get("asset")

  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([])
  const [assets, setAssets] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "open" | "resolved">("all")
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotAt, setSnapshotAt] = useState(() => new Date())
  const snapshotRef = useRef<HTMLDivElement>(null)

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
    const a = aggregateIncidentDashboardStats(
      incidents as { status?: string | null; date?: string | null; created_at?: string | null }[],
    )
    return { open: a.open, critical: a.openOver7Days, resolved: a.resolved, total: a.total }
  }, [incidents])

  const prefilledAssetName = useMemo(() => {
    if (!assetIdFromUrl || assets.length === 0) return null
    const asset = assets.find((a: Record<string, unknown>) => a.id === assetIdFromUrl) as Record<string, unknown> | undefined
    return asset ? String(asset.name ?? asset.asset_id ?? "Activo") : "Activo"
  }, [assetIdFromUrl, assets])

  const incidentesFilters = useMemo(
    () => ({
      assetIdFromUrl,
      lifecycleFilter,
      statusFilter,
      typeFilter,
      searchTerm,
    }),
    [assetIdFromUrl, lifecycleFilter, statusFilter, typeFilter, searchTerm],
  )

  const filteredIncidents = useMemo(
    () => filterIncidentsForIncidentesPage(incidents, assets, incidentesFilters),
    [incidents, assets, incidentesFilters],
  )

  const filterSummaryLine = useMemo(
    () =>
      buildIncidentesFilterSummary(
        {
          assetIdFromUrl,
          lifecycleFilter,
          statusFilter,
          typeFilter,
          searchTerm,
        },
        { assetLabel: prefilledAssetName },
      ),
    [assetIdFromUrl, lifecycleFilter, statusFilter, typeFilter, searchTerm, prefilledAssetName],
  )

  const handleSnapshotPdfReady = useCallback(
    async (el: HTMLElement) => {
      try {
        await generateIncidentSnapshotPdf(el)
        toast({
          title: "PDF generado",
          description: "El instantáneo se descargó correctamente.",
        })
      } catch (err) {
        console.error(err)
        toast({
          title: "Error al generar PDF",
          description: err instanceof Error ? err.message : "Error desconocido",
          variant: "destructive",
        })
      } finally {
        setSnapshotOpen(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!snapshotOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [snapshotOpen])

  const handleInstantaneoPdf = () => {
    if (filteredIncidents.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay incidentes que coincidan con los filtros actuales.",
        variant: "destructive",
      })
      return
    }
    setSnapshotAt(new Date())
    setSnapshotOpen(true)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setTypeFilter("all")
    setLifecycleFilter("all")
    if (assetIdFromUrl || assetFromUrl) {
      router.replace("/incidentes")
    }
  }

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

  const pdfPortal =
    snapshotOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/75 backdrop-blur-[2px]"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
          aria-label="Generando PDF"
        >
          <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-lg border bg-card px-6 py-5 text-center shadow-lg">
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-semibold text-foreground">Generando instantáneo PDF</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Midiendo el listado y capturando el documento. Suele tardar unos segundos si hay muchas fotos.
            </p>
          </div>
        </div>
        <div className="pointer-events-none fixed left-0 top-0 z-[40] h-0 w-0 overflow-visible" aria-hidden>
          <div className="absolute left-[-9999px] top-0 w-[794px]">
            <IncidentSnapshotPrintDocument
              ref={snapshotRef}
              active={snapshotOpen}
              incidents={filteredIncidents}
              assets={assets}
              filterSummaryLine={filterSummaryLine}
              generatedAt={snapshotAt}
              onReadyForPdf={handleSnapshotPdfReady}
            />
          </div>
        </div>
      </>,
      document.body,
    )

  return (
    <DashboardShell>
      {pdfPortal}

      <DashboardHeader
        heading="Incidentes"
        text="Vista de incidentes activos agrupados por activo"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-w-[9rem] cursor-pointer"
            disabled={snapshotOpen}
            onClick={handleInstantaneoPdf}
          >
            {snapshotOpen ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <FileDown className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="hidden sm:inline">{snapshotOpen ? "Generando…" : "Instantáneo PDF"}</span>
            <span className="sm:hidden">{snapshotOpen ? "…" : "PDF"}</span>
          </Button>
          <Button asChild className="cursor-pointer">
            <Link href="/activos">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Reportar Incidente</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Métricas de resumen — texto plano, sin color */}
        <div className="flex items-center gap-6 text-sm">
          <span><span className="font-semibold text-foreground">{stats.total}</span> <span className="text-muted-foreground">total</span></span>
          <span><span className="font-semibold text-foreground">{stats.open}</span> <span className="text-muted-foreground">abiertos</span></span>
          {stats.critical > 0 && (
            <span><span className="font-semibold text-red-600">{stats.critical}</span> <span className="text-muted-foreground">sin resolver +7 días</span></span>
          )}
          <span><span className="font-semibold text-foreground">{stats.resolved}</span> <span className="text-muted-foreground">resueltos</span></span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground w-full sm:w-auto sm:mr-1">
            Vista rápida
          </span>
          {(["all", "open", "resolved"] as const).map((key) => {
            const labels = { all: "Todos", open: "Solo abiertos", resolved: "Solo resueltos" } as const
            return (
              <Button
                key={key}
                type="button"
                variant={lifecycleFilter === key ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs cursor-pointer"
                onClick={() => setLifecycleFilter(key)}
              >
                {labels[key]}
              </Button>
            )
          })}
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
          {(searchTerm || statusFilter !== "all" || typeFilter !== "all" || lifecycleFilter !== "all" || assetIdFromUrl || assetFromUrl) && (
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
