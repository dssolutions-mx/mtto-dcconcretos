"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import { subscribeSyncStats } from "@/lib/offline/sync-bridge"
import { useConnectivity } from "@/lib/offline/use-connectivity"
import type { SyncStats as OutboxSyncStats } from "@/lib/offline/types"

interface SyncStats {
  total: number
  synced: number
  pending: number
  failed: number
}

interface UseOfflineSyncReturn {
  isOnline: boolean | undefined
  isSyncing: boolean
  syncStats: SyncStats
  lastSyncTime: Date | null
  sync: () => Promise<void>
  hasPendingSyncs: boolean
  isLoading: boolean
}

/**
 * Backed entirely by the new offline stack (Dexie outbox + sync worker via
 * sync-bridge, connectivity via useConnectivity). This used to drive the legacy
 * `offline-checklist-service`, which created a second source of truth for
 * connectivity and pending counts. Keeping the same return shape means every
 * consumer (checklist-execution, corrective dialog, status widgets) now reports
 * connectivity and pending work from the single new system.
 */
export function useOfflineSync(): UseOfflineSyncReturn {
  const connectivity = useConnectivity()
  const isOnline = connectivity !== "offline"

  const [outbox, setOutbox] = useState<OutboxSyncStats>({ pending: 0, failed: 0, inFlight: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const prevActiveRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return

    let cancelled = false

    void initOfflineClient()

    // Pull an accurate snapshot once on mount (the worker only broadcasts after a
    // drain, so the BroadcastChannel's initial value can be stale).
    void offlineClient
      .getSyncStats()
      .then((stats) => {
        if (!cancelled) {
          setOutbox(stats)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false)
      })

    let unsubscribe: (() => void) | null = null
    try {
      unsubscribe = subscribeSyncStats((stats) => {
        if (cancelled) return
        setOutbox(stats)
        setIsLoading(false)

        const active = stats.pending + stats.inFlight
        if (prevActiveRef.current > 0 && active === 0) {
          setLastSyncTime(new Date())
        }
        prevActiveRef.current = active
      })
    } catch (error) {
      // BroadcastChannel unsupported (older browsers): fall back to the one-time
      // snapshot above. Live updates are lost but counts stay correct on reload.
      console.warn("[offline-v2] live sync stats unavailable:", error)
      setIsLoading(false)
    }

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const sync = useCallback(async () => {
    if (!isOnline) return
    // A manual sync should force-recover stuck work: revive failed/dead-lettered
    // entries (resetting backoff) rather than only draining what's already due.
    if (outbox.failed > 0) {
      await offlineClient.retryFailedSyncs()
    } else {
      await offlineClient.requestSync()
    }
  }, [isOnline, outbox.failed])

  const pending = outbox.pending + outbox.inFlight
  const failed = outbox.failed
  const syncStats: SyncStats = {
    pending,
    failed,
    total: pending + failed,
    synced: 0,
  }

  return {
    isOnline,
    isSyncing: outbox.inFlight > 0,
    syncStats,
    lastSyncTime,
    sync,
    hasPendingSyncs: pending + failed > 0,
    isLoading,
  }
}
