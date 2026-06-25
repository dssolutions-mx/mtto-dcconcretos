"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { AssetChecklistCard } from "../assets/asset-checklist-card"
import { AssetChecklistListRow } from "../assets/asset-checklist-list-row"
import { AssetFilters } from "../assets/asset-filters"
import { ClipboardCheck, Factory, Info } from "lucide-react"
import type { AssetChecklistCardData } from "../assets/asset-checklist-card"
import { isPlantaAsset } from "@/lib/checklist/executor-roles"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

export interface ChecklistModel {
  id: string
  name: string
  manufacturer: string | null
}

interface PendingSchedule {
  checklists?: { frequency?: string | null } | null
  maintenance_plan_id?: string | null
}

interface AssetChecklistSummary {
  asset: AssetChecklistCardData & {
    plants?: { name: string } | null
    departments?: { name: string } | null
    equipment_models?: {
      id: string
      name: string
      manufacturer?: string | null
      maintenance_unit?: string | null
    } | null
  }
  pending_schedules: PendingSchedule[]
}

type AssetKindFilter = "all" | "planta" | "units"

const ASSET_KIND_OPTIONS: { value: AssetKindFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "planta", label: "Operaciones de planta" },
  { value: "units", label: "Unidades" },
]

function isPlantaSummaryAsset(asset: AssetChecklistSummary["asset"]): boolean {
  return isPlantaAsset({
    modelId: asset.model_id,
    maintenanceUnit: asset.equipment_models?.maintenance_unit,
  })
}

