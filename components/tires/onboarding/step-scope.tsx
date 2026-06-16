'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { TireOnboardingScopePayload } from '@/types/tires'

interface PlantOption {
  id: string
  name: string
  code?: string | null
}

interface AssetOption {
  id: string
  name: string | null
  asset_id?: string | null
  plant_id?: string | null
  equipment_models?: { name?: string; category?: string | null } | null
}

interface StepScopeProps {
  plants: PlantOption[]
  assets: AssetOption[]
  categories: string[]
  initialPayload?: TireOnboardingScopePayload
  saving?: boolean
  onSave: (payload: TireOnboardingScopePayload, complete: boolean) => Promise<void>
}

export function StepScope({
  plants,
  assets,
  categories,
  initialPayload,
  saving,
  onSave,
}: StepScopeProps) {
  const [plantIds, setPlantIds] = useState<string[]>(initialPayload?.plant_ids ?? [])
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialPayload?.categories ?? []
  )
  const [pilotAssetIds, setPilotAssetIds] = useState<string[]>(
    initialPayload?.pilot_asset_ids ?? []
  )

  useEffect(() => {
    setPlantIds(initialPayload?.plant_ids ?? [])
    setSelectedCategories(initialPayload?.categories ?? [])
    setPilotAssetIds(initialPayload?.pilot_asset_ids ?? [])
  }, [initialPayload])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (plantIds.length > 0 && asset.plant_id && !plantIds.includes(asset.plant_id)) {
        return false
      }
      const cat = asset.equipment_models?.category
      if (selectedCategories.length > 0 && cat && !selectedCategories.includes(cat)) {
        return false
      }
      return true
    })
  }, [assets, plantIds, selectedCategories])

  const toggle = (list: string[], id: string, max?: number) => {
    if (list.includes(id)) return list.filter((x) => x !== id)
    if (max != null && list.length >= max) return list
    return [...list, id]
  }

  const payload: TireOnboardingScopePayload = {
    plant_ids: plantIds,
    categories: selectedCategories,
    pilot_asset_ids: pilotAssetIds,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alcance de la configuración</CardTitle>
        <CardDescription>
          Seleccione planta(s), categorías de activo y hasta 3 activos piloto para validar el
          proceso antes de expandir a toda la flota.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <Label className="text-sm font-medium">Plantas</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {plants.map((plant) => (
              <label
                key={plant.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={plantIds.includes(plant.id)}
                  onCheckedChange={() => setPlantIds((prev) => toggle(prev, plant.id))}
                />
                <span>
                  {plant.name}
                  {plant.code ? ` (${plant.code})` : ''}
                </span>
              </label>
            ))}
            {plants.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay plantas registradas.</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <Label className="text-sm font-medium">Categorías de activo</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => (
              <label
                key={category}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() =>
                    setSelectedCategories((prev) => toggle(prev, category))
                  }
                />
                <span className="capitalize">{category}</span>
              </label>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay categorías en modelos de equipo.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <Label className="text-sm font-medium">Activos piloto (máx. 3)</Label>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
            {filteredAssets.map((asset) => {
              const label = asset.name ?? asset.asset_id ?? asset.id
              const modelName = asset.equipment_models?.name
              return (
                <label
                  key={asset.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={pilotAssetIds.includes(asset.id)}
                    onCheckedChange={() =>
                      setPilotAssetIds((prev) => toggle(prev, asset.id, 3))
                    }
                  />
                  <span>
                    {label}
                    {modelName ? ` · ${modelName}` : ''}
                  </span>
                </label>
              )
            })}
            {filteredAssets.length === 0 && (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No hay activos que coincidan con los filtros seleccionados.
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onSave(payload, false)}
          >
            Guardar y continuar después
          </Button>
          <Button disabled={saving} onClick={() => onSave(payload, true)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continuar a layouts
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
