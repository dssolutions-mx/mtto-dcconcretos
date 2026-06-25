import { createBrowserClient } from "@supabase/ssr"
import {
  hasLaneBDraftData,
  localDraftToServerPayload,
  patchServerDraftWithMerge,
  type LocalChecklistDraftData,
} from "@/lib/checklist/schedule-draft"
import { db } from "./db"
import { migrateLegacyIdbIfNeeded } from "./migrate-legacy-idb"
import { collectSyncStats, MAX_FILE_RETRIES } from "./stats"
import { initSyncBridge, requestSync as bridgeRequestSync } from "./sync-bridge"
import type {
  AssetCreatePayload,
  AssetFileEntry,
  CachedAssetListEntry,
  CachedDieselEntry,
  CachedSchedule,
  CachedTemplate,
  CorrectiveWorkOrderPayload,
  DieselPhotoEntry,
  DieselTransactionPayload,
  DraftEntry,
  OutboxEntry,
  PhotoEntry,
  SyncStats,
  UnresolvedIssueEntry,
} from "./types"

let initPromise: Promise<void> | null = null
const STORAGE_PERSIST_FLAG = "offline_v2_storage_persist_requested"

export const OFFLINE_CHECKLIST_ID_KEY = "offline_checklist_id"
export const OFFLINE_SHELL_PATH = "/checklists/offline-ejecutar"

/** Static shell URL (precached). Pass schedule id via sessionStorage before navigating. */
export function getOfflineExecutionUrl(_scheduleId?: string): string {
  return OFFLINE_SHELL_PATH
}

export function setOfflineChecklistId(scheduleId: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(OFFLINE_CHECKLIST_ID_KEY, scheduleId)
  } catch {
    /* ignore quota / private mode */
  }
}

export function getOfflineChecklistId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(OFFLINE_CHECKLIST_ID_KEY)
  } catch {
    return null
  }
}

/** Full navigation to precached shell (fallback when not already on /checklists). */
export function openOfflineChecklistShell(scheduleId: string): void {
  setOfflineChecklistId(scheduleId)
  window.location.assign(OFFLINE_SHELL_PATH)
}

/** Prefetch heavy execution UI chunk while still online. */
export async function prefetchChecklistExecutionModule(): Promise<void> {
  if (typeof window === "undefined") return
  try {
    await import("@/components/checklists/checklist-execution")
  } catch {
    /* non-fatal */
  }
}

const OFFLINE_SHELL_URLS = ["/checklists/offline-ejecutar", "/checklists"] as const

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
    // Init must ALWAYS resolve. Cache reads (getCachedTemplate, etc.) await this
    // promise via ensureReady(); if migration or the sync worker throws and we let
    // the promise reject, it stays cached as a rejected promise and every future
    // offline read fails — which is exactly what broke "open checklist offline".
    initPromise = (async () => {
      try {
        await migrateLegacyIdbIfNeeded()
      } catch (error) {
        console.warn("[offline-v2] legacy migration failed (continuing):", error)
      }
      try {
        initSyncBridge()
      } catch (error) {
        console.warn("[offline-v2] sync bridge init failed (continuing):", error)
      }
    })()
  }

  return initPromise
}

class OfflineClient {
  private async ensureReady(): Promise<void> {
    await initOfflineClient()
  }

  // ---------------------------------------------------------------------------
  // Corrective work orders (offline enqueue → /generate-corrective-work-order)
  // ---------------------------------------------------------------------------

  async enqueueCorrectiveWorkOrder(
    workOrder: {
      checklistId: string
      issues: unknown[]
      priority: string
      description: string
      asset_id?: string
      asset_name?: string
    },
    id?: string
  ): Promise<string> {
    await this.ensureReady()

    if (!workOrder.checklistId) {
      throw new Error("Invalid checklistId: cannot enqueue offline work order")
    }
    if (!Array.isArray(workOrder.issues) || workOrder.issues.length === 0) {
      throw new Error("Invalid issues: cannot enqueue offline work order")
    }
    if (!workOrder.asset_id) {
      throw new Error("Invalid asset_id: cannot enqueue offline work order")
    }

    const entryId = id ?? crypto.randomUUID()
    const payload: CorrectiveWorkOrderPayload = {
      checklist_id: workOrder.checklistId,
      asset_id: workOrder.asset_id,
      asset_name: workOrder.asset_name,
      items_with_issues: workOrder.issues,
      priority: workOrder.priority,
      description: workOrder.description,
    }
    const entry: OutboxEntry = {
      id: entryId,
      domain: "checklist",
      operation: "work_order",
      payload,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
    }
    await db.outbox.put(entry)
    void requestStoragePersistIfNeeded()
    void bridgeRequestSync()
    return entryId
  }

