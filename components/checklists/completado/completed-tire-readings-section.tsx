"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CircleDot } from "lucide-react"
import { normalizeTireReadingsConfig } from "@/lib/tires/tire-readings-validation"
import type { ChecklistTireReadingInput } from "@/lib/tires/checklist-readings"
import type { TireReadingsSectionConfig } from "@/types/tires"

interface CompletedTireReadingsSectionProps {
  sectionTitle: string
  config?: TireReadingsSectionConfig | null
  readings: ChecklistTireReadingInput[]
}

export function CompletedTireReadingsSection({
  sectionTitle,
  config,
  readings,
}: CompletedTireReadingsSectionProps) {
  const resolved = normalizeTireReadingsConfig(config)

  if (!readings.length) {
    return (
      <Card className="border-violet-200 bg-violet-50/30 shadow-checklist-2">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CircleDot className="h-5 w-5 text-violet-600" />
            {sectionTitle}
          </CardTitle>
          <CardDescription>No se registraron lecturas de llantas en este checklist.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-violet-200 bg-violet-50/30 shadow-checklist-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CircleDot className="h-5 w-5 text-violet-600" />
          {sectionTitle}
        </CardTitle>
        <CardDescription>
          {readings.length} lectura{readings.length !== 1 ? 's' : ''} capturada
          {readings.length !== 1 ? 's' : ''}
          {resolved.reading_mode !== 'none' && (
            <> · Modo: {modeLabel(resolved.reading_mode ?? 'both')}</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {readings.map((reading) => (
            <div
              key={reading.installation_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span className="font-medium">{reading.position_code}</span>
              <div className="flex flex-wrap gap-2">
                {resolved.measure_tread && (
                  <Badge variant="outline">
                    Banda: {reading.tread_depth_mm != null ? `${reading.tread_depth_mm} mm` : '—'}
                  </Badge>
                )}
                {resolved.measure_pressure && (
                  <Badge variant="outline">
                    Presión: {reading.pressure_psi != null ? `${reading.pressure_psi} psi` : '—'}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'psi':
      return 'solo presión'
    case 'mm':
      return 'solo banda'
    case 'both':
      return 'banda + presión'
    default:
      return mode
  }
}
