"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Loader2 } from "lucide-react"
import { isPressureOutOfRange, isTreadLow } from "@/lib/tires/positions"
import type { ChecklistTireReadingInput } from "@/lib/tires/checklist-readings"

export interface TireInstallationForChecklist {
  id: string
  position_code: string
  position_label: string
  tire?: {
    brand: string
    size: string
    min_tread_mm: number
  } | null
  latest_reading?: {
    tread_depth_mm: number | null
    pressure_psi: number | null
    read_at: string
  } | null
}

interface TireReadingsSectionProps {
  assetId: string
  sectionTitle: string
  value: ChecklistTireReadingInput[]
  onChange: (readings: ChecklistTireReadingInput[]) => void
  disabled?: boolean
}

export function TireReadingsSection({
  assetId,
  sectionTitle,
  value,
  onChange,
  disabled = false,
}: TireReadingsSectionProps) {
  const [loading, setLoading] = useState(true)
  const [installations, setInstallations] = useState<TireInstallationForChecklist[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assets/${assetId}/tires`)
      const data = await res.json()
      if (res.ok) {
        const active = (data.installations ?? []).filter(
          (i: { removed_at: string | null }) => !i.removed_at
        )
        setInstallations(active)
        if (value.length === 0 && active.length > 0) {
          onChange(
            active.map((i: TireInstallationForChecklist) => ({
              installation_id: i.id,
              position_code: i.position_code,
              tread_depth_mm: null,
              pressure_psi: null,
            }))
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }, [assetId, onChange, value.length])

  useEffect(() => {
    load()
  }, [load])

  const updateReading = (
    installationId: string,
    patch: Partial<ChecklistTireReadingInput>
  ) => {
    const next = installations.map((inst) => {
      const existing = value.find((r) => r.installation_id === inst.id)
      const base: ChecklistTireReadingInput = existing ?? {
        installation_id: inst.id,
        position_code: inst.position_code,
        tread_depth_mm: null,
        pressure_psi: null,
      }
      if (inst.id !== installationId) return base
      return { ...base, ...patch }
    })
    onChange(next)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (installations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{sectionTitle}</CardTitle>
          <CardDescription>No hay llantas montadas en este activo.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{sectionTitle}</CardTitle>
        <CardDescription>
          Registre profundidad de banda (mm) y presión (psi) por posición — igual que las lecturas de medidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {installations.map((inst) => {
          const reading = value.find((r) => r.installation_id === inst.id)
          const minMm = inst.tire?.min_tread_mm ?? 3
          const treadLow = isTreadLow(reading?.tread_depth_mm, minMm)
          const pressureBad = isPressureOutOfRange(reading?.pressure_psi)

          return (
            <div
              key={inst.id}
              className={`rounded-lg border p-4 space-y-3 ${
                treadLow || pressureBad ? "border-amber-500 bg-amber-50/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{inst.position_label}</p>
                  {inst.tire && (
                    <p className="text-sm text-muted-foreground">
                      {inst.tire.brand} {inst.tire.size}
                    </p>
                  )}
                  {inst.latest_reading && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última: {inst.latest_reading.tread_depth_mm ?? "—"} mm /{" "}
                      {inst.latest_reading.pressure_psi ?? "—"} psi
                    </p>
                  )}
                </div>
                {(treadLow || pressureBad) && (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Banda (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    disabled={disabled}
                    value={reading?.tread_depth_mm ?? ""}
                    onChange={(e) =>
                      updateReading(inst.id, {
                        tread_depth_mm: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Presión (psi)</Label>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    disabled={disabled}
                    value={reading?.pressure_psi ?? ""}
                    onChange={(e) =>
                      updateReading(inst.id, {
                        pressure_psi: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {treadLow && <Badge variant="destructive">Banda baja</Badge>}
                {pressureBad && <Badge variant="destructive">Presión fuera de rango</Badge>}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
