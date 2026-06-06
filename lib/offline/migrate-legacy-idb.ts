import { openDB, type IDBPDatabase } from "idb"
import { db } from "./db"
import type {
  AssetCreatePayload,
  AssetFileEntry,
  CachedSchedule,
  CachedTemplate,
  DieselPhotoEntry,
  DieselTransactionPayload,
  OutboxEntry,
  PhotoEntry,
} from "./types"

const MIGRATION_FLAG = "offline_v2_migrated"

async function tryOpenLegacyDb(name: string, version: number): Promise<IDBPDatabase | null> {
  try {
    return await openDB(name, version)
  } catch (error) {
    console.warn(`Could not open legacy DB "${name}":`, error)
    return null
  }
}

async function migrateChecklistsOffline(): Promise<void> {
  const legacyDb = await tryOpenLegacyDb("checklists-offline", 6)
  if (!legacyDb) return

  try {
    if (legacyDb.objectStoreNames.contains("offline-checklists")) {
      const pending = (await legacyDb.getAll("offline-checklists")).filter(
        (item: { synced?: boolean }) => !item.synced
      )

      for (const item of pending) {
        const entry: OutboxEntry = {
          id: item.id,
          domain: "checklist",
          operation: "complete",
          payload: item.data,
          status: item.retryCount >= 5 ? "dead_letter" : "pending",
          attemptCount: item.retryCount ?? 0,
          nextAttemptAt: item.lastAttempt ?? Date.now(),
          lastError: item.error,
          createdAt: item.timestamp ?? Date.now(),
        }
        await db.outbox.put(entry)
      }
    }

    if (legacyDb.objectStoreNames.contains("checklist-templates")) {
      const templates = await legacyDb.getAll("checklist-templates")
      for (const item of templates) {
        const cached: CachedTemplate = {
          id: item.id,
          template: item.template,
          asset: item.asset,
          lastUpdated: item.lastUpdated ?? Date.now(),
        }
        await db.cache_templates.put(cached)
      }
    }

    if (legacyDb.objectStoreNames.contains("checklist-schedules")) {
      const schedules = await legacyDb.getAll("checklist-schedules")
      for (const item of schedules) {
        const cached: CachedSchedule = {
          id: item.id,
          schedules: item.schedules,
          filters: item.filters,
          lastUpdated: item.lastUpdated ?? Date.now(),
        }
        await db.cache_schedules.put(cached)
      }
    }

    if (legacyDb.objectStoreNames.contains("offline-photos")) {
      const photos = (await legacyDb.getAll("offline-photos")).filter(
        (photo: { uploaded?: boolean }) => !photo.uploaded
      )

      for (const photo of photos) {
        const blob = photo.file instanceof Blob ? photo.file : null
        if (!blob) continue

        const entry: PhotoEntry = {
          id: photo.id,
          checklistId: photo.checklistId,
          itemId: photo.itemId,
          blob,
          fileName: photo.fileName,
          uploaded: false,
          uploadUrl: photo.uploadUrl,
          uploadError: photo.uploadError,
          retryCount: photo.retryCount ?? 0,
          createdAt: photo.timestamp ?? Date.now(),
        }
        await db.photos.put(entry)
      }
    }
  } finally {
    legacyDb.close()
  }
}

