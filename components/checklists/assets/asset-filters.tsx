"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Grid3X3, List, X } from "lucide-react"
import type { ChecklistModel } from "../dashboard/asset-grid-view"

type ViewMode = "grid" | "list"

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
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  plants: string[]
  departments: string[]
  models: ChecklistModel[]
  resultCount?: number
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}

export function AssetFilters({
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
  viewMode,
  onViewModeChange,
  plants,
  departments,
  models,
  resultCount,
  hasActiveFilters,
  onClearFilters,
}: AssetFiltersProps) {
  const statusLabels: Record<string, string> = {
    all: "Todos los estados",
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID económico, modelo o ubicación"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-36 min-h-[44px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="overdue">Atrasados</SelectItem>
              <SelectItem value="due_soon">Próximos</SelectItem>
              <SelectItem value="ok">Al día</SelectItem>
              <SelectItem value="no_schedule">Sin programar</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plantFilter} onValueChange={onPlantFilterChange}>
            <SelectTrigger className="w-36 min-h-[44px]">
              <SelectValue placeholder="Planta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plants.map((plant) => (
                <SelectItem key={plant} value={plant}>
                  {plant}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
            <SelectTrigger className="w-36 min-h-[44px]">
              <SelectValue placeholder="Departamento" />
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
          <Select value={frequencyFilter} onValueChange={onFrequencyFilterChange}>
            <SelectTrigger className="w-36 min-h-[44px]">
              <SelectValue placeholder="Frecuencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="diario">Diario</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensual">Mensual</SelectItem>
              <SelectItem value="preventivo">Preventivo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={modelFilter} onValueChange={onModelFilterChange}>
            <SelectTrigger className="w-40 min-h-[44px]">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los modelos</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("grid")}
              className="rounded-r-none min-h-[44px] min-w-[44px] p-0 cursor-pointer"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("list")}
              className="rounded-l-none min-h-[44px] min-w-[44px] p-0 cursor-pointer"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {(resultCount !== undefined || hasActiveFilters) && (
        <div className="flex flex-wrap items-center gap-2">
          {resultCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {resultCount} {resultCount === 1 ? "activo" : "activos"}
            </span>
          )}
          {hasActiveFilters && onClearFilters && (
            <>
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Buscar: {searchQuery}
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="ml-1 rounded-full hover:bg-muted p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary">
                  Estado: {statusLabels[statusFilter] ?? statusFilter}
                </Badge>
              )}
              {frequencyFilter !== "all" && (
                <Badge variant="secondary">
                  Frecuencia: {frequencyLabels[frequencyFilter] ?? frequencyFilter}
                </Badge>
              )}
              {modelFilter !== "all" && (
                <Badge variant="secondary">
                  Modelo: {models.find((m) => m.id === modelFilter)?.name ?? modelFilter}
                </Badge>
              )}
              <button
                type="button"
                onClick={onClearFilters}
                className="text-sm font-medium text-primary hover:underline cursor-pointer transition-colors duration-200"
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
