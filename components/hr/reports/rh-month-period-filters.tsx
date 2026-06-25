'use client'

import { Label } from '@/components/ui/label'
import { SearchableCombobox, type ComboboxOption } from '@/components/checklists/scheduling/searchable-combobox'
import { MONTH_OPTIONS } from '@/components/hr/bonus-decision-hub/bonus-hub-shared'
import { cn } from '@/lib/utils'
import type { RhOrgBusinessUnit, RhOrgPlant } from './use-rh-org-filters'

type RhMonthPeriodFiltersProps = {
  businessUnit: string
  plant: string
  year: number
  month: number
  businessUnits: RhOrgBusinessUnit[]
  plants: RhOrgPlant[]
  orgLoading?: boolean
  onBusinessUnitChange: (value: string) => void
  onPlantChange: (value: string) => void
  onYearChange: (value: number) => void
  onMonthChange: (value: number) => void
  className?: string
}

export function RhMonthPeriodFilters({
  businessUnit,
  plant,
  year,
  month,
  businessUnits,
  plants,
  orgLoading = false,
  onBusinessUnitChange,
  onPlantChange,
  onYearChange,
  onMonthChange,
  className,
}: RhMonthPeriodFiltersProps) {
  const yearOptions: ComboboxOption[] = Array.from({ length: 5 }, (_, i) => {
    const y = year - 2 + i
    return { value: String(y), label: String(y) }
  })

  const monthOptions: ComboboxOption[] = MONTH_OPTIONS.map((m) => ({
    value: String(m.value),
    label: m.label,
  }))

  const buOptions: ComboboxOption[] = [
    { value: 'all', label: 'Todas las unidades' },
    ...businessUnits.map((bu) => ({
      value: bu.id,
      label: bu.name,
    })),
  ]

  const plantOptions: ComboboxOption[] = [
    { value: 'all', label: 'Todas las plantas' },
    ...plants.map((p) => ({
      value: p.id,
      label: p.name,
    })),
  ]

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-5',
        className
      )}
    >
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Filtros
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Unidad de negocio</Label>
          <SearchableCombobox
            value={businessUnit}
            onValueChange={onBusinessUnitChange}
            options={buOptions}
            placeholder="Todas las unidades"
            searchPlaceholder="Buscar unidad…"
            loading={orgLoading}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Planta</Label>
          <SearchableCombobox
            value={plant}
            onValueChange={onPlantChange}
            options={plantOptions}
            placeholder="Todas las plantas"
            searchPlaceholder="Buscar planta…"
            loading={orgLoading}
            disabled={orgLoading}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Año</Label>
          <SearchableCombobox
            value={String(year)}
            onValueChange={(v) => onYearChange(parseInt(v, 10))}
            options={yearOptions}
            placeholder="Año"
            searchPlaceholder="Buscar año…"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Mes</Label>
          <SearchableCombobox
            value={String(month)}
            onValueChange={(v) => onMonthChange(parseInt(v, 10))}
            options={monthOptions}
            placeholder="Mes"
            searchPlaceholder="Buscar mes…"
          />
        </div>
      </div>
    </div>
  )
}
