'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { TIRE_TEMPLATE_OPTIONS, templateLabel } from './constants'
import type { TireLayoutTemplateKey, TireOnboardingScopePayload } from '@/types/tires'

interface ModelRow {
  id: string
  name: string
  category?: string | null
  layout?: { template_key: string } | null
  position_count?: number
}

interface StepLayoutsProps {
  models: ModelRow[]
  scopePayload?: TireOnboardingScopePayload
  saving?: boolean
  onBack: () => void
  onSaveLayouts: (
    assignments: Record<string, TireLayoutTemplateKey>,
    complete: boolean
  ) => Promise<void>
}

export function StepLayouts({
  models,
  scopePayload,
  saving,
  onBack,
  onSaveLayouts,
}: StepLayoutsProps) {
  const [assignments, setAssignments] = useState<Record<string, TireLayoutTemplateKey>>({})

  useEffect(() => {
    const initial: Record<string, TireLayoutTemplateKey> = {}
    for (const model of models) {
      if (model.layout?.template_key) {
        initial[model.id] = model.layout.template_key as TireLayoutTemplateKey
      }
    }
    setAssignments(initial)
  }, [models])

  const scopedModels = useMemo(() => {
    const categories = scopePayload?.categories ?? []
    if (categories.length === 0) return models
    return models.filter((m) => m.category && categories.includes(m.category))
  }, [models, scopePayload?.categories])

  const configuredCount = scopedModels.filter(
    (m) => assignments[m.id] && assignments[m.id] !== 'custom'
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layouts por modelo</CardTitle>
        <CardDescription>
          Asigne una plantilla de posiciones a cada modelo. El preview muestra la cantidad de
          posiciones; el diagrama interactivo llegará en una fase posterior.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {configuredCount} de {scopedModels.length} modelos con layout asignado
          </span>
          {scopePayload?.categories && scopePayload.categories.length > 0 && (
            <Badge variant="outline">
              Filtro: {scopePayload.categories.join(', ')}
            </Badge>
          )}
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Layout template</TableHead>
                <TableHead className="text-right">Posiciones</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead className="text-right">Editor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopedModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay modelos para configurar con el alcance seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                scopedModels.map((model) => {
                  const templateKey = assignments[model.id] ?? null
                  const positionCount =
                    templateKey === 'vehicle_4wheel'
                      ? 4
                      : templateKey === 'truck_6x4'
                        ? 10
                        : model.position_count ?? 0

                  return (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell className="capitalize">{model.category ?? '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={templateKey ?? ''}
                          onValueChange={(value) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [model.id]: value as TireLayoutTemplateKey,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Seleccionar layout" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIRE_TEMPLATE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.key} value={opt.key}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {positionCount || '—'}
                      </TableCell>
                      <TableCell>
                        {templateKey ? (
                          <div className="flex gap-0.5">
                            {Array.from({ length: Math.min(positionCount, 10) }).map((_, i) => (
                              <span
                                key={i}
                                className="inline-block h-3 w-3 rounded-full border border-dashed border-muted-foreground/50"
                              />
                            ))}
                            {positionCount > 10 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin configurar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/modelos/${model.id}?tab=tires`}>
                            {templateKey ? 'Editar' : 'Configurar'}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {scopedModels.some((m) => assignments[m.id]) && (
          <p className="text-xs text-muted-foreground">
            Plantillas seleccionadas:{' '}
            {[...new Set(Object.values(assignments).map((k) => templateLabel(k)))].join(' · ')}.
            Use el editor del modelo para personalizar posiciones.
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={saving}>
            Anterior
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saving || configuredCount === 0}
              onClick={() => onSaveLayouts(assignments, false)}
            >
              Guardar y continuar después
            </Button>
            <Button
              disabled={saving || configuredCount === 0}
              onClick={() => onSaveLayouts(assignments, true)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Finalizar paso 2
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
