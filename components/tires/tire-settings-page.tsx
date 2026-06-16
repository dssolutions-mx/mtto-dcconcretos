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
          setThresholds((prev) => ({ ...prev, ...data.settings.thresholds }))
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
          thresholds,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      toast.success('Ajustes guardados')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

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

              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-sm text-muted-foreground">Vista previa del siguiente formato</p>
                <p className="font-mono text-sm font-medium">{previewCode}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Umbrales de alerta</CardTitle>
              <CardDescription>
                Estos valores se usan en excepciones y alertas del diagrama.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="min-tread">Banda mínima (mm)</Label>
                <Input
                  id="min-tread"
                  type="number"
                  step="0.1"
                  value={thresholds.min_tread_mm ?? DEFAULT_MIN_TREAD_MM}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, min_tread_mm: Number(e.target.value) })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="psi-min">Presión mín. (psi)</Label>
                  <Input
                    id="psi-min"
                    type="number"
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
                    value={thresholds.pressure_max_psi ?? PRESSURE_RANGE_PSI.max}
                    onChange={(e) =>
                      setThresholds({ ...thresholds, pressure_max_psi: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="days-reading">Días sin lectura (alerta)</Label>
                <Input
                  id="days-reading"
                  type="number"
                  value={thresholds.days_without_reading ?? 14}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      days_without_reading: Number(e.target.value),
                    })
                  }
                />
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
