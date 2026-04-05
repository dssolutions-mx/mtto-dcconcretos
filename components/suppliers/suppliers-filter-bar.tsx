"use client"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { STATUS_CONFIG, TYPE_LABELS } from "./supplier-registry-constants"

interface SuppliersFilterBarProps {
  searchTerm: string
  onSearchChange: (v: string) => void
  typeFilter: string
  onTypeFilterChange: (v: string) => void
  statusFilter: string
  onClearStatus: () => void
  onClearSearch: () => void
  onClearAll: () => void
}

export function SuppliersFilterBar({
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onClearStatus,
  onClearSearch,
  onClearAll,
}: SuppliersFilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, RFC o contacto..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-8"
            inputMode="search"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTypeFilterChange(key)}
            className={`
                px-3 py-1 rounded-full text-sm border transition-all
                ${typeFilter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }
              `}
          >
            {label}
          </button>
        ))}
      </div>

      {(statusFilter !== "all" || searchTerm) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>Filtros activos:</span>
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {STATUS_CONFIG[statusFilter]?.label || statusFilter}
              <X className="w-3 h-3 cursor-pointer" onClick={onClearStatus} />
            </Badge>
          )}
          {searchTerm && (
            <Badge variant="secondary" className="flex items-center gap-1">
              &quot;{searchTerm}&quot;
              <X className="w-3 h-3 cursor-pointer" onClick={onClearSearch} />
            </Badge>
          )}
          <button type="button" className="text-xs underline hover:no-underline" onClick={onClearAll}>
            Limpiar todos
          </button>
        </div>
      )}
    </div>
  )
}