async function migrateDieselOffline(): Promise<void> {
  const legacyDb = await tryOpenLegacyDb("diesel-offline", 1)
  if (!legacyDb) return

  try {
    if (!legacyDb.objectStoreNames.contains("offline-diesel-transactions")) return

    const pending = (await legacyDb.getAll("offline-diesel-transactions")).filter(
      (item: { synced?: boolean }) => !item.synced
    )

    for (const item of pending) {
      const entry: OutboxEntry = {
        id: item.id,
        domain: "diesel",
        operation: "transaction",
        payload: {
          transactionData: item.transactionData,
        } satisfies DieselTransactionPayload,
        status: item.retryCount >= 5 ? "dead_letter" : "pending",
        attemptCount: item.retryCount ?? 0,
        nextAttemptAt: item.lastAttempt ?? Date.now(),
        lastError: item.error,
        createdAt: item.timestamp ?? Date.now(),
      }
      await db.outbox.put(entry)
    }

    if (legacyDb.objectStoreNames.contains("offline-diesel-photos")) {
      const photos = (await legacyDb.getAll("offline-diesel-photos")).filter(
        (photo: { uploaded?: boolean }) => !photo.uploaded
      )

      for (const photo of photos) {
        const blob = photo.file instanceof Blob ? photo.file : null
        if (!blob) continue

        const dieselPhoto: DieselPhotoEntry = {
          id: photo.id,
          outboxId: photo.transactionId,
          blob,
          fileName: photo.fileName,
          evidenceType: photo.evidenceType,
          category: photo.category,
          uploaded: false,
          uploadUrl: photo.uploadUrl,
          uploadError: photo.uploadError,
          retryCount: photo.retryCount ?? 0,
          createdAt: photo.timestamp ?? Date.now(),
        }
        await db.diesel_photos.put(dieselPhoto)

        const outboxEntry = await db.outbox.get(photo.transactionId)
        if (outboxEntry?.domain === "diesel") {
          const payload = outboxEntry.payload as DieselTransactionPayload
          const photoIds = payload.evidence?.photoIds ?? []
          if (!photoIds.includes(photo.id)) {
            await db.outbox.update(photo.transactionId, {
              payload: {
                ...payload,
                evidence: {
                  evidenceType: photo.evidenceType,
                  category: photo.category,
                  photoIds: [...photoIds, photo.id],
                },
              },
            })
          }
        }
      }
    }
  } finally {
    legacyDb.close()
  }
}

async function migrateAssetsOffline(): Promise<void> {
  const legacyDb = await tryOpenLegacyDb("assets-offline", 1)
  if (!legacyDb) return

  try {
    if (!legacyDb.objectStoreNames.contains("offline-assets")) return

    const pending = (await legacyDb.getAll("offline-assets")).filter(
      (item: { synced?: boolean }) => !item.synced
    )

    for (const item of pending) {
      const photoIds: string[] = []
      const documentIds: string[] = []

      for (const [index, photo] of (item.photos ?? []).entries()) {
        const blob = photo.file instanceof Blob ? photo.file : null
        if (!blob) continue
        const fileId = photo.id ?? `photo-${item.id}-${index}`
        const fileEntry: AssetFileEntry = {
          id: fileId,
          outboxId: item.id,
          kind: "photo",
          blob,
          fileName: photo.file?.name ?? `photo-${index}.jpg`,
          category: photo.category,
          uploaded: false,
          retryCount: 0,
          createdAt: item.timestamp ?? Date.now(),
        }
        await db.asset_files.put(fileEntry)
        photoIds.push(fileId)
      }

      for (const [index, doc] of (item.documents ?? []).entries()) {
        const blob = doc.file instanceof Blob ? doc.file : null
        if (!blob) continue
        const fileId = doc.id ?? `doc-${item.id}-${index}`
        const fileEntry: AssetFileEntry = {
          id: fileId,
          outboxId: item.id,
          kind: "document",
          blob,
          fileName: doc.name ?? doc.file?.name ?? `document-${index}`,
          uploaded: false,
          retryCount: 0,
          createdAt: item.timestamp ?? Date.now(),
        }
        await db.asset_files.put(fileEntry)
        documentIds.push(fileId)
      }

      const payload: AssetCreatePayload = {
        data: item.data,
        photoIds,
        documentIds,
      }

      const entry: OutboxEntry = {
        id: item.id,
        domain: "asset",
        operation: "create",
        payload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: Date.now(),
        createdAt: item.timestamp ?? Date.now(),
      }
      await db.outbox.put(entry)
    }
  } finally {
    legacyDb.close()
  }
}

export async function migrateLegacyIdbIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return
  if (localStorage.getItem(MIGRATION_FLAG) === "true") return

  await migrateChecklistsOffline()
  await migrateDieselOffline()
  await migrateAssetsOffline()

  localStorage.setItem(MIGRATION_FLAG, "true")
}
