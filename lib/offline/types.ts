export type OutboxDomain = "checklist" | "diesel" | "asset"

export type OutboxOperation =
  | "complete"
  | "transaction"
  | "create"
  | "work_order"

export type OutboxStatus = "pending" | "in_flight" | "failed" | "dead_letter"

export interface OutboxEntry {
  id: string
  domain: OutboxDomain
  operation: OutboxOperation
  payload: unknown
  status: OutboxStatus
  attemptCount: number
  nextAttemptAt: number
  lastError?: string
  createdAt: number
}

export interface CachedTemplate {
  id: string
  template: unknown
  asset?: unknown
  lastUpdated: number
}

export interface CachedSchedule {
  id: string
  schedules: unknown[]
  filters?: string
  lastUpdated: number
}

export interface PhotoEntry {
  id: string
  checklistId: string
  itemId: string
  blob: Blob
  fileName: string
  uploaded: boolean
  uploadUrl?: string
  uploadError?: string
  retryCount: number
  createdAt: number
}

export interface DraftEntry {
  id: string
  scheduleId: string
  data: unknown
  updatedAt: number
}

export interface SyncStats {
  pending: number
  failed: number
  inFlight: number
}

export interface CachedDieselEntry {
  id: string
  kind: "warehouse" | "assets"
  data: unknown
  lastUpdated: number
}

export interface CachedAssetListEntry {
  id: string
  assets: unknown[]
  lastUpdated: number
}

export interface DieselPhotoEntry {
  id: string
  outboxId: string
  blob: Blob
  fileName: string
  evidenceType: string
  category: string
  metadata?: unknown
  uploaded: boolean
  uploadUrl?: string
  uploadError?: string
  retryCount: number
  createdAt: number
}

export interface AssetFileEntry {
  id: string
  outboxId: string
  kind: "photo" | "document"
  blob: Blob
  fileName: string
  category?: string
  uploaded: boolean
  uploadUrl?: string
  uploadError?: string
  retryCount: number
  createdAt: number
}

export interface DieselTransactionPayload {
  transactionData: Record<string, unknown>
  evidence?: {
    evidenceType: string
    category: string
    description?: string
    metadata?: unknown
    photoIds: string[]
  }
}

export interface AssetCreatePayload {
  data: Record<string, unknown>
  photoIds: string[]
  documentIds: string[]
}

export interface CorrectiveWorkOrderPayload {
  checklist_id: string
  asset_id: string
  asset_name?: string
  items_with_issues: unknown[]
  priority: string
  description: string
}

export interface UnresolvedIssueEntry {
  id: string
  checklistId: string
  tempChecklistId?: string
  assetId: string
  assetName: string
  issues: Array<{
    id: string
    description: string
    notes: string
    photo: string | null
    status: "flag" | "fail"
    sectionTitle?: string
    sectionType?: string
  }>
  timestamp: number
  synced: boolean
  workOrdersCreated: boolean
}
