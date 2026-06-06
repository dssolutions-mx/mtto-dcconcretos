import { createClient } from "@supabase/supabase-js"
import { db } from "../db"
import type { AssetCreatePayload, AssetFileEntry, OutboxEntry } from "../types"

const MAX_FILE_RETRIES = 5

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

function asAssetPayload(payload: unknown): AssetCreatePayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid asset payload")
  }
  const data = payload as AssetCreatePayload
  if (!data.data || typeof data.data !== "object") {
    throw new Error("Missing data in asset payload")
  }
  return data
}

async function uploadAssetFile(
  file: AssetFileEntry,
  assetId: string,
  accessToken?: string
): Promise<string> {
  const supabase = getSupabaseClient(accessToken)
  const safeId = assetId.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeFileName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const bucket = file.kind === "photo" ? "asset-photos" : "asset-documents"
  const storagePath =
    file.kind === "photo"
      ? `${safeId}/${Date.now()}-${file.category ?? "general"}-${safeFileName}`
      : `${safeId}/${Date.now()}-${safeFileName}`

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file.blob, {
    contentType: file.blob.type,
    upsert: false,
  })

  if (error) throw new Error(error.message)

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)

  await db.asset_files.update(file.id, {
    uploaded: true,
    uploadUrl: urlData.publicUrl,
    uploadError: undefined,
  })

  return urlData.publicUrl
}

async function ensureFilesUploaded(
  outboxId: string,
  assetId: string,
  accessToken?: string
): Promise<AssetFileEntry[]> {
  const files = await db.asset_files.where("outboxId").equals(outboxId).toArray()

  for (const file of files) {
    if (!file.uploaded) {
      await uploadAssetFile(file, assetId, accessToken)
    }
  }

  return db.asset_files.where("outboxId").equals(outboxId).toArray()
}

export async function syncAssetCreate(
  entry: OutboxEntry,
  accessToken?: string
): Promise<void> {
  const payload = asAssetPayload(entry.payload)
  const assetId = String(payload.data.asset_id ?? payload.data.assetId ?? "unknown")

  const files = await ensureFilesUploaded(entry.id, assetId, accessToken)

  const photoUrls = files
    .filter((file) => file.kind === "photo" && file.uploaded && file.uploadUrl)
    .map((file) => file.uploadUrl!)

  const documentUrls = files
    .filter((file) => file.kind === "document" && file.uploaded && file.uploadUrl)
    .map((file) => file.uploadUrl!)

  const body = {
    ...payload.data,
    photos: photoUrls,
    insurance_documents: documentUrls,
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": entry.id,
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch("/api/assets/register", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Asset sync failed (${response.status}): ${errorText}`)
  }

  for (const file of files) {
    await db.asset_files.delete(file.id)
  }
}

export async function drainPendingAssetFiles(accessToken?: string): Promise<number> {
  const pending = await db.asset_files
    .filter((file) => !file.uploaded && file.retryCount < MAX_FILE_RETRIES)
    .toArray()

  let uploaded = 0

  for (const file of pending) {
    const outboxEntry = await db.outbox.get(file.outboxId)
    const assetId = String(
      (outboxEntry?.payload as AssetCreatePayload | undefined)?.data?.asset_id ?? "unknown"
    )

    try {
      await uploadAssetFile(file, assetId, accessToken)
      uploaded++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await db.asset_files.update(file.id, {
        retryCount: file.retryCount + 1,
        uploadError: message,
      })
    }
  }

  return uploaded
}
