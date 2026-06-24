export const DIESEL_CONSUMPTION_DRAFT_ID = "diesel-consumption-draft"
export const DIESEL_CONSUMPTION_PHOTO_DRAFT_OUTBOX = "draft:diesel-consumption-photo"

export interface DieselConsumptionDraftData {
  productType: "diesel" | "urea"
  selectedBusinessUnit: string | null
  selectedPlant: string | null
  selectedWarehouse: string | null
  assetType: "formal" | "exception"
  selectedAssetId: string | null
  selectedAssetName: string | null
  exceptionAssetName: string
  quantityLiters: string
  transactionDate: string
  transactionTime: string
  cuentaLitros: string
  cuentaLitrosManuallyEdited: boolean
  readings: Record<string, unknown>
  notes: string
  machinePhotoPreview: string | null
  machinePhotoDraftId: string | null
  /** Set when a complete form was auto-queued to the outbox before explicit submit. */
  wipOutboxId?: string | null
  savedAt: number
}

const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export function isDieselConsumptionDraftStale(draft: DieselConsumptionDraftData): boolean {
  return Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS
}

export function dieselConsumptionDraftHasContent(draft: DieselConsumptionDraftData): boolean {
  return Boolean(
    draft.selectedWarehouse ||
      draft.selectedAssetId ||
      draft.exceptionAssetName.trim() ||
      draft.quantityLiters ||
      draft.cuentaLitros ||
      draft.notes.trim() ||
      draft.machinePhotoPreview ||
      draft.machinePhotoDraftId
  )
}

export function dieselConsumptionDraftIsComplete(draft: DieselConsumptionDraftData): boolean {
  if (!draft.selectedWarehouse || !draft.quantityLiters) return false
  if (parseFloat(draft.quantityLiters) <= 0) return false
  if (draft.assetType === "formal" && !draft.selectedAssetId) return false
  if (draft.assetType === "exception" && !draft.exceptionAssetName.trim()) return false
  if (!draft.machinePhotoDraftId) return false
  return true
}
