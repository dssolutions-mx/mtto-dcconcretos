"use client"

import { Button } from "@/components/ui/button"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  DATE_PRESET_LABELS,
  type IncidentDatePreset,
} from "@/lib/incidents/incident-date-filter"
import type { IncidentesPageFilters, ThreadDateMode } from "@/lib/incidents/incident-list-filters"
import { Calendar as CalendarIcon } from "lucide-react"

const PRESET_SEGMENTS: IncidentDatePreset[] = [
  "all",
  "this_week",
  "this_month",
  "june_2026_inspection",
  "custom",
]

type IncidentsPeriodBarProps = {
  filters: IncidentesPageFilters
  onFiltersChange: (patch: Partial<IncidentesPageFilters>) => void
}

export function IncidentsPeriodBar({ filters, onFiltersChange }: IncidentsPeriodBarProps) {
  const setPreset = (preset: IncidentDatePreset) => {
    if (preset === "june_2026_inspection") {
      onFiltersChange({
        datePreset: preset,
        cohortId: "june_2026_inspection",
        fromDate: undefined,
        toDate: undefined,
      })
      return
    }
    if (preset === "all") {
      onFiltersChange({
        datePreset: "all",
        cohortId: null,
        fromDate: undefined,
        toDate: undefined,
      })
      return
    }
    onFiltersChange({
      datePreset: preset,
      cohortId: null,
      ...(preset !== "custom" ? { fromDate: undefined, toDate: undefined } : {}),
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Periodo
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Muestra hilos con al menos una observación en el rango (reapariciones incluidas).
          </p>
        </div>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Periodo">
          {PRESET_SEGMENTS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={filters.datePreset === preset ? "default" : "outline"}
              className="h-8 text-xs cursor-pointer"
              onClick={() => setPreset(preset)}
            >
              {DATE_PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>
      </div>

      {filters.datePreset === "custom" && (
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Desde:{" "}
                {filters.fromDate
                  ? filters.fromDate.toLocaleDateString("es-MX")
                  : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={filters.fromDate}
                onSelect={(d) => onFiltersChange({ fromDate: d, datePreset: "custom" })}
              />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Hasta:{" "}
                {filters.toDate ? filters.toDate.toLocaleDateString("es-MX") : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={filters.toDate}
                onSelect={(d) => onFiltersChange({ toDate: d, datePreset: "custom" })}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {filters.datePreset !== "all" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Vista del hilo:</span>
          {(
            [
              ["thread_in_period", "Hilo completo"],
              ["occurrences_only", "Solo observaciones del periodo"],
            ] as [ThreadDateMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={cn(
                "rounded-md border px-2 py-1 transition-colors cursor-pointer",
                filters.threadDateMode === mode
                  ? "border-primary bg-primary/10 text-foreground font-medium"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              onClick={() => onFiltersChange({ threadDateMode: mode })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