interface AssetGridViewProps {
  isOffline?: boolean
  offlineNotice?: React.ReactNode
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

function EmptyStateCard({
  searchQuery,
  frequencyFilter,
  assetKindFilter,
  hasActiveFilters,
  onClearFilters,
  showPlantaSetupHint,
}: {
  searchQuery: string
  frequencyFilter: string
  assetKindFilter: AssetKindFilter
  hasActiveFilters: boolean
  onClearFilters: () => void
  showPlantaSetupHint?: boolean
}) {
  let headline = "No se encontraron activos"
  let body = "Ajusta los filtros o verifica que los activos tengan checklists programados."
  let ctaLabel = "Limpiar filtros"

  if (assetKindFilter === "planta" && !searchQuery) {
    headline = "No hay activos de operaciones de planta"
    body =
      "Cada planta necesita un activo modelo PLANTA operativo. Si falta en tu planta, solicita su alta en Activos o ejecuta el script de aseguramiento."
    ctaLabel = "Ver todos los activos"
  } else if (searchQuery) {
    headline = `No hay resultados para «${searchQuery}»`
    body = "Revisa la ortografía o prueba otros términos."
    ctaLabel = "Limpiar búsqueda"
  } else if (frequencyFilter !== "all" && hasActiveFilters) {
    headline = "Ningún activo tiene esta frecuencia"
    body = "Esta frecuencia aún no está asignada a activos."
    ctaLabel = "Ver todos los activos"
  } else if (hasActiveFilters) {
    headline = "Ningún activo coincide con los filtros"
    body = "Prueba relajar uno o más filtros para ver más resultados."
  }

  return (
    <Card className="shadow-checklist-1">
      <CardContent className="py-12 text-center">
        <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{headline}</h3>
        <p className="text-sm text-muted-foreground mb-4">{body}</p>
        {showPlantaSetupHint && assetKindFilter === "planta" && (
          <p className="text-sm text-muted-foreground mb-4">
            <Link href="/activos" className="font-medium text-primary hover:underline">
              Configurar activo PLANTA
            </Link>
            {" · "}
            <Link href="/dashboard/dosificador" className="font-medium text-primary hover:underline">
              Tablero dosificador
            </Link>
          </p>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors duration-200"
          >
            {ctaLabel}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

function assetMatchesFrequency(
  frequencyFilter: string,
  pendingSchedules: PendingSchedule[]
): boolean {
  if (frequencyFilter === "all") return true
  for (const s of pendingSchedules) {
    if (frequencyFilter === "preventivo" && s.maintenance_plan_id) return true
    const freq = (s.checklists as { frequency?: string } | null)?.frequency
    if (freq === frequencyFilter) return true
  }
  return false
}

export function AssetGridView({ isOffline = false, offlineNotice }: AssetGridViewProps) {
  const { profile } = useAuthZustand()
  const searchParams = useSearchParams()
  const [assets, setAssets] = useState<AssetChecklistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearchQuery = useDebouncedValue(searchInput, 250)
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [plantFilter, setPlantFilter] = useState("all")
  const [frequencyFilter, setFrequencyFilter] = useState("all")
  const [modelFilter, setModelFilter] = useState("all")
  const [historyFilter, setHistoryFilter] = useState("all")
  const [assetKindFilter, setAssetKindFilter] = useState<AssetKindFilter>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [departments, setDepartments] = useState<string[]>([])
  const [plants, setPlants] = useState<string[]>([])
  const [models, setModels] = useState<ChecklistModel[]>([])
  const [stats, setStats] = useState<{
    total_pending?: number
    total_completed_recent?: number
  } | null>(null)
  const [dashboardMeta, setDashboardMeta] = useState<{
    planta_assets_count?: number
    can_execute_planta?: boolean
    planta_read_only?: boolean
  } | null>(null)

  const role = profile?.role ?? ""
  const isPlantOperationsActor = ["DOSIFICADOR", "JEFE_PLANTA"].includes(role)
  const isMaintenanceActor = [
    "COORDINADOR_MANTENIMIENTO",
    "GERENTE_MANTENIMIENTO",
    "ENCARGADO_MANTENIMIENTO",
    "MECANICO",
  ].includes(role)

  // Initialize from URL on mount (once)
  const urlInitialized = useRef(false)
  useEffect(() => {
    if (urlInitialized.current) return
    urlInitialized.current = true
    const freq = searchParams?.get("freq") ?? "all"
    const model = searchParams?.get("model") ?? "all"
    if (freq !== "all") setFrequencyFilter(freq)
    const kind = searchParams?.get("kind") ?? "all"
    if (kind === "planta" || kind === "units") setAssetKindFilter(kind)
  }, [searchParams])

  // Sync filters to URL (avoid router.replace for filter-only changes)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (frequencyFilter !== "all") params.set("freq", frequencyFilter)
    else params.delete("freq")
    if (modelFilter !== "all") params.set("model", modelFilter)
    else params.delete("model")
    if (assetKindFilter !== "all") params.set("kind", assetKindFilter)
    else params.delete("kind")
    const qs = params.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, "", newUrl)
  }, [frequencyFilter, modelFilter, assetKindFilter])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/checklists/assets-dashboard")
        if (response.ok) {
          const result = await response.json()
          const { assets: assetSummaries, departments: depts, plants: plts, models: mdl, stats: st, meta } =
            result.data
          setAssets(assetSummaries ?? [])
          setDepartments(depts ?? [])
          setPlants(plts ?? [])
          setModels(mdl ?? [])
          setStats(st ?? null)
          setDashboardMeta(meta ?? null)
        }
      } catch {
        setAssets([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const sevenDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.getTime()
  }, [])

  function assetMatchesHistory(
    historyFilter: string,
    lastChecklistDate: string | null,
    hasEverCompleted: boolean
  ): boolean {
    if (historyFilter === "all") return true
    if (historyFilter === "recently_completed") {
      if (!lastChecklistDate) return false
      return new Date(lastChecklistDate).getTime() >= sevenDaysAgo
    }
    if (historyFilter === "no_activity_30d") {
      return lastChecklistDate === null
    }
    if (historyFilter === "has_never") {
      return !hasEverCompleted
    }
    return true
  }

  const filteredAssets = useMemo(() => {
    return assets.filter(({ asset, pending_schedules }) => {
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase()
        const plantName = asset.plants?.name || asset.location || ""
        const modelName = asset.equipment_models?.name || asset.name || ""
        if (
          !asset.asset_id.toLowerCase().includes(q) &&
          !modelName.toLowerCase().includes(q) &&
          !String(plantName).toLowerCase().includes(q)
        ) {
          return false
        }
      }
      if (statusFilter !== "all" && statusFilter !== asset.checklist_status) return false
      if (departmentFilter !== "all") {
        const dept = asset.departments?.name || asset.department || "Sin departamento"
        if (dept !== departmentFilter) return false
      }
      if (plantFilter !== "all") {
        const plant = asset.plants?.name || asset.location || "Sin planta"
        if (plant !== plantFilter) return false
      }
      if (frequencyFilter !== "all" && !assetMatchesFrequency(frequencyFilter, pending_schedules)) {
        return false
      }
      if (modelFilter !== "all") {
        const modelId = asset.equipment_models?.id
        if (modelId !== modelFilter) return false
      }
      if (historyFilter !== "all") {
        const hasEver = (asset as { has_ever_completed_checklist?: boolean }).has_ever_completed_checklist ?? false
        if (!assetMatchesHistory(historyFilter, asset.last_checklist_date, hasEver)) return false
      }
      if (assetKindFilter === "planta" && !isPlantaSummaryAsset(asset)) return false
      if (assetKindFilter === "units" && isPlantaSummaryAsset(asset)) return false
      return true
    })
  }, [
    assets,
    debouncedSearchQuery,
    statusFilter,
    departmentFilter,
    plantFilter,
    frequencyFilter,
    modelFilter,
    historyFilter,
    assetKindFilter,
    sevenDaysAgo,
  ])

  const { plantaAssets, unitAssets } = useMemo(() => {
    const planta: AssetChecklistSummary[] = []
    const units: AssetChecklistSummary[] = []
    for (const row of filteredAssets) {
      if (isPlantaSummaryAsset(row.asset)) planta.push(row)
      else units.push(row)
    }
    return { plantaAssets: planta, unitAssets: units }
  }, [filteredAssets])

  const showPlantaSection =
    plantaAssets.length > 0 &&
    (isPlantOperationsActor || assetKindFilter === "planta" || assetKindFilter === "all")
  const showUnitSection =
    unitAssets.length > 0 && (assetKindFilter === "all" || assetKindFilter === "units")

  const clearAllFilters = useCallback(() => {
    setSearchInput("")
    setStatusFilter("all")
    setDepartmentFilter("all")
    setPlantFilter("all")
    setFrequencyFilter("all")
    setModelFilter("all")
    setHistoryFilter("all")
    setAssetKindFilter("all")
  }, [])

  const statusCounts = useMemo(
    () =>
      filteredAssets.reduce(
        (acc, { asset }) => {
          acc[asset.checklist_status] = (acc[asset.checklist_status] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
    [filteredAssets]
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString("es", { day: "numeric", month: "short" })
  }

  const hasActiveFilters =
    debouncedSearchQuery !== "" ||
    statusFilter !== "all" ||
    departmentFilter !== "all" ||
    plantFilter !== "all" ||
    frequencyFilter !== "all" ||
    modelFilter !== "all" ||
    historyFilter !== "all" ||
    assetKindFilter !== "all"

  const renderAssetCollection = (rows: AssetChecklistSummary[]) => {
    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map(({ asset }) => (
            <AssetChecklistCard key={asset.id} asset={asset} formatDate={formatDate} />
          ))}
        </div>
      )
    }
    return (
      <Card className="shadow-checklist-1 overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y">
            {rows.map(({ asset }) => (
              <AssetChecklistListRow key={asset.id} asset={asset} formatDate={formatDate} />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse shadow-checklist-1">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2 mb-4" />
              <div className="h-6 bg-muted rounded w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isOffline && offlineNotice}

      {/* Filters first — user intent: find and filter */}
      <Card className="shadow-checklist-1">
        <CardContent className="p-4 sm:p-5">
          <AssetFilters
            searchQuery={searchInput}
            onSearchChange={setSearchInput}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            plantFilter={plantFilter}
            onPlantFilterChange={setPlantFilter}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            frequencyFilter={frequencyFilter}
            onFrequencyFilterChange={setFrequencyFilter}
            modelFilter={modelFilter}
            onModelFilterChange={setModelFilter}
            historyFilter={historyFilter}
            onHistoryFilterChange={setHistoryFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            plants={plants}
            departments={departments}
            models={models}
            resultCount={filteredAssets.length}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearAllFilters}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground mr-1">Tipo:</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de activo">
              {ASSET_KIND_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAssetKindFilter(value)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer min-h-[36px] ${
                    assetKindFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {value === "planta" && <Factory className="h-3.5 w-3.5 mr-1.5" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {(dashboardMeta?.planta_read_only || (isMaintenanceActor && (dashboardMeta?.planta_assets_count ?? 0) === 0)) && (
        <Card className="border-sky-200/70 bg-sky-50/60 shadow-none dark:border-sky-900 dark:bg-sky-950/20">
          <CardContent className="flex gap-3 p-4 text-sm text-sky-900 dark:text-sky-100">
            <Info className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {dashboardMeta?.planta_read_only ? (
                <p>
                  Los activos de <strong>operaciones de planta</strong> son de solo lectura para tu rol.
                  La ejecución corresponde a Dosificador o Jefe de Planta.
                </p>
              ) : (
                <p>
                  Los checklists de operaciones de planta están en el{" "}
                  <Link href="/dashboard/dosificador" className="font-medium underline underline-offset-2">
                    tablero dosificador
                  </Link>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact stats bar — quick 3-second scan */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-muted-foreground">Resumen:</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" aria-hidden />
          <span>{statusCounts.overdue || 0} atrasados</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" aria-hidden />
          <span>{statusCounts.due_soon || 0} próximos</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" aria-hidden />
          <span>{statusCounts.ok || 0} al día</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-400" aria-hidden />
          <span>{statusCounts.no_schedule || 0} sin programar</span>
        </span>
      </div>

      {/* Asset list */}
      {showPlantaSection && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            <h3 className="text-sm font-semibold text-foreground">Operaciones de planta</h3>
            <span className="text-xs text-muted-foreground">({plantaAssets.length})</span>
          </div>
          {renderAssetCollection(plantaAssets)}
        </section>
      )}

      {showUnitSection && (
        <section className="space-y-3">
          {showPlantaSection && assetKindFilter === "all" && (
            <h3 className="text-sm font-semibold text-foreground">Unidades y equipos</h3>
          )}
          {renderAssetCollection(unitAssets)}
        </section>
      )}

      {!showPlantaSection && !showUnitSection && filteredAssets.length > 0 && (
        renderAssetCollection(filteredAssets)
      )}

      {filteredAssets.length === 0 && (
        <EmptyStateCard
          searchQuery={debouncedSearchQuery}
          frequencyFilter={frequencyFilter}
          assetKindFilter={assetKindFilter}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearAllFilters}
          showPlantaSetupHint={isPlantOperationsActor || role === "GERENCIA_GENERAL"}
        />
      )}
    </div>
  )
}
