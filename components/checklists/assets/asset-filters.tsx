"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Search, Grid3X3, List, X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChecklistModel } from "../dashboard/asset-grid-view"

type ViewMode = "grid" | "list"

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "overdue", label: "Atrasados" },
  { value: "due_soon", label: "Próximos" },
  { value: "ok", label: "Al día" },
  { value: "no_schedule", label: "Sin programar" },
] as const

interface AssetFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  plantFilter: string
  onPlantFilterChange: (value: string) => void
  departmentFilter: string
  onDepartmentFilterChange: (value: string) => void
  frequencyFilter: string
  onFrequencyFilterChange: (value: string) => void
  modelFilter: string
  onModelFilterChange: (value: string) => void
  historyFilter: string
  onHistoryFilterChange: (value: string) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  plants: string[]
  departments: string[]
  models: ChecklistModel[]
  resultCount?: number
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}

function SecondaryFiltersContent({
  plantFilter,
  onPlantFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  frequencyFilter,
  onFrequencyFilterChange,
  modelFilter,
  onModelFilterChange,
  historyFilter,
  onHistoryFilterChange,
  plants,
  departments,
  models,
  hasActiveFilters,
  onClearFilters,
  compact = false,
}: Pick<
  AssetFiltersProps,
  | "plantFilter"
  | "onPlantFilterChange"
  | "departmentFilter"
  | "onDepartmentFilterChange"
  | "frequencyFilter"
  | "onFrequencyFilterChange"
  | "modelFilter"
  | "onModelFilterChange"
  | "historyFilter"
  | "onHistoryFilterChange"
  | "plants"
  | "departments"
  | "models"
  | "hasActiveFilters"
  | "onClearFilters"
> & { compact?: boolean }) {
  const filterGroup = "flex flex-col gap-1"
  const triggerClass = compact ? "w-full min-h-[44px] h-11" : "min-w-[140px] min-h-[40px] h-10"

  return (
    <div className={cn("space-y-4", compact && "py-2")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ubicación
          </p>
          <div className="flex flex-wrap gap-3">
            <div className={filterGroup}>
              <label htmlFor="filter-plant" className="text-xs font-medium text-muted-foreground">
                Planta
              </label>
              <Select value={plantFilter} onValueChange={onPlantFilterChange}>
                <SelectTrigger id="filter-plant" className={triggerClass}>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {plants.map((plant) => (
                    <SelectItem key={plant} value={plant}>
                      {plant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={filterGroup}>
              <label htmlFor="filter-dept" className="text-xs font-medium text-muted-foreground">
                Departamento
              </label>
              <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
                <SelectTrigger id="filter-dept" className={triggerClass}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tipo y historial
          </p>
          <div className="flex flex-wrap gap-3">
            <div className={filterGroup}>
              <label htmlFor="filter-freq" className="text-xs font-medium text-muted-foreground">
                Frecuencia
              </label>
              <Select value={frequencyFilter} onValueChange={onFrequencyFilterChange}>
                <SelectTrigger id="filter-freq" className={triggerClass}>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="diario">Diario</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="preventivo">Preventivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={filterGroup}>
              <label htmlFor="filter-model" className="text-xs font-medium text-muted-foreground">
                Modelo
              </label>
              <Select value={modelFilter} onValueChange={onModelFilterChange}>
                <SelectTrigger id="filter-model" className={cn(triggerClass, "min-w-[180px]")}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className={filterGroup}>
              <label htmlFor="filter-history" className="text-xs font-medium text-muted-foreground">
                Historial
              </label>
              <Select value={historyFilter} onValueChange={onHistoryFilterChange}>
                <SelectTrigger id="filter-history" className={triggerClass}>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="recently_completed">Últimos 7 días</SelectItem>
                  <SelectItem value="no_activity_30d">Sin actividad 30d</SelectItem>
                  <SelectItem value="has_never">Nunca ejecutado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      {hasActiveFilters && onClearFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="w-full sm:w-auto cursor-pointer"
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

export function AssetFilters(props: AssetFiltersProps) {
  const {
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    plantFilter,
    onPlantFilterChange,
    departmentFilter,
    onDepartmentFilterChange,
    frequencyFilter,
    onFrequencyFilterChange,
    modelFilter,
    onModelFilterChange,
    historyFilter,
    onHistoryFilterChange,
    viewMode,
    onViewModeChange,
    plants,
    departments,
    models,
    resultCount,
    hasActiveFilters,
    onClearFilters,
  } = props

  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const statusLabels: Record<string, string> = {
    all: "Todos",
    overdue: "Atrasados",
    due_soon: "Próximos",
    ok: "Al día",
    no_schedule: "Sin programar",
  }
  const frequencyLabels: Record<string, string> = {
    all: "Todas",
    diario: "Diario",
    semanal: "Semanal",
    mensual: "Mensual",
    preventivo: "Preventivo",
  }
  const historyLabels: Record<string, string> = {
    all: "Todos",
    recently_completed: "Últimos 7 días",
    no_activity_30d: "Sin actividad 30d",
    has_never: "Nunca ejecutado",
  }

  const activeFilterCount =
    (plantFilter !== "all" ? 1 : 0) +
    (departmentFilter !== "all" ? 1 : 0) +
    (frequencyFilter !== "all" ? 1 : 0) +
    (modelFilter !== "all" ? 1 : 0) +
    (historyFilter !== "all" ? 1 : 0)

  return (
    <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
    <div className="space-y-3">
      {/* Row 1: Search + count + view + collapse toggle (always visible) */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 min-w-0">
          <label className="sr-only" htmlFor="asset-search">
            Buscar activos
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              id="asset-search"
              placeholder="Buscar por ID económico, modelo o ubicación"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 min-h-[40px] h-10 w-full"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {resultCount !== undefined && (
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {resultCount} {resultCount === 1 ? "activo" : "activos"}
            </span>
          )}
          <div className="flex border rounded-md overflow-hidden" role="group" aria-label="Vista">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("grid")}
              className="rounded-r-none min-h-[40px] min-w-[40px] p-0 cursor-pointer"
              title="Vista en cuadrícula"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("list")}
              className="rounded-l-none min-h-[40px] min-w-[40px] p-0 cursor-pointer"
              title="Vista en lista"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <CollapsibleTrigger asChild>
            <Button
                variant="outline"
                size="sm"
                className="gap-1.5 min-h-[40px] cursor-pointer shrink-0"
                aria-expanded={filtersOpen}
                aria-label={filtersOpen ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
              >
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Más filtros
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </CollapsibleTrigger>
        </div>
      </div>

      {/* Row 2: Estado chips (always visible, compact) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Estado:</span>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar por estado pendiente"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onStatusFilterChange(value)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer min-h-[36px]",
                statusFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 3: Collapsible secondary filters */}
      <CollapsibleContent>
        <div className="flex flex-col gap-3 pt-3 border-t">
            {/* Desktop: secondary filters inline */}
                <div className="hidden lg:block">
                  <SecondaryFiltersContent
                    plantFilter={plantFilter}
                    onPlantFilterChange={onPlantFilterChange}
                    departmentFilter={departmentFilter}
                    onDepartmentFilterChange={onDepartmentFilterChange}
                    frequencyFilter={frequencyFilter}
                    onFrequencyFilterChange={onFrequencyFilterChange}
                    modelFilter={modelFilter}
                    onModelFilterChange={onModelFilterChange}
                    historyFilter={historyFilter}
                    onHistoryFilterChange={onHistoryFilterChange}
                    plants={plants}
                    departments={departments}
                    models={models}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={onClearFilters}
                    compact={false}
                  />
                </div>

                {/* Mobile/Tablet: filters in sheet */}
                <div className="lg:hidden flex items-center gap-2">
                  <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 min-h-[40px] cursor-pointer"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        Más filtros
                        {activeFilterCount > 0 && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                            {activeFilterCount}
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle>Filtros</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4">
                        <SecondaryFiltersContent
                          plantFilter={plantFilter}
                          onPlantFilterChange={onPlantFilterChange}
                          departmentFilter={departmentFilter}
                          onDepartmentFilterChange={onDepartmentFilterChange}
                          frequencyFilter={frequencyFilter}
                          onFrequencyFilterChange={onFrequencyFilterChange}
                          modelFilter={modelFilter}
                          onModelFilterChange={onModelFilterChange}
                          historyFilter={historyFilter}
                          onHistoryFilterChange={onHistoryFilterChange}
                          plants={plants}
                          departments={departments}
                          models={models}
                          hasActiveFilters={hasActiveFilters}
                          onClearFilters={() => {
                            onClearFilters?.()
                            setFilterSheetOpen(false)
                          }}
                          compact={true}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters &&
                  (searchQuery ||
                    statusFilter !== "all" ||
                    departmentFilter !== "all" ||
                    plantFilter !== "all" ||
                    frequencyFilter !== "all" ||
                    modelFilter !== "all" ||
                    historyFilter !== "all") && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs">
                          Buscar: {searchQuery}
                          <button
                            type="button"
                            onClick={() => onSearchChange("")}
                            className="rounded p-0.5 hover:bg-background/80 cursor-pointer transition-colors"
                            aria-label="Quitar búsqueda"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {statusFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Estado: {statusLabels[statusFilter]}
                        </span>
                      )}
                      {plantFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Planta: {plantFilter}
                        </span>
                      )}
                      {departmentFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Depto: {departmentFilter}
                        </span>
                      )}
                      {frequencyFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Frecuencia: {frequencyLabels[frequencyFilter]}
                        </span>
                      )}
                      {modelFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Modelo: {models.find((m) => m.id === modelFilter)?.name ?? "—"}
                        </span>
                      )}
                      {historyFilter !== "all" && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs">
                          Historial: {historyLabels[historyFilter]}
                        </span>
                      )}
                    </div>
                  )}
        </div>
      </CollapsibleContent>
    </div>
    </Collapsible>
  )
}
