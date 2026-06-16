"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_TIRE_READINGS_CONFIG,
  fieldsFromReadingMode,
  normalizeTireReadingsConfig,
  readingModeFromFields,
} from "@/lib/tires/tire-readings-validation"
import type { TireReadingsSectionConfig } from "@/types/tires"

const READING_MODE_LABELS: Record<string, string> = {
  both: 'Banda + presión',
  psi: 'Solo presión (psi)',
  mm: 'Solo banda (mm)',
  none: 'Sin captura obligatoria',
}

interface TireReadingsConfigEditorProps {
  config?: TireReadingsSectionConfig | null
  onChange: (config: TireReadingsSectionConfig) => void
}

export function TireReadingsConfigEditor({ config, onChange }: TireReadingsConfigEditorProps) {
  const normalized = normalizeTireReadingsConfig(config ?? DEFAULT_TIRE_READINGS_CONFIG)

  const applyModePreset = (mode: TireReadingsSectionConfig['reading_mode']) => {
    const fields = fieldsFromReadingMode(mode ?? 'both')
    onChange({
      reading_mode: mode ?? 'both',
      measure_tread: fields.measure_tread,
      measure_pressure: fields.measure_pressure,
      require_all_positions: normalized.require_all_positions,
    })
  }

  const updateFieldToggle = (
    field: 'measure_tread' | 'measure_pressure',
    checked: boolean
  ) => {
    const measure_tread = field === 'measure_tread' ? checked : normalized.measure_tread
    const measure_pressure = field === 'measure_pressure' ? checked : normalized.measure_pressure
    onChange({
      reading_mode: readingModeFromFields(measure_tread, measure_pressure),
      measure_tread,
      measure_pressure,
      require_all_positions: normalized.require_all_positions,
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-dashed p-4">
      <div className="space-y-2">
        <Label>Modo de lectura</Label>
        <Select
          value={normalized.reading_mode ?? 'both'}
          onValueChange={(value) =>
            applyModePreset(value as TireReadingsSectionConfig['reading_mode'])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(READING_MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Define qué datos debe capturar el operador en campo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label htmlFor="measure-tread" className="text-sm font-normal">
            Medir banda (mm)
          </Label>
          <Switch
            id="measure-tread"
            checked={normalized.measure_tread}
            disabled={normalized.reading_mode === 'none'}
            onCheckedChange={(checked) => updateFieldToggle('measure_tread', checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <Label htmlFor="measure-pressure" className="text-sm font-normal">
            Medir presión (psi)
          </Label>
          <Switch
            id="measure-pressure"
            checked={normalized.measure_pressure}
            disabled={normalized.reading_mode === 'none'}
            onCheckedChange={(checked) => updateFieldToggle('measure_pressure', checked)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
        <div>
          <Label htmlFor="require-all-positions" className="text-sm font-normal">
            Exigir todas las posiciones
          </Label>
          <p className="text-xs text-muted-foreground">
            Si está desactivado, basta con al menos una lectura.
          </p>
        </div>
        <Switch
          id="require-all-positions"
          checked={normalized.require_all_positions ?? true}
          disabled={normalized.reading_mode === 'none'}
          onCheckedChange={(checked) =>
            onChange({ ...normalized, require_all_positions: checked })
          }
        />
      </div>
    </div>
  )
}
