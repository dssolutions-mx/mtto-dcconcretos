import { createClient } from "@supabase/supabase-js"
import { sanitizeValueForPostgresJsonb } from "@/lib/json/sanitize-for-postgres-jsonb"
import { isPostgresUnicodeJsonError } from "@/lib/diesel/diesel-save-error-message"
import { db } from "../db"
import type { DieselPhotoEntry, DieselTransactionPayload, OutboxEntry } from "../types"

const MAX_PHOTO_RETRIES = 5

function getSupabaseClient(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error("Supabase env vars are not configured")
  }

  return createClient(url, anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  })
}

function asDieselPayload(payload: unknown): DieselTransactionPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid diesel payload")
  }
  const data = payload as DieselTransactionPayload
  if (!data.transactionData || typeof data.transactionData !== "object") {
    throw new Error("Missing transactionData in diesel payload")
  }
  return data
}

async function uploadDieselPhoto(
  photo: DieselPhotoEntry,
  accessToken?: string
): Promise<string> {
  const supabase = getSupabaseClient(accessToken)

  const { error: uploadError } = await supabase.storage
    .from("diesel-evidence")
    .upload(photo.fileName, photo.blob, {
      cacheControl: "3600",
      upsert: true,
    })

  if (uploadError) {
    if (
      uploadError.message?.includes("already exists") ||
      (uploadError as { statusCode?: number }).statusCode === 400
    ) {
      const extension = photo.fileName.split(".").pop() ?? "jpg"
      const retryFileName = `diesel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${extension}`
      const { error: retryError } = await supabase.storage
        .from("diesel-evidence")
        .upload(retryFileName, photo.blob, { cacheControl: "3600", upsert: true })
      if (retryError) throw new Error(retryError.message)

      const { data: urlData } = supabase.storage
        .from("diesel-evidence")
        .getPublicUrl(retryFileName)

      await db.diesel_photos.update(photo.id, {
        uploaded: true,
        uploadUrl: urlData.publicUrl,
        fileName: retryFileName,
        uploadError: undefined,
      })
      return urlData.publicUrl
    }
    throw new Error(uploadError.message)
  }

  const { data: urlData } = supabase.storage
    .from("diesel-evidence")
    .getPublicUrl(photo.fileName)

  await db.diesel_photos.update(photo.id, {
    uploaded: true,
    uploadUrl: urlData.publicUrl,
    uploadError: undefined,
  })

  return urlData.publicUrl
}

export async function drainPendingDieselPhotos(accessToken?: string): Promise<number> {
  const pending = await db.diesel_photos
    .filter((photo) => !photo.uploaded && photo.retryCount < MAX_PHOTO_RETRIES)
    .toArray()

  let uploaded = 0

  for (const photo of pending) {
    try {
      await uploadDieselPhoto(photo, accessToken)
      uploaded++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await db.diesel_photos.update(photo.id, {
        retryCount: photo.retryCount + 1,
        uploadError: message,
      })
    }
  }

  return uploaded
}

export async function syncDieselTransaction(
  entry: OutboxEntry,
  accessToken?: string
): Promise<void> {
  const payload = asDieselPayload(entry.payload)
  const supabase = getSupabaseClient(accessToken)

  const photoIds = payload.evidence?.photoIds ?? []
  const uploadedPhotos = await db.diesel_photos
    .where("outboxId")
    .equals(entry.id)
    .toArray()

  for (const photo of uploadedPhotos) {
    if (!photo.uploaded) {
      await uploadDieselPhoto(photo, accessToken)
    }
  }

  const refreshedPhotos = await db.diesel_photos
    .where("outboxId")
    .equals(entry.id)
    .toArray()

  const evidencePhotos = refreshedPhotos
    .filter((photo) => photo.uploaded && photo.uploadUrl)
    .map((photo) => ({
      url: photo.uploadUrl!,
      evidence_type: photo.evidenceType,
      category: photo.category,
    }))

  if (photoIds.length > 0 && evidencePhotos.length === 0) {
    throw new Error("Diesel evidence photos failed to upload")
  }

  const { data, error } = await supabase
    .from("diesel_transactions")
    .insert([payload.transactionData])
    .select()
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) {
    throw new Error(
      "Sincronización: el servidor no devolvió la fila del movimiento (posible permisos). " +
        "No reintentes en bucle: revisa el historial en línea antes de volver a sincronizar para evitar duplicados."
    )
  }

  const createdBy = payload.transactionData.created_by as string | undefined

  for (const photo of refreshedPhotos.filter((p) => p.uploaded && p.uploadUrl)) {
    const safeMeta = payload.evidence?.metadata ?? photo.metadata ?? null
    const evidenceBase = {
      transaction_id: data.id,
      evidence_type: photo.evidenceType,
      category: photo.category,
      photo_url: photo.uploadUrl,
      description: payload.evidence?.description ?? null,
      created_by: createdBy,
    }

    let { error: evidenceError } = await supabase.from("diesel_evidence").insert({
      ...evidenceBase,
      metadata: safeMeta != null ? sanitizeValueForPostgresJsonb(safeMeta) : null,
    })

    if (evidenceError && isPostgresUnicodeJsonError(evidenceError) && safeMeta != null) {
      ;({ error: evidenceError } = await supabase.from("diesel_evidence").insert({
        ...evidenceBase,
        metadata: null,
      }))
    }

    if (evidenceError) {
      throw new Error(evidenceError.message)
    }
  }

  for (const photo of refreshedPhotos) {
    await db.diesel_photos.delete(photo.id)
  }
}
