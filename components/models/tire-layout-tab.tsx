'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save } from 'lucide-react'
import { TIRE_TEMPLATE_OPTIONS, templateLabel } from '@/components/tires/onboarding/constants'
import { getPositionsForTemplate } from '@/lib/tires/positions'
import type { EquipmentModelTireLayout, TireLayoutTemplateKey, TirePosition } from '@/types/tires'

interface TireLayoutTabProps {
  modelId: string
  modelName: string
}

function PositionPreview({ positions }: { positions: TirePosition[] }) {
  const byAxle = useMemo(() => {
    const map = new Map<number, TirePosition[]>()
    for (const pos of positions) {
      const list = map.get(pos.axle) ?? []
      list.push(pos)
      map.set(pos.axle, list)
    }
    return [...map.entries()].sort(([a], [b]) => a - b)
  }, [positions])

  if (positions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Sin posiciones
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      {byAxle.map(([axle, axlePositions]) => (
        <div key={axle} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Eje {axle}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {axlePositions.map((pos) => (
              <div
                key={pos.code}
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/40 text-[10px] text-muted-foreground"
                title={pos.label}
              >
                {pos.side === 'izq' ? 'I' : pos.side === 'der' ? 'D' : 'C'}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-muted-foreground">
        {positions.length} posiciones · preview simplificado
      </p>
    </div>
  )
}

export function TireLayoutTab({ modelId, modelName }: TireLayoutTabProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateKey, setTemplateKey] = useState<TireLayoutTemplateKey>('truck_6x4')
  const [positions, setPositions] = useState<TirePosition[]>([])
  const [savedLayout, setSavedLayout] = useState<EquipmentModelTireLayout | null>(null)
  const [orphanWarning, setOrphanWarning] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/equipment-models/${modelId}/tire-layout`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar layout')

      if (data.layout) {
        setSavedLayout(data.layout)
        setTemplateKey(data.layout.template_key as TireLayoutTemplateKey)
        setPositions(data.resolved_positions ?? [])
      } else {
        setSavedLayout(null)
        setTemplateKey('truck_6x4')
        setPositions(getPositionsForTemplate('truck_6x4'))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar layout')
    } finally {
      setLoading(false)
    }
  }, [modelId])

  useEffect(() => {
    load()
  }, [load])

  const handleTemplateChange = (key: TireLayoutTemplateKey) => {
    setTemplateKey(key)
    if (key !== 'custom') {
      setPositions(getPositionsForTemplate(key))
    }
  }

  const previewPositions = useMemo(() => {
    if (templateKey === 'custom' && positions.length > 0) return positions
    return getPositionsForTemplate(templateKey)
  }, [templateKey, positions])

  const handleSave = async () => {
    setSaving(true)
    setOrphanWarning([])
    try {
      const payload = {
        template_key: templateKey,
        positions: templateKey === 'custom' ? positions : [],
      }
      const res = await fetch(`/api/equipment-models/${modelId}/tire-layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      setSavedLayout(data.layout)
      setPositions(data.resolved_positions ?? [])

      const coverageRes = await fetch('/api/tires/coverage')
      const coverageData = await coverageRes.json()
      if (coverageRes.ok) {
        const modelAssets = (coverageData.coverage ?? []).filter(
          (r: { model_id: string | null; orphaned_positions: string[] }) =>
            r.model_id === modelId && r.orphaned_positions.length > 0
        )
        const orphans = [
          ...new Set(
            modelAssets.flatMap((r: { orphaned_positions: string[] }) => r.orphaned_positions)
          ),
        ] as string[]
        if (orphans.length > 0) {
          setOrphanWarning(orphans)
          toast.warning(
            `Layout guardado. Hay ${orphans.length} posición(es) huérfana(s) con llantas montadas.`
          )
        } else {
          toast.success('Layout de llantas guardado')
        }
      } else {
        toast.success('Layout de llantas guardado')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layout de llantas — {modelName}</CardTitle>
        <CardDescription>
          Defina las posiciones de llantas para todos los activos de este modelo. Los activos
          heredan este layout automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {orphanWarning.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              Posiciones huérfanas con llantas montadas: {orphanWarning.join(', ')}. Revise los
              activos afectados antes de continuar operando.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Plantilla</p>
              <Select value={templateKey} onValueChange={(v) => handleTemplateChange(v as TireLayoutTemplateKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIRE_TEMPLATE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {templateLabel(templateKey)} · {previewPositions.length} posiciones
              </p>
            </div>

            <PositionPreview positions={previewPositions} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Posiciones</p>
              {savedLayout && <Badge variant="outline">Guardado</Badge>}
            </div>
            <div className="rounded-md border max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Eje</TableHead>
                    <TableHead>Lado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewPositions.map((pos, idx) => (
                    <TableRow key={pos.code}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{pos.code}</TableCell>
                      <TableCell>{pos.axle}</TableCell>
                      <TableCell className="capitalize">{pos.side}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Los activos con este modelo usarán estas posiciones en el mapa y montaje.
          </p>
          <Button onClick={handleSave} disabled={saving || previewPositions.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Guardar layout
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          También puede configurar layouts desde el{' '}
          <Link href="/activos/llantas/configuracion" className="underline">
            asistente de configuración
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  )
}
