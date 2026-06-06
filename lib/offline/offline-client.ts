import { createBrowserClient } from "@supabase/ssr"
import { db } from "./db"
import { migrateLegacyIdbIfNeeded } from "./migrate-legacy-idb"
import { initSyncBridge, requestSync as bridgeRequestSync } from "./sync-bridge"
import type {
  AssetCreatePayload,
  AssetFileEntry,
  CachedAssetListEntry,
  CachedDieselEntry,
  CachedSchedule,
  CachedTemplate,
  DieselPhotoEntry,
  DieselTransactionPayload,
  DraftEntry,
  OutboxEntry,
  PhotoEntry,
  SyncStats,
} from "./types"

let initPromise: Promise<void> | null = null
const STORAGE_PERSIST_FLAG = "offline_v2_storage_persist_requested"

async function requestStoragePersistIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return
  if (localStorage.getItem(STORAGE_PERSIST_FLAG) === "true") return
  if (!navigator.storage?.persist) return

  try {
    const persisted = await navigator.storage.persist()
    localStorage.setItem(STORAGE_PERSIST_FLAG, "true")
    if (process.env.NODE_ENV === "development") {
      console.info("[offline-v2] storage.persist():", persisted)
    }
  } catch (error) {
    console.warn("[offline-v2] storage.persist() failed:", error)
  }
}

export function initOfflineClient(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  if (!initPromise) {
    initPromise = (async () => {
      await migrateLegacyIdbIfNeeded()
      initSyncBridge()
    })()
  }

  return initPromise
}

class OfflineClient {
  private async ensureReady(): Promise<void> {
    await initOfflineClient()
  }

  async cacheSchedules(schedules: unknown[], filters = "all"): Promise<void> {
    await this.ensureReady()
    const entry: CachedSchedule = {
      id: filters,
      schedules,
      filters,
      lastUpdated: Date.now(),
    }
    await db.cache_schedules.put(entry)
  }

  async cacheTemplate(scheduleId: string, templateData: unknown, assetData?: unknown): Promise<void> {
    await this.ensureReady()
    const entry: CachedTemplate = {
      id: scheduleId,
      template: templateData,
      asset: assetData,
      lastUpdated: Date.now(),
    }
    await db.cache_templates.put(entry)
  }

  async prepareOfflineChecklists(limit = 20): Promise<number> {
    await this.ensureReady()

    if (!navigator.onLine) return 0

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: schedules, error } = await supabase
      .from("checklist_schedules")
      .select(`
        *,
        checklists (
          *,
          checklist_sections (
            *,
            checklist_items (*)
          ),
          equipment_models (
            id,
            name,
            manufacturer,
            maintenance_unit,
            category
          )
        ),
        assets (
          id,
          name,
          asset_id,
          location,
          current_hours,
          current_kilometers
        )
      `)
      .eq("status", "pendiente")
      .limit(limit)

    if (error || !schedules) return 0

    let cached = 0
    for (const schedule of schedules) {
      await this.cacheTemplate(schedule.id, schedule, schedule.assets)
      cached++
    }

