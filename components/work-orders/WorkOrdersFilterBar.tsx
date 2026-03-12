"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Package,
  User,
} from "lucide-react"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import type { WorkOrderFilters, WorkOrderSortBy } from "@/hooks/useWorkOrderFilters"
import type { AssetOption, TechnicianOption } from "@/hooks/useWorkOrderFilters"

const ORIGIN_OPTIONS = [
  { id: "all", label: "Todos los orígenes" },
  { id: "incident", label: "Desde incidente" },
  { id: "checklist", label: "Desde checklist" },
  { id: "preventive", label: "Preventivo programado" },
  { id: "manual", label: "Manual / Ad-hoc" },
] as const

const TYPE_OPTIONS = [
  { id: "all", label: "Todos los tipos" },
  { id: "preventive", label: "Preventivo" },
  { id: "corrective", label: "Correctivo" },
] as const

const SORT_OPTIONS: { id: WorkOrderSortBy; label: string }[] = [
  { id: "default", label: "Por creación" },
  { id: "priority", label: "Por prioridad" },
]

interface WorkOrdersFilterBarProps {
  filters: WorkOrderFilters
  onFiltersChange: (patch: Partial<WorkOrderFilters>) => void
  onClearAll: () => void
  assetOptions: AssetOption[]
  technicianOptions: TechnicianOption[]
  hasActiveFilters: boolean
  activeFilterCount: number
}

export function WorkOrdersFilterBar({
  filters,
  onFiltersChange,
  onClearAll,
  assetOptions,
  technicianOptions,
  hasActiveFilters,
  activeFilterCount,
}: WorkOrdersFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isMobile = useIsMobile()

  const clearAllFilters = () => {
    onClearAll()
    setFiltersOpen(false)
  }

  // Mobile: search + Filtros popover (all filters inside)
  if (isMobile) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              inputMode="search"
              placeholder="Buscar por OT, activo, asignado..."
              className="pl-8 min-w-0 cursor-text"
              value={filters.searchTerm}
              onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
              aria-label="Buscar órdenes de trabajo"
            />
          </div>
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "gap-2 cursor-pointer transition-colors duration-200",
                  hasActiveFilters && "border-sky-300 bg-sky-50 text-sky-800"
                )}
                aria-expanded={filtersOpen}
                aria-controls="work-orders-filters-popover"
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span
                    className="ml-1 rounded-full bg-sky-200 px-1.5 py-0.5 text-xs font-medium text-sky-800"
                    aria-hidden
                  >
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              id="work-orders-filters-popover"
              className="w-96 max-h-[85vh] overflow-y-auto p-4"
              align="start"
            >
              <MobileFiltersContent
                filters={filters}
                onFiltersChange={onFiltersChange}
                assetOptions={assetOptions}
                technicianOptions={technicianOptions}
                hasActiveFilters={hasActiveFilters}
                clearAllFilters={clearAllFilters}
              />
            </PopoverContent>
          </Popover>
        </div>
        {hasActiveFilters && (
          <FilterChipsSection
            filters={filters}
            onFiltersChange={onFiltersChange}
            assetOptions={assetOptions}
            technicianOptions={technicianOptions}
          />
        )}
      </div>
    )
  }

  // Desktop: Apple HIG progressive disclosure — Search prominent, rest in Filtros popover
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            inputMode="search"
            placeholder="Buscar"
            className="pl-10 min-w-0 cursor-text h-11 text-[15px] rounded-[10px]"
            value={filters.searchTerm}
            onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
            aria-label="Buscar órdenes de trabajo"
          />
        </div>
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-11 min-w-[44px] gap-2 cursor-pointer transition-colors duration-200 rounded-[10px]",
                hasActiveFilters && "border-sky-300 bg-sky-50 text-sky-800"
              )}
              aria-expanded={filtersOpen}
              aria-controls="work-orders-filters-popover-desktop"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && activeFilterCount > 0 && (
                <span className="rounded-full bg-sky-200 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent id="work-orders-filters-popover-desktop" className="w-96 max-h-[85vh] overflow-y-auto p-4" align="end">
            <MobileFiltersContent
              filters={filters}
              onFiltersChange={onFiltersChange}
              assetOptions={assetOptions}
              technicianOptions={technicianOptions}
              hasActiveFilters={hasActiveFilters}
              clearAllFilters={clearAllFilters}
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <FilterChipsSection
          filters={filters}
          onFiltersChange={onFiltersChange}
          assetOptions={assetOptions}
          technicianOptions={technicianOptions}
        />
      )}
    </div>
  )
}

