import type { PlantControlDueSummary } from "@/types/plant-operations-schedule"

export type PlantDailyReadinessRow = {
  assetId: string
  assetCode: string | null
  assetName: string | null
  operatorName: string | null
  readiness: "listo" | "pendiente"
  pendingScheduleId: string | null
  checklistName: string | null
  /** Synthetic row for PLANTA control checklist (not tied to a truck asset). */
  rowKind?: "asset" | "plant_control"
}

export type PlantAssetOption = {
  id: string
  name: string | null
  asset_id: string | null
}

export type PlantDailyReadinessPayload = {
  todayKey: string
  plantId: string
  rows: PlantDailyReadinessRow[]
  pendingCount: number
  readyCount: number
  assetsForIncidents: PlantAssetOption[]
  /** Plant control checklist due status for dosificador dashboard. */
  plantControlDue?: PlantControlDueSummary | null
}