    await this.cacheSchedules(schedules, "pendiente")
    return cached
  }

  async precacheExecutionRoutes(scheduleIds: string[]): Promise<void> {
    if (typeof window === "undefined" || scheduleIds.length === 0) return

    const controller = navigator.serviceWorker?.controller
    if (!controller) return

    const urls = scheduleIds.map((id) => `/checklists/ejecutar/${id}`)
    controller.postMessage({ type: "PRECACHE", urls })
  }
  async enqueueChecklistComplete(payload: unknown, id?: string): Promise<string> {
    await this.ensureReady()
    const entryId = id ?? crypto.randomUUID()
    const entry: OutboxEntry = {
      id: entryId,
      domain: "checklist",
      operation: "complete",
      payload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
    }
    await db.outbox.put(entry)
    void bridgeRequestSync()
    return entryId
  }

  async saveDraft(scheduleId: string, data: unknown, id?: string): Promise<string> {
    await this.ensureReady()
    const draftId = id ?? scheduleId
    const draft: DraftEntry = {
      id: draftId,
      scheduleId,
      data,
      updatedAt: Date.now(),
    }
    await db.drafts.put(draft)
    return draftId
  }

  async getDraft(scheduleId: string): Promise<DraftEntry | undefined> {
    await this.ensureReady()
    return db.drafts.get(scheduleId)
  }

  async clearDraft(scheduleId: string): Promise<void> {
    await this.ensureReady()
    await db.drafts.delete(scheduleId)
  }

  async savePhoto(photo: Omit<PhotoEntry, "createdAt" | "uploaded" | "retryCount">): Promise<void> {
    await this.ensureReady()
    await db.photos.put({
      ...photo,
      uploaded: false,
      retryCount: 0,
      createdAt: Date.now(),
    })
    void bridgeRequestSync()
  }

  async getCachedTemplate(scheduleId: string): Promise<CachedTemplate | null> {
    await this.ensureReady()
    const cached = await db.cache_templates.get(scheduleId)
    return cached ?? null
  }

  async getCachedSchedules(filters = "pendiente"): Promise<unknown[] | null> {
    await this.ensureReady()
    const cached = await db.cache_schedules.get(filters)
    if (!cached) return null
    if (Date.now() - cached.lastUpdated > 4 * 60 * 60 * 1000) return null
    return cached.schedules
  }

  async getSyncStats(): Promise<SyncStats> {
    await this.ensureReady()
    const [pending, failed, inFlight] = await Promise.all([
      db.outbox.where("status").equals("pending").count(),
      db.outbox.where("status").equals("failed").count(),
      db.outbox.where("status").equals("in_flight").count(),
    ])
    return { pending, failed, inFlight }
  }

  async requestSync(): Promise<void> {
    await bridgeRequestSync()
  }

  async cacheDieselWarehouse(warehouseId: string, warehouseData: unknown): Promise<void> {
    await this.ensureReady()
    const entry: CachedDieselEntry = {
      id: `warehouse:${warehouseId}`,
      kind: "warehouse",
      data: warehouseData,
      lastUpdated: Date.now(),
    }
    await db.cache_diesel.put(entry)
    void requestStoragePersistIfNeeded()
  }

  async getCachedDieselWarehouse(warehouseId: string): Promise<unknown | null> {
    await this.ensureReady()
    const cached = await db.cache_diesel.get(`warehouse:${warehouseId}`)
    if (!cached || Date.now() - cached.lastUpdated > 60 * 60 * 1000) return null
    return cached.data
  }

  async cacheDieselAssets(plantId: string, assets: unknown[]): Promise<void> {
    await this.ensureReady()
    const entry: CachedDieselEntry = {
      id: `assets:${plantId}`,
      kind: "assets",
      data: assets,
      lastUpdated: Date.now(),
    }
    await db.cache_diesel.put(entry)
    void requestStoragePersistIfNeeded()
  }

  async getCachedDieselAssets(plantId: string): Promise<unknown[] | null> {
    await this.ensureReady()
    const cached = await db.cache_diesel.get(`assets:${plantId}`)
    if (!cached || Date.now() - cached.lastUpdated > 60 * 60 * 1000) return null
    return Array.isArray(cached.data) ? cached.data : null
  }

  async cacheAssetList(listId: string, assets: unknown[]): Promise<void> {
    await this.ensureReady()
    const entry: CachedAssetListEntry = {
      id: listId,
      assets,
      lastUpdated: Date.now(),
    }
    await db.cache_assets.put(entry)
    void requestStoragePersistIfNeeded()
  }

  async getCachedAssetList(listId: string): Promise<unknown[] | null> {
    await this.ensureReady()
    const cached = await db.cache_assets.get(listId)
    if (!cached || Date.now() - cached.lastUpdated > 60 * 60 * 1000) return null
    return cached.assets
  }

  async enqueueDieselTransaction(
    transactionData: Record<string, unknown>,
    options?: {
      photoBlob?: Blob
      fileName?: string
      evidenceType?: string
      category?: string
      description?: string
      metadata?: unknown
      id?: string
    }
  ): Promise<string> {
    await this.ensureReady()
    const entryId = options?.id ?? crypto.randomUUID()
    const photoIds: string[] = []

    await db.transaction("rw", [db.outbox, db.diesel_photos], async () => {
      if (options?.photoBlob) {
        const photoId = crypto.randomUUID()
        const photo: DieselPhotoEntry = {
          id: photoId,
          outboxId: entryId,
          blob: options.photoBlob,
          fileName: options.fileName ?? `diesel-${options.category ?? "evidence"}-${Date.now()}.jpg`,
          evidenceType: options.evidenceType ?? "consumption",
          category: options.category ?? "machine_display",
          metadata: options.metadata,
          uploaded: false,
          retryCount: 0,
          createdAt: Date.now(),
        }
        await db.diesel_photos.put(photo)
        photoIds.push(photoId)
      }

      const payload: DieselTransactionPayload = {
        transactionData,
        evidence: photoIds.length
          ? {
              evidenceType: options?.evidenceType ?? "consumption",
              category: options?.category ?? "machine_display",
              description: options?.description,
              metadata: options?.metadata,
              photoIds,
            }
          : undefined,
      }

      const entry: OutboxEntry = {
        id: entryId,
        domain: "diesel",
        operation: "transaction",
        payload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: Date.now(),
        createdAt: Date.now(),
      }
      await db.outbox.put(entry)
    })

    void requestStoragePersistIfNeeded()
    void bridgeRequestSync()
    return entryId
  }

  async enqueueAssetCreate(
    data: Record<string, unknown>,
    photos: Array<{ file: Blob; category: string; fileName?: string }> = [],
    documents: Array<{ file: Blob; name: string }> = [],
    id?: string
  ): Promise<string> {
    await this.ensureReady()
    const entryId = id ?? crypto.randomUUID()
    const photoIds: string[] = []
    const documentIds: string[] = []

    await db.transaction("rw", [db.outbox, db.asset_files], async () => {
      for (const [index, photo] of photos.entries()) {
        const fileId = crypto.randomUUID()
        const fileEntry: AssetFileEntry = {
          id: fileId,
          outboxId: entryId,
          kind: "photo",
          blob: photo.file,
          fileName: photo.fileName ?? `photo-${index}.jpg`,
          category: photo.category,
          uploaded: false,
          retryCount: 0,
          createdAt: Date.now(),
        }
        await db.asset_files.put(fileEntry)
        photoIds.push(fileId)
      }

      for (const [index, doc] of documents.entries()) {
        const fileId = crypto.randomUUID()
        const fileEntry: AssetFileEntry = {
          id: fileId,
          outboxId: entryId,
          kind: "document",
          blob: doc.file,
          fileName: doc.name ?? `document-${index}`,
          uploaded: false,
          retryCount: 0,
          createdAt: Date.now(),
        }
        await db.asset_files.put(fileEntry)
        documentIds.push(fileId)
      }

      const payload: AssetCreatePayload = {
        data,
        photoIds,
        documentIds,
      }

      const entry: OutboxEntry = {
        id: entryId,
        domain: "asset",
        operation: "create",
        payload,
        status: "pending",
        attemptCount: 0,
        nextAttemptAt: Date.now(),
        createdAt: Date.now(),
      }
      await db.outbox.put(entry)
    })

    void requestStoragePersistIfNeeded()
    void bridgeRequestSync()
    return entryId
  }

  async getDomainSyncStats(
    domain: "checklist" | "diesel" | "asset"
  ): Promise<{ pending: number; failed: number }> {
    await this.ensureReady()
    const [pending, failed] = await Promise.all([
      db.outbox
        .where("domain")
        .equals(domain)
        .filter((entry) => entry.status === "pending")
        .count(),
      db.outbox
        .where("domain")
        .equals(domain)
        .filter((entry) => entry.status === "failed" || entry.status === "dead_letter")
        .count(),
    ])
    return { pending, failed }
  }
}

export const offlineClient = new OfflineClient()
