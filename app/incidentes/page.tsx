"use client"

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { IncidentsOTLookup } from "@/components/incidents/incidents-ot-lookup"
import { IncidentSnapshotPrintDocument } from "@/components/incidents/incident-snapshot-print-document"
import { IncidentsPeriodBar } from "@/components/incidents/IncidentsPeriodBar"
import { IncidentsPeriodRibbon } from "@/components/incidents/IncidentsPeriodRibbon"
import { IncidentsFilterBar } from "@/components/incidents/incidents-filter-bar"
import { useToast } from "@/hooks/use-toast"
import { buildIncidentesFilterSummary } from "@/lib/incidents/incident-list-filters"
import { generateIncidentSnapshotPdf } from "@/lib/incidents/generate-incident-snapshot-pdf"
import { aggregateIncidentDashboardStats } from "@/lib/incident-dashboard-metrics"
import { useIncidentFilters } from "@/hooks/useIncidentFilters"

function IncidentsPageContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const assetFromUrl = searchParams.get("asset")

  const {
    filters,
    searchTerm,
    setSearchTerm,
    setFilters,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    dateBounds,
    filterIncidentsForIncidentesPage,
  } = useIncidentFilters()

  const [incidents, setIncidents] = useState<Record<string, unknown>[]>([])
  const [assets, setAssets] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [snapshotAt, setSnapshotAt] = useState(() => new Date())
  const snapshotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (assetFromUrl && !searchTerm) {
      setSearchTerm(assetFromUrl)
    }
  }, [assetFromUrl, searchTerm, setSearchTerm])

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await fetch("/api/incidents")
        if (res.ok) {
          setIncidents(await res.json())
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
        if (res.ok) setAssets(await res.json())
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

  const plantOptions = useMemo(() => {
    const map = new Map<string, string>()
    assets.forEach((raw) => {
      const a = raw as Record<string, unknown>
      const pid = a.plant_id
      if (typeof pid !== "string" || !pid) return
      const plants = a.plants as { name?: string; code?: string } | null | undefined
      const label = plants?.name ? String(plants.name) : plants?.code ? String(plants.code) : pid
      if (!map.has(pid)) map.set(pid, label)
    })
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((x, y) => x.label.localeCompare(y.label, "es"))
  }, [assets])

  const prefilledAssetName = useMemo(() => {
    if (!filters.assetIdFromUrl || assets.length === 0) return null
    const asset = assets.find(
      (a: Record<string, unknown>) => a.id === filters.assetIdFromUrl,
    ) as Record<string, unknown> | undefined
    return asset ? String(asset.name ?? asset.asset_id ?? "Activo") : "Activo"
  }, [filters.assetIdFromUrl, assets])

  const prefilledPlantName = useMemo(() => {
    if (filters.plantFilter === "all") return null
    return plantOptions.find((p) => p.id === filters.plantFilter)?.label ?? "Planta"
  }, [filters.plantFilter, plantOptions])

  const filteredIncidents = useMemo(
    () =>
      filterIncidentsForIncidentesPage(incidents, assets, {
        ...filters,
        searchTerm,
      }),
    [incidents, assets, filters, searchTerm, filterIncidentsForIncidentesPage],
  )

  const stats = useMemo(() => {
    const a = aggregateIncidentDashboardStats(
      filteredIncidents as {
        status?: string | null
        date?: string | null
        created_at?: string | null
      }[],
    )
    return { open: a.open, critical: a.openOver7Days, resolved: a.resolved, total: a.total }
  }, [filteredIncidents])

  const filterSummaryLine = useMemo(
    () =>
      buildIncidentesFilterSummary(
        { ...filters, searchTerm },
        { assetLabel: prefilledAssetName, plantLabel: prefilledPlantName },
      ),
    [filters, searchTerm, prefilledAssetName, prefilledPlantName],
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
        <div className="flex items-center gap-6 text-sm">
          <span>
            <span className="font-semibold text-foreground">{stats.total}</span>{" "}
            <span className="text-muted-foreground">en vista</span>
          </span>
          <span>
            <span className="font-semibold text-foreground">{stats.open}</span>{" "}
            <span className="text-muted-foreground">abiertos</span>
          </span>
          {stats.critical > 0 && (
            <span>
              <span className="font-semibold text-red-600">{stats.critical}</span>{" "}
              <span className="text-muted-foreground">+7 días</span>
            </span>
          )}
        </div>

        <IncidentsPeriodBar filters={filters} onFiltersChange={setFilters} />

        <IncidentsPeriodRibbon
          incidents={incidents}
          bounds={dateBounds}
          filters={filters}
          onFiltersChange={setFilters}
          onExportPdf={handleInstantaneoPdf}
          exportDisabled={snapshotOpen}
        />

        <IncidentsFilterBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={filters.statusFilter}
          onStatusChange={(v) => setFilters({ statusFilter: v })}
          typeFilter={filters.typeFilter}
          onTypeChange={(v) => setFilters({ typeFilter: v })}
          priorityFilter={filters.priorityFilter}
          onPriorityChange={(v) => setFilters({ priorityFilter: v })}
          workOrderFilter={filters.workOrderFilter}
          onWorkOrderChange={(v) => setFilters({ workOrderFilter: v })}
          plantFilter={filters.plantFilter}
          onPlantChange={(v) => setFilters({ plantFilter: v })}
          lifecycleFilter={filters.lifecycleFilter}
          onLifecycleChange={(v) => setFilters({ lifecycleFilter: v })}
          plantOptions={plantOptions}
          onClearAll={clearAllFilters}
          activeFilterCount={activeFilterCount}
          uniqueStatuses={uniqueStatuses}
          uniqueTypes={uniqueTypes}
        />

        <IncidentsOTLookup
          incidents={filteredIncidents}
          assets={assets}
          dateBounds={dateBounds}
          threadDateMode={filters.threadDateMode}
        />

        {hasActiveFilters && filteredIncidents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay incidentes con los filtros actuales.{" "}
            <button
              type="button"
              className="underline cursor-pointer"
              onClick={clearAllFilters}
            >
              Limpiar filtros
            </button>
          </p>
        )}
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
          </div>
        </DashboardShell>
      }
    >
      <IncidentsPageContent />
    </Suspense>
  )
}