  // ---------------------------------------------------------------------------
  // Single-asset cache (offline asset detail page)
  // ---------------------------------------------------------------------------

  async cacheAssetData(assetId: string, assetData: unknown): Promise<void> {
    await this.ensureReady()
    await db.cache_assets.put({
      id: `data:${assetId}`,
      assets: [assetData],
      lastUpdated: Date.now(),
    })
    void requestStoragePersistIfNeeded()
  }

  async getCachedAssetData(assetId: string): Promise<unknown | null> {
    await this.ensureReady()
    const cached = await db.cache_assets.get(`data:${assetId}`)
    if (!cached || Date.now() - cached.lastUpdated > 4 * 60 * 60 * 1000) return null
    return cached.assets[0] ?? null
  }

  // ---------------------------------------------------------------------------
  // Unresolved issues (offline-first)
  // ---------------------------------------------------------------------------

  async saveUnresolvedIssues(
    checklistId: string,
    issues: UnresolvedIssueEntry["issues"],
    assetData: { id: string; name: string },
    tempChecklistId?: string
  ): Promise<void> {
    await this.ensureReady()
    const entry: UnresolvedIssueEntry = {
      id: `issues-${checklistId}-${Date.now()}`,
      tempChecklistId,
      checklistId,
      assetId: assetData.id,
      assetName: assetData.name,
      issues,
      timestamp: Date.now(),
      synced: false,
      workOrdersCreated: false,
    }
    await db.unresolved_issues.put(entry)
  }

  async getUnresolvedIssues(): Promise<
    Array<{
      id: string
      checklistId: string
      tempChecklistId?: string
      assetId: string
      assetName: string
      issueCount: number
      timestamp: number
      synced: boolean
    }>
  > {
    await this.ensureReady()
    const issues = await db.unresolved_issues.toArray()
    return issues
      .filter((issue) => !issue.workOrdersCreated)
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((issue) => ({
        id: issue.id,
        checklistId: issue.checklistId,
        tempChecklistId: issue.tempChecklistId,
        assetId: issue.assetId,
        assetName: issue.assetName,
        issueCount: issue.issues.length,
        timestamp: issue.timestamp,
        synced: issue.synced,
      }))
  }

  async getUnresolvedIssueDetails(
    unresolvedId: string
  ): Promise<UnresolvedIssueEntry | undefined> {
    await this.ensureReady()
    return db.unresolved_issues.get(unresolvedId)
  }

  async markIssuesResolved(unresolvedId: string): Promise<void> {
    await this.ensureReady()
    await db.unresolved_issues.update(unresolvedId, { workOrdersCreated: true })
  }

  async removeUnresolvedIssues(unresolvedId: string): Promise<void> {
    await this.ensureReady()
    await db.unresolved_issues.delete(unresolvedId)
  }

  // ---------------------------------------------------------------------------
  // Maintenance: cleanup + debug stats
  // ---------------------------------------------------------------------------

