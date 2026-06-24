import {
  buildConsumptionTransactionData,
  submitDurableDieselConsumption,
} from "@/lib/diesel/durable-diesel-submit"
import type { DieselConsumptionDraftData } from "@/lib/diesel/diesel-consumption-draft"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { requestSync } from "@/lib/offline/sync-bridge"
import { sanitizeValueForPostgresJsonb } from "@/lib/json/sanitize-for-postgres-jsonb"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"

export interface ConsumptionWipContext {
  productType: "diesel" | "urea"
  productId: string
  userId: string
  selectedPlant: string | null
  selectedWarehouse: string
  warehouses: Array<{ id: string; plant_id?: string | null }>
  allBuWarehouses: Array<{ id: string; plant_id?: string | null }>
  assetType: "formal" | "exception"
  selectedAsset: { id: string; name?: string } | null
  exceptionAssetName: string
  quantityLiters: string
  cuentaLitros: string
  previousCuentaLitros: number | null
  cuentaLitrosVariance: number | null
  readings: Record<string, unknown>
  transactionDate: string
  transactionTime: string
  notes: string
  machinePhotoDraftId: string | null
  machineEvidenceMetadata: DieselEvidenceImageMetadata | null
  wipOutboxId: string | null
}

export function isConsumptionFormSubmittable(ctx: ConsumptionWipContext): boolean {
  if (!ctx.productId || !ctx.userId || !ctx.selectedWarehouse) return false
  if (!ctx.quantityLiters || parseFloat(ctx.quantityLiters) <= 0) return false
  if (ctx.assetType === "formal" && !ctx.selectedAsset?.id) return false
  if (ctx.assetType === "exception" && !ctx.exceptionAssetName.trim()) return false
  if (ctx.previousCuentaLitros !== null && !ctx.cuentaLitros) return false
  if (!ctx.machinePhotoDraftId) return false
  return true
}

/**
 * When the form is complete, queue the consumption to IndexedDB immediately so a
 * sudden browser kill (low memory) does not lose audit data before the user taps Guardar.
 */
export async function ensureConsumptionWipQueued(
  ctx: ConsumptionWipContext
): Promise<string | null> {
  if (!isConsumptionFormSubmittable(ctx)) return null

  await initOfflineClient()

  const staging = await offlineClient.getDieselConsumptionStagingPhoto()
  if (!staging?.blob) return null

  const { resolveDieselTransactionPlantId } = await import(
    "@/lib/diesel/submit-scope-validation"
  )
  const plantIdForTx = resolveDieselTransactionPlantId(
    ctx.selectedPlant,
    ctx.selectedWarehouse,
    ctx.warehouses,
    ctx.allBuWarehouses
  )
  if (!plantIdForTx) return null

  const wipId = ctx.wipOutboxId ?? crypto.randomUUID()

  const transactionData = buildConsumptionTransactionData({
    plantIdForTx,
    selectedWarehouse: ctx.selectedWarehouse,
    productId: ctx.productId,
    assetType: ctx.assetType,
    selectedAsset: ctx.selectedAsset,
    exceptionAssetName: ctx.exceptionAssetName,
    quantityLiters: ctx.quantityLiters,
    cuentaLitros: ctx.cuentaLitros,
    previousCuentaLitros: ctx.previousCuentaLitros,
    cuentaLitrosVariance: ctx.cuentaLitrosVariance,
    readings: ctx.readings,
    transactionDate: ctx.transactionDate,
    transactionTime: ctx.transactionTime,
    notes: ctx.notes,
    userId: ctx.userId,
  })

  await offlineClient.enqueueDieselTransaction(transactionData, {
    id: wipId,
    photoBlob: staging.blob,
    evidenceType: "consumption",
    category: "machine_display",
    description: `Display de la máquina - ${ctx.quantityLiters}L | Cuenta litros: ${ctx.cuentaLitros}L`,
    metadata: ctx.machineEvidenceMetadata
      ? sanitizeValueForPostgresJsonb(ctx.machineEvidenceMetadata)
      : undefined,
  })

  return wipId
}

export function buildConsumptionDraftSnapshot(
  ctx: ConsumptionWipContext & {
    selectedBusinessUnit: string | null
    cuentaLitrosManuallyEdited: boolean
    wipOutboxId: string | null
  }
): DieselConsumptionDraftData {
  return {
    productType: ctx.productType,
    selectedBusinessUnit: ctx.selectedBusinessUnit,
    selectedPlant: ctx.selectedPlant,
    selectedWarehouse: ctx.selectedWarehouse,
    assetType: ctx.assetType,
    selectedAssetId: ctx.selectedAsset?.id ?? null,
    selectedAssetName: ctx.selectedAsset?.name ?? null,
    exceptionAssetName: ctx.exceptionAssetName,
    quantityLiters: ctx.quantityLiters,
    transactionDate: ctx.transactionDate,
    transactionTime: ctx.transactionTime,
    cuentaLitros: ctx.cuentaLitros,
    cuentaLitrosManuallyEdited: ctx.cuentaLitrosManuallyEdited,
    readings: ctx.readings,
    notes: ctx.notes,
    machinePhotoPreview: null,
    machinePhotoDraftId: ctx.machinePhotoDraftId,
    wipOutboxId: ctx.wipOutboxId,
    savedAt: Date.now(),
  }
}

export async function finalizeQueuedConsumption(
  wipOutboxId: string,
  isOnline: boolean
) {
  await offlineClient.clearDieselConsumptionStagingPhoto()
  await offlineClient.clearDieselConsumptionDraft()
  return submitDurableDieselConsumption({
    transactionData: {},
    quantityLiters: "",
    cuentaLitros: "",
    isOnline,
    existingOutboxId: wipOutboxId,
  })
}

export async function recoverOrphanWipOnMount(
  draft: DieselConsumptionDraftData,
  buildCtx: () => Promise<ConsumptionWipContext | null>
): Promise<string | null> {
  if (!draft.wipOutboxId) return null

  const existing = await offlineClient.listDieselOutboxEntries()
  const stillQueued = existing.some((e) => e.id === draft.wipOutboxId)
  if (stillQueued) {
    void requestSync()
    return draft.wipOutboxId
  }

  const ctx = await buildCtx()
  if (!ctx || !isConsumptionFormSubmittable(ctx)) return null

  const requeued = await ensureConsumptionWipQueued({
    ...ctx,
    wipOutboxId: draft.wipOutboxId,
  })
  return requeued
}
