export type ChecklistDosificadorViewReadiness = "listo" | "pendiente"

export type ChecklistDosificadorViewRow = {
  scheduleId: string
  assetId: string
  assetCode: string | null
  assetName: string | null
  operatorName: string | null
  checklistName: string | null
  readiness: ChecklistDosificadorViewReadiness
  completedByLabel: string | null
  completionTime: string | null
}

export type ChecklistDosificadorViewDay = {
  dayKey: string
  summary: {
    total: number
    completed: number
    pending: number
  }
  rows: ChecklistDosificadorViewRow[]
}

export type ChecklistDosificadorViewPlant = {
  plantId: string
  plantName: string
  businessUnitName: string
  days: ChecklistDosificadorViewDay[]
}

export type ChecklistDosificadorViewPayload = {
  fromKey: string
  toKey: string
  plants: ChecklistDosificadorViewPlant[]
}
