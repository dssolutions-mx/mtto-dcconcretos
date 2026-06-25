"use client"

import { Badge } from "@/components/ui/badge"
import { PlantaAssetBadge } from "@/components/checklists/planta-asset-badge"
import { isPlantaAsset } from "@/lib/checklist/executor-roles"
import { MapPin, Users, Play, Truck, Factory, AlertTriangle, CheckCircle, Clock, Calendar } from "lucide-react"
import Link from "next/link"
import type { AssetChecklistCardData, ChecklistStatus } from "./asset-checklist-card"

interface AssetChecklistListRowProps {
  asset: AssetChecklistCardData
  formatDate: (date: string | null) => string | null
}

function getStatusBadge(status: ChecklistStatus) {
  switch (status) {
    case "overdue":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Atrasado
        </Badge>
      )
    case "due_soon":
      return (
        <Badge className="bg-checklist-status-due hover:bg-checklist-status-due/90 text-white flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Próximo
        </Badge>
      )
    case "ok":
      return (
        <Badge className="bg-checklist-status-ok hover:bg-checklist-status-ok/90 text-white flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Al día
        </Badge>
      )
    case "no_schedule":
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Sin programar
        </Badge>
      )
  }
}

export function AssetChecklistListRow({ asset, formatDate }: AssetChecklistListRowProps) {
  const plantName = asset.plants?.name || asset.location || "Sin planta"
  const departmentName = asset.departments?.name || asset.department || "Sin departamento"
  const modelName = asset.equipment_models?.name || asset.name
  const planta = isPlantaAsset({
    modelId: asset.model_id,
    maintenanceUnit: asset.equipment_models?.maintenance_unit,
  })
  const AssetIcon = planta ? Factory : Truck

  return (
    <Link
      href={`/checklists/assets/${asset.id}`}
      className="block hover:bg-muted/50 transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <AssetIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold truncate font-mono tabular-nums">{asset.asset_id}</h3>
                <PlantaAssetBadge asset={asset} />
                <span className="text-sm text-muted-foreground">Modelo: {modelName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {plantName}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {departmentName}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {asset.pending_checklists > 0 && (
              <div className="text-right">
                <div className="text-sm font-medium">
                  {asset.overdue_checklists > 0
                    ? `${asset.overdue_checklists} atrasados`
                    : `${asset.pending_checklists} pendientes`}
                </div>
                {asset.next_checklist_date && (
                  <div className="text-xs text-muted-foreground">{formatDate(asset.next_checklist_date)}</div>
                )}
              </div>
            )}
            {getStatusBadge(asset.checklist_status)}
            {asset.pending_checklists > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary min-h-[44px] items-center">
                <Play className="h-4 w-4" />
                Ejecutar
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
