'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Clock, Loader2, RefreshCw } from 'lucide-react'
import type { RangePreset, ViewMode } from './view-mode'
import { VIEW_MODE_LABEL } from './view-mode'

type FilterOptions = {
  businessUnits: Array<{ id: string; name: string; code: string }>
  plants: Array<{ id: string; name: string; code: string; business_unit_id: string }>
}

type Props = {
  monthFrom: string
  monthTo: string
  onMonthFromChange: (v: string) => void
  onMonthToChange: (v: string) => void
  preset: RangePreset
  onPresetChange: (p: RangePreset) => void
  businessUnitId: string
  onBusinessUnitChange: (v: string) => void
  plantId: string
  onPlantChange: (v: string) => void
  viewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
  filterOptions: FilterOptions | null
  loading: boolean
  onRefresh: () => void
  /** ISO timestamp of most recent manual adjustment capture, for the global "Datos al …" stamp. */
  lastUpdatedAt?: string | null
}

function formatLastUpdatedStamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  // "24 abr" style — compact for the filter bar
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function FilterBar(props: Props) {
  const availablePlants =
    props.filterOptions?.plants.filter(p => !props.businessUnitId || p.business_unit_id === props.businessUnitId) || []
  const lastUpdatedStamp = formatLastUpdatedStamp(props.lastUpdatedAt)

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={props.preset}
            onValueChange={v => v && props.onPresetChange(v as RangePreset)}
            size="sm"
            className="rounded-lg border border-border/60 bg-muted/40 p-0.5"
          >
            <ToggleGroupItem value="ytd" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
              YTD
            </ToggleGroupItem>
            <ToggleGroupItem value="6m" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
              6 meses
            </ToggleGroupItem>
            <ToggleGroupItem value="12m" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
              12 meses
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
              Custom
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-1.5">
            <Label htmlFor="from" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Desde
            </Label>
            <Input
              id="from"
              type="month"
              value={props.monthFrom}
              onChange={e => {
                props.onMonthFromChange(e.target.value)
                props.onPresetChange('custom')
              }}
              className="h-8 w-[140px] text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="to" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="to"
              type="month"
              value={props.monthTo}
              onChange={e => {
                props.onMonthToChange(e.target.value)
                props.onPresetChange('custom')
              }}
              className="h-8 w-[140px] text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={props.viewMode}
              onValueChange={v => v && props.onViewModeChange(v as ViewMode)}
              size="sm"
              className="rounded-lg border border-border/60 bg-muted/40 p-0.5"
            >
              <ToggleGroupItem value="absolute" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
                {VIEW_MODE_LABEL.absolute}
              </ToggleGroupItem>
              <ToggleGroupItem value="perM3" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
                {VIEW_MODE_LABEL.perM3}
              </ToggleGroupItem>
              <ToggleGroupItem value="percentSales" className="data-[state=on]:bg-background data-[state=on]:shadow-sm">
                {VIEW_MODE_LABEL.percentSales}
              </ToggleGroupItem>
            </ToggleGroup>

            <Button size="sm" variant="outline" onClick={props.onRefresh} disabled={props.loading}>
              {props.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={props.businessUnitId || 'all'}
            onValueChange={v => {
              props.onBusinessUnitChange(v === 'all' ? '' : v)
              props.onPlantChange('')
            }}
          >
            <SelectTrigger className="h-8 w-[220px] text-sm">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Unidad</span>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las unidades</SelectItem>
              {(props.filterOptions?.businessUnits || []).map(bu => (
                <SelectItem key={bu.id} value={bu.id}>
                  {bu.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={props.plantId || 'all'} onValueChange={v => props.onPlantChange(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-[220px] text-sm">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Planta</span>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {availablePlants.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {lastUpdatedStamp && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] tabular-num text-muted-foreground">
              <Clock className="h-3 w-3" />
              Datos al {lastUpdatedStamp}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
