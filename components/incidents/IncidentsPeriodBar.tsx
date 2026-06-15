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
  type IncidentDateField,
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
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Periodo
        </span>
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Fecha:</span>
        {(["event", "registered"] as IncidentDateField[]).map((field) => (
          <button
            key={field}
            type="button"
            className={cn(
              "rounded-md border px-2 py-1 transition-colors cursor-pointer",
              filters.dateField === field
                ? "border-primary bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onFiltersChange({ dateField: field })}
          >
            {field === "event" ? "Fecha del hecho" : "Fecha de registro"}
          </button>
        ))}

        {filters.datePreset !== "all" && (
          <>
            <span className="text-muted-foreground ml-2">Hilos:</span>
            {(
              [
                ["thread_in_period", "Incluir historial"],
                ["occurrences_only", "Solo en periodo"],
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
          </>
        )}
      </div>
    </div>
  )
}
