import { createClient } from "@supabase/supabase-js"
import { db } from "../db"
import type { PhotoEntry } from "../types"

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

function buildStorageFileName(photo: PhotoEntry): string {
  const extension = photo.fileName.split(".").pop() ?? "jpg"
  return `checklist_${photo.checklistId}_item_${photo.itemId}_${Date.now()}.${extension}`
}

export async function uploadPhoto(
  photo: PhotoEntry,
  accessToken?: string
): Promise<void> {
  const supabase = getSupabaseClient(accessToken)
  const fileName = buildStorageFileName(photo)

  const { error: uploadError } = await supabase.storage
    .from("checklist-photos")
    .upload(fileName, photo.blob)

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: urlData } = supabase.storage
    .from("checklist-photos")
    .getPublicUrl(fileName)

  await db.photos.update(photo.id, {
    uploaded: true,
    uploadUrl: urlData.publicUrl,
    uploadError: undefined,
  })
}

async function markPhotoRetry(photo: PhotoEntry, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  await db.photos.update(photo.id, {
    retryCount: photo.retryCount + 1,
    uploadError: message,
  })
}

export async function drainPendingPhotos(accessToken?: string): Promise<number> {
  const pending = await db.photos
    .filter((photo) => !photo.uploaded && photo.retryCount < MAX_PHOTO_RETRIES)
    .toArray()

  let uploaded = 0

  for (const photo of pending) {
    try {
      await uploadPhoto(photo, accessToken)
      uploaded++
    } catch (error) {
      await markPhotoRetry(photo, error)
    }
  }

  return uploaded
}