function MobileFiltersContent({
  filters,
  onFiltersChange,
  assetOptions,
  technicianOptions,
  hasActiveFilters,
  clearAllFilters,
}: {
  filters: WorkOrderFilters
  onFiltersChange: (patch: Partial<WorkOrderFilters>) => void
  assetOptions: AssetOption[]
  technicianOptions: TechnicianOption[]
  hasActiveFilters: boolean
  clearAllFilters: () => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Package className="h-4 w-4" /> Activo
        </Label>
        <Select
          value={filters.assetId || "all"}
          onValueChange={(v) =>
            onFiltersChange({ assetId: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos los activos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los activos</SelectItem>
            {assetOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <User className="h-4 w-4" /> Técnico
        </Label>
        <Select
          value={filters.technicianId || "all"}
          onValueChange={(v) =>
            onFiltersChange({ technicianId: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {technicianOptions.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Ordenar</Label>
        <Select
          value={filters.sortBy || "default"}
          onValueChange={(v) =>
            onFiltersChange({ sortBy: v === "priority" ? "priority" : "default" })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Tipo</Label>
        <Select
          value={filters.typeFilter || "all"}
          onValueChange={(v) =>
            onFiltersChange({ typeFilter: v === "all" ? "" : v })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700">Origen</Label>
        <Select
          value={filters.originFilter || "all"}
          onValueChange={(v) =>
            onFiltersChange({ originFilter: v === "all" ? "all" : v })
          }
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {ORIGIN_OPTIONS.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" /> Rango de fechas
        </Label>
        <div className="mt-1 flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2 cursor-pointer"
              >
                <CalendarIcon className="h-4 w-4" />
                {filters.fromDate
                  ? filters.fromDate.toLocaleDateString("es-ES")
                  : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={filters.fromDate}
                onSelect={(d) => onFiltersChange({ fromDate: d })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 justify-start gap-2 cursor-pointer"
              >
                <CalendarIcon className="h-4 w-4" />
                {filters.toDate
                  ? filters.toDate.toLocaleDateString("es-ES")
                  : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={filters.toDate}
                onSelect={(d) => onFiltersChange({ toDate: d })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex items-center justify-between space-x-2">
        <Label htmlFor="mobile-recurrentes-toggle" className="text-sm font-medium text-slate-700 cursor-pointer">
          Solo recurrentes
        </Label>
        <Switch
          id="mobile-recurrentes-toggle"
          checked={filters.recurrentesOnly}
          onCheckedChange={(v) => onFiltersChange({ recurrentesOnly: v })}
          className="cursor-pointer"
        />
      </div>
      <div className="flex items-center justify-between space-x-2">
        <Label htmlFor="mobile-group-toggle" className="text-sm font-medium text-slate-700 cursor-pointer">
          Agrupar por activo
        </Label>
        <Switch
          id="mobile-group-toggle"
          checked={filters.groupByAsset}
          onCheckedChange={(v) => onFiltersChange({ groupByAsset: v })}
          className="cursor-pointer"
        />
      </div>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full cursor-pointer"
          onClick={clearAllFilters}
          aria-label="Limpiar todos los filtros"
        >
          <X className="h-4 w-4 mr-2" /> Limpiar filtros
        </Button>
      )}
    </div>
  )
}

function FilterChipsSection({
  filters,
  onFiltersChange,
  assetOptions,
  technicianOptions,
}: {
  filters: WorkOrderFilters
  onFiltersChange: (patch: Partial<WorkOrderFilters>) => void
  assetOptions: AssetOption[]
  technicianOptions: TechnicianOption[]
}) {
  const assetLabel =
    filters.assetId &&
    (assetOptions.find((a) => a.id === filters.assetId)?.label ||
      filters.assetName ||
      filters.assetId)
  const techLabel =
    filters.technicianId &&
    (technicianOptions.find((t) => t.id === filters.technicianId)?.label ||
      filters.technicianId)

  return (
    <div className="flex flex-wrap items-center gap-2" role="status" aria-label={`Filtros aplicados: ${[filters.assetId, filters.technicianId, filters.typeFilter !== "all", filters.originFilter !== "all", filters.recurrentesOnly, filters.fromDate || filters.toDate, filters.groupByAsset, filters.sortBy === "priority"].filter(Boolean).length}`}>
      {assetLabel && (
        <FilterChip
          label={`Activo: ${assetLabel}`}
          onClear={() => onFiltersChange({ assetId: "", assetName: "" })}
          ariaLabel="Quitar filtro de activo"
        />
      )}
      {techLabel && (
        <FilterChip
          label={`Técnico: ${techLabel}`}
          onClear={() => onFiltersChange({ technicianId: "" })}
          ariaLabel="Quitar filtro de técnico"
        />
      )}
      {filters.typeFilter !== "all" && (
        <FilterChip
          label={`Tipo: ${TYPE_OPTIONS.find((t) => t.id === filters.typeFilter)?.label ?? filters.typeFilter}`}
          onClear={() => onFiltersChange({ typeFilter: "all" })}
          ariaLabel="Quitar filtro de tipo"
        />
      )}
      {filters.originFilter !== "all" && (
        <FilterChip
          label={`Origen: ${ORIGIN_OPTIONS.find((o) => o.id === filters.originFilter)?.label ?? filters.originFilter}`}
          onClear={() => onFiltersChange({ originFilter: "all" })}
          ariaLabel="Quitar filtro de origen"
        />
      )}
      {filters.recurrentesOnly && (
        <FilterChip
          label="Solo recurrentes"
          onClear={() => onFiltersChange({ recurrentesOnly: false })}
          ariaLabel="Quitar filtro recurrentes"
        />
      )}
      {(filters.fromDate || filters.toDate) && (
        <FilterChip
          label={`${filters.fromDate?.toLocaleDateString("es-ES") ?? "—"} a ${filters.toDate?.toLocaleDateString("es-ES") ?? "—"}`}
          onClear={() =>
            onFiltersChange({ fromDate: undefined, toDate: undefined })
          }
          ariaLabel="Quitar filtro de fechas"
        />
      )}
      {filters.groupByAsset && (
        <FilterChip
          label="Agrupar por activo"
          onClear={() => onFiltersChange({ groupByAsset: false })}
          ariaLabel="Quitar agrupación"
        />
      )}
      {filters.sortBy === "priority" && (
        <FilterChip
          label="Ordenar: Por prioridad"
          onClear={() => onFiltersChange({ sortBy: "default" })}
          ariaLabel="Quitar orden por urgencia"
        />
      )}
    </div>
  )
}

function FilterChip({
  label,
  onClear,
  ariaLabel = "Quitar filtro",
}: {
  label: string
  onClear: () => void
  ariaLabel?: string
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
      <span className="truncate max-w-[180px]">{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 rounded-full hover:bg-sky-200 p-0.5 cursor-pointer shrink-0 transition-colors duration-200"
        aria-label={ariaLabel}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
