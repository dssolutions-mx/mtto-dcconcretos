'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { DEFAULT_MIN_TREAD_MM, PRESSURE_RANGE_PSI } from '@/lib/tires/positions'
import { previewInternalCode } from '@/lib/tires/identifier'
import {
  formatThresholdSummary,
  normalizeTireThresholds,
  THRESHOLD_DEFAULTS_NOTE,
  validateTireThresholds,
} from '@/lib/tires/thresholds-ui'
import type { TireIdRules, TireThresholds } from '@/types/tires'
import { ArrowLeft, Loader2 } from 'lucide-react'

export function TireSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [idRules, setIdRules] = useState<TireIdRules>({
    dot_required: false,
    auto_generate: false,
    internal_prefix: '',
  })
  const [thresholds, setThresholds] = useState<TireThresholds>({
    min_tread_mm: DEFAULT_MIN_TREAD_MM,
    pressure_min_psi: PRESSURE_RANGE_PSI.min,
    pressure_max_psi: PRESSURE_RANGE_PSI.max,
    days_without_reading: 14,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tires/settings')
      const data = await res.json()
      if (res.ok && data.settings) {
        if (data.settings.thresholds) {
          setThresholds(normalizeTireThresholds(data.settings.thresholds))
        }
        if (data.settings.id_rules) {
          setIdRules((prev) => ({ ...prev, ...data.settings.id_rules }))
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    const validationError = validateTireThresholds(thresholds)
    if (validationError) {
      toast.error(validationError)
      return
    }

    const normalizedThresholds = normalizeTireThresholds(thresholds)

    setSaving(true)
    try {
      const res = await fetch('/api/tires/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_rules: {
            dot_required: idRules.dot_required ?? false,
            auto_generate: idRules.auto_generate ?? false,
            internal_prefix: idRules.internal_prefix?.trim() || undefined,
          },
          thresholds: normalizedThresholds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      if (data.settings?.thresholds) {
        setThresholds(normalizeTireThresholds(data.settings.thresholds))
      }
      if (data.settings?.id_rules) {
        setIdRules((prev) => ({ ...prev, ...data.settings.id_rules }))
      }
      toast.success('Ajustes guardados')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const activeThresholdSummary = formatThresholdSummary(thresholds)

  const previewCode = previewInternalCode({
    rules: {
      dot_required: idRules.dot_required,
      auto_generate: idRules.auto_generate,
      internal_prefix: idRules.internal_prefix,
    },
    plantCode: 'P1',
    sequence: 421,
  })

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Ajustes de llantas"
        text="Reglas de identificación y umbrales de alerta para la flota."
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/activos/llantas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Inventario
          </Link>
        </Button>
      </DashboardHeader>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid max-w-2xl gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identificación</CardTitle>
              <CardDescription>
                Controla DOT obligatorio, prefijo interno y auto-generación al crear llantas.
                El <strong>código interno</strong> identifica la llanta en su flota; el{' '}
                <strong>DOT / serial</strong> es el código del fabricante en la pared lateral.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="dot-required-settings"
                  checked={idRules.dot_required ?? false}
                  onCheckedChange={(v) => setIdRules({ ...idRules, dot_required: v === true })}
                />
                <Label htmlFor="dot-required-settings">DOT / serial obligatorio al registrar</Label>
              </div>

              <div className="space-y-1">
                <Label htmlFor="internal-prefix">Prefijo interno</Label>
                <Input
                  id="internal-prefix"
                  value={idRules.internal_prefix ?? ''}
                  onChange={(e) => setIdRules({ ...idRules, internal_prefix: e.target.value })}
                  placeholder="DC-LL"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-generate-settings"
                  checked={idRules.auto_generate ?? false}
                  onCheckedChange={(v) => setIdRules({ ...idRules, auto_generate: v === true })}
                />
                <Label htmlFor="auto-generate-settings">
                  Auto-generar ID secuencial (planta + año)
                </Label>
              </div>

              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-sm text-muted-foreground">Vista previa del siguiente código interno</p>
                <p className="font-mono text-sm font-medium">{previewCode}</p>
                <p className="text-xs text-muted-foreground">
                  Formato: prefijo-planta-año-secuencia (ej. DC-LL-P1-2026-00421). El DOT se captura
                  aparte al registrar cada llanta.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Umbrales de alerta</CardTitle>
              <CardDescription>
                Estos valores alimentan el diagrama, la ficha de posición y las excepciones de flota.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">{THRESHOLD_DEFAULTS_NOTE}</p>
              <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-sm text-muted-foreground">Umbrales activos (vista previa)</p>
                <p className="text-sm font-medium">{activeThresholdSummary}</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="min-tread">Banda mínima crítica (mm)</Label>
                <Input
                  id="min-tread"
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={thresholds.min_tread_mm ?? DEFAULT_MIN_TREAD_MM}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, min_tread_mm: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Por debajo de este valor la llanta se marca como crítica en diagrama y excepciones.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="psi-min">Presión mín. (psi)</Label>
                  <Input
                    id="psi-min"
                    type="number"
                    min={1}
                    step="1"
                    value={thresholds.pressure_min_psi ?? PRESSURE_RANGE_PSI.min}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, pressure_min_psi: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="psi-max">Presión máx. (psi)</Label>
                  <Input
                    id="psi-max"
                    type="number"
                    min={1}
                    step="1"
                    value={thresholds.pressure_max_psi ?? PRESSURE_RANGE_PSI.max}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, pressure_max_psi: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Lecturas fuera de este rango generan alerta de presión. La mínima debe ser menor que la máxima.
              </p>
              <div className="space-y-1">
                <Label htmlFor="days-reading">Días sin lectura (alerta)</Label>
                <Input
                  id="days-reading"
                  type="number"
                  min={1}
                  step="1"
                  value={thresholds.days_without_reading ?? 14}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      days_without_reading: Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Montajes sin lectura reciente se marcan como «Sin lectura» y aparecen en excepciones.
                </p>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar ajustes
          </Button>
        </div>
      )}
    </DashboardShell>
  )
}

