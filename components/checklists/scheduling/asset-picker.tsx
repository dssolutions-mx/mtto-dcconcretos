"use client"

import { useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlantaAssetBadge } from "@/components/checklists/planta-asset-badge"
import { isPlantaAsset } from "@/lib/checklist/executor-roles"
import { SearchableCombobox } from "./searchable-combobox"
import type { ScheduleAsset, SchedulePlant } from "./types"

type AssetPickerProps = {
  value: string
  onValueChange: (value: string) => void
  assets: ScheduleAsset[]
  plants: SchedulePlant[]
  loading?: boolean
  id?: string
}

export function assetLabel(asset: ScheduleAsset): string {
  const plantName = asset.plants?.name || asset.location || "Sin planta"
  return `${asset.asset_id} · ${asset.name} (${plantName})`
}

export function AssetPicker({
  value,
  onValueChange,
  assets,
  plants,
  loading = false,
  id = "assetSelection",
}: AssetPickerProps) {
  const [plantFilter, setPlantFilter] = useState<string>("all")
  const [plantaOnly, setPlantaOnly] = useState(false)

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (plantFilter !== "all" && asset.plant_id !== plantFilter) return false
      if (plantaOnly) {
        return isPlantaAsset({
          modelId: asset.model_id,
          maintenanceUnit: asset.equipment_models?.maintenance_unit,
        })
      }
      return true
    })
  }, [assets, plantFilter, plantaOnly])

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === value) ?? null,
    [assets, value]
  )

  const options = useMemo(
    () =>
      filteredAssets.map((asset) => {
        const planta = isPlantaAsset({
          modelId: asset.model_id,
          maintenanceUnit: asset.equipment_models?.maintenance_unit,
        })
        return {
          value: asset.id,
          label: assetLabel(asset),
          keywords: `${asset.asset_id} ${asset.name} ${asset.plants?.name ?? ""} ${asset.location ?? ""} ${asset.equipment_models?.name ?? ""}`,
          description: asset.equipment_models?.name ?? "Sin modelo",
          badge: planta ? (
            <span className="text-[10px] font-medium text-sky-700">Planta</span>
          ) : undefined,
        }
      }),
    [filteredAssets]
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-plant-filter`}>Filtrar por planta</Label>
          <Select value={plantFilter} onValueChange={setPlantFilter}>
            <SelectTrigger id={`${id}-plant-filter`}>
              <SelectValue placeholder="Todas las plantas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
          <Switch
            id={`${id}-planta-only`}
            checked={plantaOnly}
            onCheckedChange={setPlantaOnly}
          />
          <Label htmlFor={`${id}-planta-only`} className="text-sm font-normal leading-snug">
            Solo operaciones de planta (PLANTA)
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id}>Activo o planta</Label>
        <SearchableCombobox
          id={id}
          value={value}
          onValueChange={onValueChange}
          options={options}
          loading={loading}
          placeholder="Seleccionar activo"
          searchPlaceholder="Buscar por código, nombre o planta…"
          emptyMessage={
            plantFilter !== "all" || plantaOnly
              ? "No hay activos con estos filtros."
              : "No hay activos disponibles."
          }
        />
        {selectedAsset ? (
          <div className="flex flex-wrap items-center gap-2">
            <PlantaAssetBadge asset={selectedAsset} />
            <span className="text-xs text-muted-foreground">
              {selectedAsset.equipment_models?.name ?? "Sin modelo"}
              {selectedAsset.plants?.name ? ` · ${selectedAsset.plants.name}` : ""}
            </span>
          </div>
        ) : null}
        {filteredAssets.length !== assets.length ? (
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredAssets.length} de {assets.length} activos
          </p>
        ) : null}
      </div>
    </div>
  )
}
