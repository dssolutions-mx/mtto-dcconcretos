import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { requestSync } from "@/lib/offline/sync-bridge"
import { waitForOutboxEntry, type OutboxWaitResult } from "@/lib/offline/wait-for-outbox-entry"
import { sanitizeValueForPostgresJsonb } from "@/lib/json/sanitize-for-postgres-jsonb"
import {
  shouldRequireValidationForCuentaLitrosVariance,
} from "@/lib/diesel/cuenta-litros-variance"

export type DurableDieselSubmitResult =
  | { status: "synced"; outboxId: string }
  | { status: "queued"; outboxId: string; waitResult: OutboxWaitResult }
  | { status: "error"; message: string }

export interface DurableDieselConsumptionInput {
  transactionData: Record<string, unknown>
  quantityLiters: string
  cuentaLitros: string
  photoBlob?: Blob
  photoPreviewUrl?: string | null
  evidenceMetadata?: unknown
  isOnline: boolean
  syncWaitMs?: number
  /** When the consumption was already queued (WIP), only run sync — do not re-enqueue. */
  existingOutboxId?: string
  skipCleanup?: boolean
}

async function resolvePhotoBlob(input: DurableDieselConsumptionInput): Promise<Blob | undefined> {
  if (input.photoBlob) return input.photoBlob

  const staging = await offlineClient.getDieselConsumptionStagingPhoto()
  if (staging?.blob) return staging.blob

  if (input.photoPreviewUrl?.startsWith("blob:") || input.photoPreviewUrl?.startsWith("data:")) {
    try {
      const response = await fetch(input.photoPreviewUrl)
      return await response.blob()
    } catch {
      return undefined
    }
  }

  return undefined
}

/**
 * Local-first diesel consumption save: always persists to IndexedDB outbox first,
 * then attempts immediate sync when online.
 */
export async function submitDurableDieselConsumption(
  input: DurableDieselConsumptionInput
): Promise<DurableDieselSubmitResult> {
  await initOfflineClient()

  let outboxId: string

  if (input.existingOutboxId) {
    const existing = await offlineClient.listDieselOutboxEntries()
    if (!existing.some((e) => e.id === input.existingOutboxId)) {
      return {
        status: "error",
        message: "No se encontró el consumo guardado en el dispositivo. Vuelve a capturarlo.",
      }
    }
    outboxId = input.existingOutboxId
  } else {
    const photoBlob = await resolvePhotoBlob(input)
    if (!photoBlob) {
      return {
        status: "error",
        message:
          "No se pudo leer la foto de evidencia. Vuelve a tomarla antes de registrar el consumo.",
      }
    }

    try {
      outboxId = await offlineClient.enqueueDieselTransaction(input.transactionData, {
        photoBlob,
        evidenceType: "consumption",
        category: "machine_display",
        description: `Display de la máquina - ${input.quantityLiters}L | Cuenta litros: ${input.cuentaLitros}L`,
        metadata: input.evidenceMetadata
          ? sanitizeValueForPostgresJsonb(input.evidenceMetadata)
          : undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("QuotaExceeded") || message.includes("quota")) {
        return {
          status: "error",
          message:
            "El almacenamiento del dispositivo está lleno. Libera espacio (caché del navegador o fotos) e intenta de nuevo.",
        }
      }
      throw error
    }

    if (!input.skipCleanup) {
      await offlineClient.clearDieselConsumptionStagingPhoto()
      await offlineClient.clearDieselConsumptionDraft()
    }
  }

  if (!input.isOnline) {
    return { status: "queued", outboxId, waitResult: "timeout" }
  }

  await requestSync()
  const waitResult = await waitForOutboxEntry(outboxId, input.syncWaitMs ?? 45_000)

  if (waitResult === "synced") {
    if (!input.skipCleanup) {
      await offlineClient.clearDieselConsumptionStagingPhoto()
      await offlineClient.clearDieselConsumptionDraft()
    }
    return { status: "synced", outboxId }
  }

  return { status: "queued", outboxId, waitResult }
}

export function buildConsumptionTransactionData(params: {
  plantIdForTx: string
  selectedWarehouse: string
  productId: string
  assetType: "formal" | "exception"
  selectedAsset: { id: string } | null
  exceptionAssetName: string
  quantityLiters: string
  cuentaLitros: string
  previousCuentaLitros: number | null
  cuentaLitrosVariance: number | null
  readings: Record<string, unknown>
  transactionDate: string
  transactionTime: string
  notes: string
  userId: string
}): Record<string, unknown> {
  const quantity = parseFloat(params.quantityLiters)
  const cuenta = params.cuentaLitros ? parseFloat(params.cuentaLitros) : null
  const requiresValidation = shouldRequireValidationForCuentaLitrosVariance(
    params.previousCuentaLitros,
    cuenta,
    quantity
  )

  const transactionData: Record<string, unknown> = {
    plant_id: params.plantIdForTx,
    warehouse_id: params.selectedWarehouse,
    product_id: params.productId,
    transaction_type: "consumption",
    asset_category: params.assetType,
    quantity_liters: quantity,
    cuenta_litros: cuenta,
    operator_id: params.userId,
    transaction_date: new Date(
      `${params.transactionDate}T${params.transactionTime}:00`
    ).toISOString(),
    notes: params.notes || null,
    requires_validation: requiresValidation,
    validation_notes: requiresValidation
      ? `Varianza cuenta litros: ${params.cuentaLitrosVariance?.toFixed(1)}L`
      : null,
    created_by: params.userId,
    source_system: "web_app",
  }

  if (params.assetType === "formal" && params.selectedAsset) {
    transactionData.asset_id = params.selectedAsset.id
    transactionData.horometer_reading = params.readings.hours_reading ?? null
    transactionData.kilometer_reading = params.readings.kilometers_reading ?? null
    transactionData.previous_horometer = null
    transactionData.previous_kilometer = null
  } else if (params.assetType === "exception") {
    transactionData.asset_id = null
    transactionData.exception_asset_name = params.exceptionAssetName.trim()
    transactionData.horometer_reading = null
    transactionData.kilometer_reading = null
    transactionData.previous_horometer = null
    transactionData.previous_kilometer = null
  }

  return transactionData
}

export { DIESEL_CONSUMPTION_PHOTO_DRAFT_OUTBOX } from "@/lib/diesel/diesel-consumption-draft"
