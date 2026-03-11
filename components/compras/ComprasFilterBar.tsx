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
import { Search, Filter, X, Calendar as CalendarIcon, Building2, Package, Store } from "lucide-react"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

export interface AssetOption {
  id: string
  label: string
}

export interface PlantOption {
  id: string
  label: string
}

export interface OrderTypeOption {
  id: string
  label: string
}

interface ComprasFilterBarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedAssetId: string
  onAssetChange: (value: string) => void
  assetOptions: AssetOption[]
  selectedPlantId: string
  onPlantChange: (value: string) => void
  plantOptions: PlantOption[]
  selectedOrderType: string
  onOrderTypeChange: (value: string) => void
  orderTypeOptions: OrderTypeOption[]
  selectedSupplier: string
  onSupplierChange: (value: string) => void
  supplierOptions: string[]
  fromDate: Date | undefined
  toDate: Date | undefined
  onFromDateChange: (date: Date | undefined) => void
  onToDateChange: (date: Date | undefined) => void
}

export function ComprasFilterBar({
  searchTerm,
  onSearchChange,
  selectedAssetId,
  onAssetChange,
  assetOptions,
  selectedPlantId,
  onPlantChange,
  plantOptions,
  selectedOrderType,
  onOrderTypeChange,
  orderTypeOptions,
  selectedSupplier,
  onSupplierChange,
  supplierOptions,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: ComprasFilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isMobile = useIsMobile()
  const hasActiveFilters =
    selectedAssetId ||
    selectedPlantId ||
    selectedOrderType ||
    selectedSupplier ||
    fromDate ||
    toDate

  const popoverOnlyCount = [selectedSupplier].filter(Boolean).length
  const activeFilterCount = [
    selectedAssetId,
    selectedPlantId,
    selectedOrderType,
    selectedSupplier,
    fromDate || toDate,
  ].filter(Boolean).length

  const clearAllFilters = () => {
    onAssetChange("")
    onPlantChange("")
    onOrderTypeChange("")
    onSupplierChange("")
    onFromDateChange(undefined)
    onToDateChange(undefined)
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
              placeholder="Buscar por OC, proveedor, OT..."
              className="pl-8 min-w-0 cursor-text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Buscar órdenes de compra"
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
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 rounded-full bg-sky-200 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[85vh] overflow-y-auto p-4" align="start">
              <MobileFiltersContent
                plantOptions={plantOptions}
                selectedPlantId={selectedPlantId}
                onPlantChange={onPlantChange}
                assetOptions={assetOptions}
                selectedAssetId={selectedAssetId}
                onAssetChange={onAssetChange}
                orderTypeOptions={orderTypeOptions}
                selectedOrderType={selectedOrderType}
                onOrderTypeChange={onOrderTypeChange}
                supplierOptions={supplierOptions}
                selectedSupplier={selectedSupplier}
                onSupplierChange={onSupplierChange}
                fromDate={fromDate}
                toDate={toDate}
                onFromDateChange={onFromDateChange}
                onToDateChange={onToDateChange}
                hasActiveFilters={hasActiveFilters}
                clearAllFilters={clearAllFilters}
              />
            </PopoverContent>
          </Popover>
        </div>
        {hasActiveFilters && <FilterChipsSection {...{ selectedPlantId, plantOptions, onPlantChange, selectedAssetId, assetOptions, onAssetChange, selectedOrderType, orderTypeOptions, onOrderTypeChange, selectedSupplier, onSupplierChange, fromDate, toDate, onFromDateChange, onToDateChange }} />}
      </div>
    )
  }

  // Desktop: inline Search + Planta + Activo + Tipo + Fechas; Proveedor in Filtros popover
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            inputMode="search"
            placeholder="Buscar por OC, proveedor, OT..."
            className="pl-8 min-w-0 cursor-text h-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar órdenes de compra"
          />
        </div>
        {plantOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Planta</span>
            <Select value={selectedPlantId || "all"} onValueChange={(v) => onPlantChange(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[130px] h-9 cursor-pointer" aria-label="Filtrar por planta">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {plantOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Activo</span>
          <Select value={selectedAssetId || "all"} onValueChange={(v) => onAssetChange(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[150px] h-9 cursor-pointer" aria-label="Filtrar por activo">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {assetOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Tipo</span>
          <Select value={selectedOrderType || "all"} onValueChange={(v) => onOrderTypeChange(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px] h-9 cursor-pointer" aria-label="Filtrar por tipo de orden">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {orderTypeOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground shrink-0 w-12">Fechas</span>
          <div className="flex gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[90px] justify-start gap-1.5 cursor-pointer">
                <CalendarIcon className="h-3.5 w-3.5" />
                {fromDate ? fromDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={fromDate} onSelect={onFromDateChange} initialFocus />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 min-w-[90px] justify-start gap-1.5 cursor-pointer">
                <CalendarIcon className="h-3.5 w-3.5" />
                {toDate ? toDate.toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={toDate} onSelect={onToDateChange} initialFocus />
            </PopoverContent>
          </Popover>
          </div>
        </div>
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 cursor-pointer transition-colors duration-200",
                popoverOnlyCount > 0 && "border-sky-300 bg-sky-50 text-sky-800"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {popoverOnlyCount > 0 && (
                <span className="rounded-full bg-sky-200 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                  {popoverOnlyCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="text-sm font-medium text-slate-700">Filtros adicionales</div>
              {supplierOptions.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                  <Select value={selectedSupplier || "all"} onValueChange={(v) => onSupplierChange(v === "all" ? "" : v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {supplierOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="w-full cursor-pointer" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpiar todo
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasActiveFilters && (
        <FilterChipsSection
          selectedPlantId={selectedPlantId}
          plantOptions={plantOptions}
          onPlantChange={onPlantChange}
          selectedAssetId={selectedAssetId}
          assetOptions={assetOptions}
          onAssetChange={onAssetChange}
          selectedOrderType={selectedOrderType}
          orderTypeOptions={orderTypeOptions}
          onOrderTypeChange={onOrderTypeChange}
          selectedSupplier={selectedSupplier}
          onSupplierChange={onSupplierChange}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={onFromDateChange}
          onToDateChange={onToDateChange}
        />
      )}
    </div>
  )
}

function MobileFiltersContent({
  plantOptions,
  selectedPlantId,
  onPlantChange,
  assetOptions,
  selectedAssetId,
  onAssetChange,
  orderTypeOptions,
  selectedOrderType,
  onOrderTypeChange,
  supplierOptions,
  selectedSupplier,
  onSupplierChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  hasActiveFilters,
  clearAllFilters,
}: {
  plantOptions: PlantOption[]
  selectedPlantId: string
  onPlantChange: (v: string) => void
  assetOptions: AssetOption[]
  selectedAssetId: string
  onAssetChange: (v: string) => void
  orderTypeOptions: OrderTypeOption[]
  selectedOrderType: string
  onOrderTypeChange: (v: string) => void
  supplierOptions: string[]
  selectedSupplier: string
  onSupplierChange: (v: string) => void
  fromDate: Date | undefined
  toDate: Date | undefined
  onFromDateChange: (date: Date | undefined) => void
  onToDateChange: (date: Date | undefined) => void
  hasActiveFilters: boolean
  clearAllFilters: () => void
}) {
  return (
    <div className="space-y-4">
      {plantOptions.length > 0 && (
        <div>
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Planta
          </label>
          <Select value={selectedPlantId || "all"} onValueChange={(v) => onPlantChange(v === "all" ? "" : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Todas las plantas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plantOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Package className="h-4 w-4" /> Activo
        </label>
        <Select value={selectedAssetId || "all"} onValueChange={(v) => onAssetChange(v === "all" ? "" : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Todos los activos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los activos</SelectItem>
            {assetOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Store className="h-4 w-4" /> Tipo de orden
        </label>
        <Select value={selectedOrderType || "all"} onValueChange={(v) => onOrderTypeChange(v === "all" ? "" : v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {orderTypeOptions.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {supplierOptions.length > 0 && (
        <div>
          <label className="text-sm font-medium text-slate-700">Proveedor</label>
          <Select value={selectedSupplier || "all"} onValueChange={(v) => onSupplierChange(v === "all" ? "" : v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Todos los proveedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {supplierOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <CalendarIcon className="h-4 w-4" /> Rango de fechas
        </label>
        <div className="mt-1 flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-start gap-2 cursor-pointer">
                <CalendarIcon className="h-4 w-4" />
                {fromDate ? fromDate.toLocaleDateString("es-MX") : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={fromDate} onSelect={onFromDateChange} initialFocus />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 justify-start gap-2 cursor-pointer">
                <CalendarIcon className="h-4 w-4" />
                {toDate ? toDate.toLocaleDateString("es-MX") : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker mode="single" selected={toDate} onSelect={onToDateChange} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="w-full cursor-pointer" onClick={clearAllFilters}>
          <X className="h-4 w-4 mr-2" /> Limpiar filtros
        </Button>
      )}
    </div>
  )
}

function FilterChipsSection({
  selectedPlantId,
  plantOptions,
  onPlantChange,
  selectedAssetId,
  assetOptions,
  onAssetChange,
  selectedOrderType,
  orderTypeOptions,
  onOrderTypeChange,
  selectedSupplier,
  onSupplierChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: {
  selectedPlantId: string
  plantOptions: PlantOption[]
  onPlantChange: (v: string) => void
  selectedAssetId: string
  assetOptions: AssetOption[]
  onAssetChange: (v: string) => void
  selectedOrderType: string
  orderTypeOptions: OrderTypeOption[]
  onOrderTypeChange: (v: string) => void
  selectedSupplier: string
  onSupplierChange: (v: string) => void
  fromDate: Date | undefined
  toDate: Date | undefined
  onFromDateChange: (date: Date | undefined) => void
  onToDateChange: (date: Date | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedPlantId && (
        <FilterChip
          label={`Planta: ${plantOptions.find((p) => p.id === selectedPlantId)?.label ?? selectedPlantId}`}
          onClear={() => onPlantChange("")}
        />
      )}
      {selectedAssetId && (
        <FilterChip
          label={`Activo: ${assetOptions.find((a) => a.id === selectedAssetId)?.label ?? selectedAssetId}`}
          onClear={() => onAssetChange("")}
        />
      )}
      {selectedOrderType && (
        <FilterChip
          label={`Tipo: ${orderTypeOptions.find((o) => o.id === selectedOrderType)?.label ?? selectedOrderType}`}
          onClear={() => onOrderTypeChange("")}
        />
      )}
      {selectedSupplier && (
        <FilterChip label={`Proveedor: ${selectedSupplier}`} onClear={() => onSupplierChange("")} />
      )}
      {(fromDate || toDate) && (
        <FilterChip
          label={`${fromDate?.toLocaleDateString("es-MX") ?? "—"} a ${toDate?.toLocaleDateString("es-MX") ?? "—"}`}
          onClear={() => { onFromDateChange(undefined); onToDateChange(undefined) }}
          ariaLabel="Quitar filtro de fechas"
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
        className="ml-0.5 rounded-full hover:bg-sky-200 p-0.5 cursor-pointer shrink-0"
        aria-label={ariaLabel}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
