'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableCombobox, type ComboboxOption } from '@/components/checklists/scheduling/searchable-combobox'
import { cn } from '@/lib/utils'

export type CleanlinessPeriod = 'current_week' | 'specific_week' | 'last_4_weeks'

export function getCurrentISOWeek(): number {
  const now = new Date()
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const dayNum = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - dayNum + 3)
  const firstThursday = target.valueOf()
  target.setUTCMonth(0, 1)
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
}

export function getWeekDateRangeUTC(
  year: number,
  week: number
): { start: Date; end: Date } {
  const firstDay = new Date(Date.UTC(year, 0, 1))
  const firstMonday = new Date(firstDay)
  const dayOfWeek = firstDay.getUTCDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  firstMonday.setUTCDate(firstDay.getUTCDate() + daysToMonday - 7)
  const targetWeekStart = new Date(firstMonday)
  targetWeekStart.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7)
  const targetWeekEnd = new Date(targetWeekStart)
  targetWeekEnd.setUTCDate(targetWeekStart.getUTCDate() + 6)
  return { start: targetWeekStart, end: targetWeekEnd }
}

function formatWeekLabel(year: number, week: number, isCurrent: boolean): string {
  const { start, end } = getWeekDateRangeUTC(year, week)
  const startDate = start.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const endDate = end.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  const base = `Semana ${week} (${startDate} – ${endDate})`
  return isCurrent ? `${base} · actual` : base
}

type RhCleanlinessPeriodFiltersProps = {
  period: CleanlinessPeriod
  selectedWeek: string
  selectedYear: string
  technicianFilter: string
  searchTerm: string
  technicians: string[]
  onPeriodChange: (value: CleanlinessPeriod) => void
  onWeekChange: (value: string) => void
  onYearChange: (value: string) => void
  onTechnicianChange: (value: string) => void
  onSearchChange: (value: string) => void
  onApplySearch: () => void
  className?: string
}

export function RhCleanlinessPeriodFilters({
  period,
  selectedWeek,
  selectedYear,
  technicianFilter,
  searchTerm,
  technicians,
  onPeriodChange,
  onWeekChange,
  onYearChange,
  onTechnicianChange,
  onSearchChange,
  onApplySearch,
  className,
}: RhCleanlinessPeriodFiltersProps) {
  const currentWeek = getCurrentISOWeek()
  const currentYear = parseInt(selectedYear, 10)

  const periodOptions: ComboboxOption[] = [
    { value: 'current_week', label: 'Semana actual' },
    { value: 'specific_week', label: 'Semana específica' },
    { value: 'last_4_weeks', label: 'Últimas 4 semanas' },
  ]

  const yearOptions: ComboboxOption[] = Array.from({ length: 3 }, (_, i) => {
    const y = new Date().getFullYear() - i
    return { value: String(y), label: String(y) }
  })

  const weekOptions: ComboboxOption[] = (() => {
    const startWeek = Math.max(1, currentWeek - 8)
    const endWeek = Math.min(53, currentWeek + 8)
    const weeks: ComboboxOption[] = []
    for (let week = startWeek; week <= endWeek; week++) {
      weeks.push({
        value: String(week),
        label: formatWeekLabel(currentYear, week, week === currentWeek),
      })
    }
    return weeks
  })()

  const technicianOptions: ComboboxOption[] = [
    { value: 'all', label: 'Todos los técnicos' },
    ...technicians.map((tech) => ({ value: tech, label: tech })),
  ]

  const periodHint = (() => {
    if (period === 'last_4_weeks') {
      return 'Ventana móvil de cuatro semanas hasta la semana actual.'
    }
    const weekNum = period === 'specific_week' && selectedWeek ? parseInt(selectedWeek, 10) : currentWeek
    const { start, end } = getWeekDateRangeUTC(currentYear, weekNum)
    const startLabel = start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    const endLabel = end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return `${startLabel} – ${endLabel}, ${currentYear} (UTC)`
  })()

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-5',
        className
      )}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Filtros
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{periodHint}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-2 lg:col-span-1">
          <Label className="text-xs text-muted-foreground">Período</Label>
          <SearchableCombobox
            value={period}
            onValueChange={(v) => onPeriodChange(v as CleanlinessPeriod)}
            options={periodOptions}
            placeholder="Período"
          />
        </div>

        {period === 'specific_week' ? (
          <>
            <div className="space-y-2 lg:col-span-2">
              <Label className="text-xs text-muted-foreground">Semana</Label>
              <div className="flex gap-2">
                <SearchableCombobox
                  value={selectedWeek}
                  onValueChange={onWeekChange}
                  options={weekOptions}
                  placeholder="Selecciona semana"
                  searchPlaceholder="Buscar semana…"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 px-3"
                  onClick={() => onWeekChange(String(currentWeek))}
                >
                  Actual
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Año</Label>
              <SearchableCombobox
                value={selectedYear}
                onValueChange={onYearChange}
                options={yearOptions}
                placeholder="Año"
              />
            </div>
          </>
        ) : null}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Técnico evaluador</Label>
          <SearchableCombobox
            value={technicianFilter}
            onValueChange={onTechnicianChange}
            options={technicianOptions}
            placeholder="Todos"
            searchPlaceholder="Buscar técnico…"
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <Label className="text-xs text-muted-foreground">Buscar unidad</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Código o nombre de unidad"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onApplySearch()}
            />
            <Button type="button" variant="secondary" onClick={onApplySearch} className="shrink-0">
              Buscar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
