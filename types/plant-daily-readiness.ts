export type PlantDailyReadinessRow = {
  assetId: string
  assetCode: string | null
  assetName: string | null
  operatorName: string | null
  readiness: "listo" | "pendiente"
  pendingScheduleId: string | null
  checklistName: string | null
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
}
