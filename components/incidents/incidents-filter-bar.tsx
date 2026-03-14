"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { getStatusInfo } from "./incidents-status-utils"

interface IncidentsFilterBarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  typeFilter: string
  onTypeChange: (value: string) => void
  priorityFilter: string
  onPriorityChange: (value: string) => void
  workOrderFilter: string
  onWorkOrderChange: (value: string) => void
  onClearAll: () => void
  activeFilterCount: number
  uniqueStatuses: string[]
  uniqueTypes: string[]
}

export function IncidentsFilterBar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  priorityFilter,
  onPriorityChange,
  workOrderFilter,
  onWorkOrderChange,
  onClearAll,
  activeFilterCount,
  uniqueStatuses,
  uniqueTypes,
}: IncidentsFilterBarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descripción, usuario o activo..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="flex-1 min-w-[120px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {uniqueStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {getStatusInfo(status).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onTypeChange}>
          <SelectTrigger className="flex-1 min-w-[120px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {uniqueTypes.map((type) => (
              <SelectItem key={type} value={type.toLowerCase()}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={onPriorityChange}>
          <SelectTrigger className="flex-1 min-w-[120px]">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Medio</SelectItem>
            <SelectItem value="low">Nuevo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={workOrderFilter} onValueChange={onWorkOrderChange}>
          <SelectTrigger className="flex-1 min-w-[140px]">
            <SelectValue placeholder="OT" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las OT</SelectItem>
            <SelectItem value="without">Sin OT</SelectItem>
            <SelectItem value="with">Con OT</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"} activo{activeFilterCount === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm font-medium text-foreground underline underline-offset-4 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
