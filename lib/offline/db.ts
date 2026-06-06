import Dexie, { type Table } from "dexie"
import type {
  AssetFileEntry,
  CachedAssetListEntry,
  CachedDieselEntry,
  CachedSchedule,
  CachedTemplate,
  DieselPhotoEntry,
  DraftEntry,
  OutboxEntry,
  PhotoEntry,
} from "./types"

class MaintenanceOfflineDB extends Dexie {
  outbox!: Table<OutboxEntry>
  cache_templates!: Table<CachedTemplate>
  cache_schedules!: Table<CachedSchedule>
  cache_diesel!: Table<CachedDieselEntry>
  cache_assets!: Table<CachedAssetListEntry>
  photos!: Table<PhotoEntry>
  diesel_photos!: Table<DieselPhotoEntry>
  asset_files!: Table<AssetFileEntry>
  drafts!: Table<DraftEntry>

  constructor() {
    super("maintenance-offline")
    this.version(1).stores({
      outbox: "id, domain, status, nextAttemptAt, createdAt",
      cache_templates: "id, lastUpdated",
      cache_schedules: "id, lastUpdated",
      photos: "id, checklistId, itemId, uploaded",
      drafts: "id, scheduleId, updatedAt",
    })
    this.version(2).stores({
      outbox: "id, domain, status, nextAttemptAt, createdAt",
      cache_templates: "id, lastUpdated",
      cache_schedules: "id, lastUpdated",
      cache_diesel: "id, kind, lastUpdated",
      cache_assets: "id, lastUpdated",
      photos: "id, checklistId, itemId, uploaded",
      diesel_photos: "id, outboxId, uploaded",
      asset_files: "id, outboxId, kind, uploaded",
      drafts: "id, scheduleId, updatedAt",
    })
  }
}

export const db = new MaintenanceOfflineDB()