  /** Remove orphaned files, dead-letter outbox entries, and corrupted localStorage keys. */
  async cleanCorruptedData(): Promise<{ indexedDB: number; localStorage: number }> {
    await this.ensureReady()
    let indexedDB = 0

    // Dead-letter outbox entries can no longer be retried — drop non-diesel only.
    // Diesel dead letters are audit-critical; operators must retry or escalate manually.
    const deadLetters = await db.outbox.where("status").equals("dead_letter").toArray()
    for (const entry of deadLetters) {
      if (entry.domain === "diesel") continue
      await db.outbox.delete(entry.id)
      indexedDB++
    }

    // Orphaned blobs whose owning outbox entry is gone.
    const liveOutboxIds = new Set((await db.outbox.toArray()).map((e) => e.id))

    const dieselPhotos = await db.diesel_photos.toArray()
    for (const photo of dieselPhotos) {
      if (!liveOutboxIds.has(photo.outboxId)) {
        await db.diesel_photos.delete(photo.id)
        indexedDB++
      }
    }

    const assetFiles = await db.asset_files.toArray()
    for (const file of assetFiles) {
      if (!liveOutboxIds.has(file.outboxId)) {
        await db.asset_files.delete(file.id)
        indexedDB++
      }
    }

    const checklistPhotos = await db.photos.toArray()
    for (const photo of checklistPhotos) {
      if (!photo.checklistId || !photo.itemId) {
        await db.photos.delete(photo.id)
        indexedDB++
      }
    }

    let localStorageCleaned = 0
    if (typeof window !== "undefined") {
      const keys = Object.keys(localStorage).filter(
        (key) =>
          key.startsWith("offline-work-orders-") ||
          key.startsWith("checklist-draft-") ||
          key.startsWith("unresolved-issues-")
      )
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "{}")
          if (!data || Object.keys(data).length === 0) {
            localStorage.removeItem(key)
            localStorageCleaned++
          }
        } catch {
          localStorage.removeItem(key)
          localStorageCleaned++
        }
      }
    }

    return { indexedDB, localStorage: localStorageCleaned }
  }

  /** Prune stale caches and synced blobs older than 30 days. Returns items removed. */
  async cleanOldData(): Promise<number> {
    await this.ensureReady()
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    let cleaned = 0

    const pruneCache = async (
      table: { toArray: () => Promise<Array<{ id: string; lastUpdated: number }>>; delete: (id: string) => Promise<void> }
    ) => {
      const rows = await table.toArray()
      for (const row of rows) {
        if (row.lastUpdated < cutoff) {
          await table.delete(row.id)
          cleaned++
        }
      }
    }

    await pruneCache(db.cache_templates)
    await pruneCache(db.cache_schedules)
    await pruneCache(db.cache_diesel)
    await pruneCache(db.cache_assets)

    // Uploaded blobs that have already synced are safe to discard.
    const uploadedPhotos = await db.photos.filter((p) => p.uploaded).toArray()
    for (const photo of uploadedPhotos) {
      await db.photos.delete(photo.id)
      cleaned++
    }

    // Resolved unresolved-issue records.
    const resolved = await db.unresolved_issues.filter((i) => i.workOrdersCreated).toArray()
    for (const issue of resolved) {
      await db.unresolved_issues.delete(issue.id)
      cleaned++
    }

    return cleaned
  }

  /** Aggregated counts for the offline debug console. */
  async getOfflineDebugStats(): Promise<{
    pendingChecklists: number
    pendingPhotos: number
    pendingWorkOrders: number
    failedItems: number
    totalCacheSize: number
  }> {
    await this.ensureReady()
    const outbox = await db.outbox.toArray()
    const isActive = (s: OutboxEntry["status"]) => s === "pending" || s === "in_flight"

    const pendingChecklists = outbox.filter(
      (e) => e.domain === "checklist" && e.operation === "complete" && isActive(e.status)
    ).length
    const pendingWorkOrders = outbox.filter(
      (e) => e.domain === "checklist" && e.operation === "work_order" && isActive(e.status)
    ).length
    const failedItems = outbox.filter(
      (e) => e.status === "failed" || e.status === "dead_letter"
    ).length

    const [checklistPhotos, dieselPhotos, assetFiles] = await Promise.all([
      db.photos.filter((p) => !p.uploaded).count(),
      db.diesel_photos.filter((p) => !p.uploaded).count(),
      db.asset_files.filter((f) => !f.uploaded).count(),
    ])

    let totalCacheSize = 0
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const { usage = 0 } = await navigator.storage.estimate()
        totalCacheSize = usage
      } catch {
        /* estimate unsupported */
      }
    }

    return {
      pendingChecklists,
      pendingPhotos: checklistPhotos + dieselPhotos + assetFiles,
      pendingWorkOrders,
      failedItems,
      totalCacheSize,
    }
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
    if (navigator.onLine) {
      void this.precacheExecutionRoutes([scheduleId])
    }
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
          plant_id,
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
    await prefetchChecklistExecutionModule()
    await this.precacheOfflineShell()
    return cached
  }

  async precacheExecutionRoutes(_scheduleIds: string[]): Promise<void> {
    await this.precacheOfflineShell()
  }

  /**
   * Verify the static offline shell pages are reachable while online. These URLs are
   * warmed by the service worker at install (handleRequest) and by client fetch here —
   * we only confirm they're reachable and report status to the user.
   */
  async precacheOfflineShell(): Promise<boolean> {
    if (typeof window === "undefined" || !navigator.onLine) return false

    const results = await Promise.all(
      OFFLINE_SHELL_URLS.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: "same-origin", cache: "reload" })
          return response.ok
        } catch {
          return false
        }
      })
    )
    return results.every(Boolean)
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

    // Drop the cached blank template + draft for this schedule so a checklist
    // completed offline can't reappear in the offline list and be submitted a
    // second time (which would enqueue a duplicate completion with a different
    // idempotency key). The submission itself lives safely in the outbox.
    const scheduleId =
      payload && typeof payload === "object"
        ? (payload as { schedule_id?: string; scheduleId?: string }).schedule_id ??
          (payload as { scheduleId?: string }).scheduleId
        : undefined
    if (scheduleId) {
      await db.cache_templates.delete(scheduleId)
      await db.drafts.delete(scheduleId)
    }

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

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void this.syncServerDraftFromLocal(scheduleId, data)
    }

    return draftId
  }

  /** Push Lane B fields from a local Dexie draft to the server when online. */
  private async syncServerDraftFromLocal(
    scheduleId: string,
    data: unknown
  ): Promise<void> {
    const draftPayload = localDraftToServerPayload(data)
    if (!hasLaneBDraftData(draftPayload)) return

    const local = data as LocalChecklistDraftData
    const clientUpdatedAt =
      local.serverDraftUpdatedAt ?? undefined

    try {
      const result = await patchServerDraftWithMerge(scheduleId, data, {
        clientUpdatedAt,
      })

      if (result.ok) {
        const existing = await db.drafts.get(scheduleId)
        if (existing?.data && typeof existing.data === "object") {
          await db.drafts.put({
            ...existing,
            data: {
              ...(existing.data as LocalChecklistDraftData),
              serverDraftUpdatedAt: result.draft_updated_at,
              securityData:
                result.draft_payload.security_data ??
                (existing.data as LocalChecklistDraftData).securityData,
              plantOperationsData:
                result.draft_payload.plant_operations_data ??
                (existing.data as LocalChecklistDraftData).plantOperationsData,
            },
            updatedAt: Date.now(),
          })
        }
        return
      }

      if (result.status !== 409) {
        console.warn(
          "[offline-client] server draft sync failed:",
          result.status
        )
      }
    } catch (error) {
      console.warn("[offline-client] server draft sync error:", error)
    }
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

  async getAvailableOfflineChecklists(): Promise<
    Array<{
      id: string
      template: unknown
      asset: unknown
      lastUpdated: number
      isRecent: boolean
    }>
  > {
    await this.ensureReady()
    const cached = await db.cache_templates.toArray()
    return cached
      .filter((item) => {
        const schedule = item.template as { status?: string; checklists?: unknown } | null
        return schedule?.checklists && schedule.status !== "completed" && schedule.status !== "cancelado"
      })
      .map((item) => ({
        id: item.id,
        template: item.template,
        asset: item.asset,
        lastUpdated: item.lastUpdated,
        isRecent: Date.now() - item.lastUpdated < 24 * 60 * 60 * 1000,
      }))
  }

  async getCachedTemplateCount(): Promise<number> {
    await this.ensureReady()
    return db.cache_templates.count()
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
    return collectSyncStats()
  }

  async requestSync(): Promise<void> {
    await bridgeRequestSync()
  }

  /**
   * Revive entries the automatic retry loop has given up on. "failed" entries are
   * still drained on their backoff schedule, but "dead_letter" entries (>= MAX_SYNC_ATTEMPTS)
   * are terminal and the worker never touches them again. This resets both back to a
   * clean "pending" state (attempts cleared, backoff cleared) and kicks off a sync,
   * giving operators a manual recovery path instead of a permanently stuck badge.
   * Returns the number of entries revived.
   */
  async retryFailedSyncs(): Promise<number> {
    await this.ensureReady()
    const now = Date.now()

    const revivedOutbox = await db.outbox
      .where("status")
      .anyOf(["failed", "dead_letter"])
      .modify({ status: "pending", attemptCount: 0, nextAttemptAt: now, lastError: undefined })

    // Also revive file uploads that exhausted their retry cap, otherwise the
    // failed photos/documents folded into the badge would be unreachable.
    let revivedFiles = 0
    for (const table of [db.photos, db.diesel_photos, db.asset_files]) {
      revivedFiles += await table
        .filter((entry) => {
          const e = entry as unknown as { uploaded: boolean; retryCount?: number }
          return !e.uploaded && (e.retryCount ?? 0) >= MAX_FILE_RETRIES
        })
        .modify({ retryCount: 0, uploadError: undefined })
    }

    void bridgeRequestSync()
    return revivedOutbox + revivedFiles
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

  // ---------------------------------------------------------------------------
  // Diesel consumption drafts + staging photos (survive app kill / low memory)
  // ---------------------------------------------------------------------------

  async saveDieselConsumptionDraft(data: unknown): Promise<void> {
    await this.ensureReady()
    await this.saveDraft("diesel-consumption", data, "diesel-consumption-draft")
    void requestStoragePersistIfNeeded()
  }

  async getDieselConsumptionDraft(): Promise<unknown | null> {
    await this.ensureReady()
    const draft = await db.drafts.get("diesel-consumption-draft")
    return draft?.data ?? null
  }

  async clearDieselConsumptionDraft(): Promise<void> {
    await this.ensureReady()
    await db.drafts.delete("diesel-consumption-draft")
  }

  async saveDieselConsumptionStagingPhoto(
    blob: Blob,
    options?: {
      fileName?: string
      evidenceType?: string
      category?: string
      metadata?: unknown
      id?: string
    }
  ): Promise<string> {
    await this.ensureReady()
    const photoId = options?.id ?? crypto.randomUUID()
    const outboxId = "draft:diesel-consumption-photo"

    await db.transaction("rw", db.diesel_photos, async () => {
      const existing = await db.diesel_photos.where("outboxId").equals(outboxId).toArray()
      for (const photo of existing) {
        await db.diesel_photos.delete(photo.id)
      }

      const photo: DieselPhotoEntry = {
        id: photoId,
        outboxId,
        blob,
        fileName: options?.fileName ?? `diesel-consumption-${Date.now()}.jpg`,
        evidenceType: options?.evidenceType ?? "consumption",
        category: options?.category ?? "machine_display",
        metadata: options?.metadata,
        uploaded: false,
        retryCount: 0,
        createdAt: Date.now(),
      }
      await db.diesel_photos.put(photo)
    })

    void requestStoragePersistIfNeeded()
    return photoId
  }

  async getDieselConsumptionStagingPhoto(): Promise<DieselPhotoEntry | undefined> {
    await this.ensureReady()
    const photos = await db.diesel_photos
      .where("outboxId")
      .equals("draft:diesel-consumption-photo")
      .toArray()
    return photos[0]
  }

  async clearDieselConsumptionStagingPhoto(): Promise<void> {
    await this.ensureReady()
    const photos = await db.diesel_photos
      .where("outboxId")
      .equals("draft:diesel-consumption-photo")
      .toArray()
    for (const photo of photos) {
      await db.diesel_photos.delete(photo.id)
    }
  }

  async listDieselOutboxEntries(): Promise<OutboxEntry[]> {
    await this.ensureReady()
    return db.outbox.where("domain").equals("diesel").sortBy("createdAt")
  }

  async retryDieselOutboxEntry(entryId: string): Promise<void> {
    await this.ensureReady()
    const entry = await db.outbox.get(entryId)
    if (!entry || entry.domain !== "diesel") return

    await db.outbox.update(entryId, {
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: Date.now(),
      lastError: undefined,
    })
    void bridgeRequestSync()
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

    if (!transactionData.client_transaction_id) {
      transactionData.client_transaction_id = entryId
    }

    await db.transaction("rw", [db.outbox, db.diesel_photos], async () => {
      const existingEntry = await db.outbox.get(entryId)
      const existingPhotos = await db.diesel_photos.where("outboxId").equals(entryId).toArray()
      for (const oldPhoto of existingPhotos) {
        await db.diesel_photos.delete(oldPhoto.id)
      }

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
        createdAt: existingEntry?.createdAt ?? Date.now(),
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
