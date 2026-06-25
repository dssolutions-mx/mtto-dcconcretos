"use client"

import { Badge } from "@/components/ui/badge"
import { isPlantaAsset } from "@/lib/checklist/executor-roles"
import { Factory } from "lucide-react"

type AssetLike = {
  model_id?: string | null
  equipment_models?: { maintenance_unit?: string | null } | null
}

export function PlantaAssetBadge({ asset }: { asset: AssetLike | null | undefined }) {
  if (!asset) return null

  const planta = isPlantaAsset({
    modelId: asset.model_id,
    maintenanceUnit: asset.equipment_models?.maintenance_unit,
  })

  if (!planta) return null

  return (
    <Badge
      variant="outline"
      className="shrink-0 gap-1 border-sky-300/70 bg-sky-50 text-sky-800 text-[10px] font-semibold dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
    >
      <Factory className="h-3 w-3" />
      Operaciones de planta
    </Badge>
  )
}
