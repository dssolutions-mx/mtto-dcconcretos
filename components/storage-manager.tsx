'use client'

import { useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

// Last cleanup timestamp key in localStorage
const LAST_CLEANUP_KEY = 'storage-manager-last-cleanup'
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // max once per hour
const STARTUP_DELAY_MS = 8000 // defer to not compete with auth/data loading
const QUOTA_WARNING_THRESHOLD = 0.8 // 80% full triggers emergency cleanup
const STALE_LOCALSTORAGE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/** Keys that accumulate in localStorage and need periodic purging */
const STALE_KEY_PREFIXES = [
  'checklist-id-mapping-',
  'checklist-draft-',
  'offline-work-orders-',
  'unresolved-issues-',
]

function purgeStaleLocalStorageKeys() {
  const now = Date.now()
  const cutoff = now - STALE_LOCALSTORAGE_AGE_MS
  const toDelete: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    if (!STALE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))) continue

    // Keys embed a timestamp suffix (e.g. `checklist-draft-123_1700000000000`)
    // Fall back to deleting anything > 7 days old if we can't parse a timestamp
    const timestampMatch = key.match(/_(\d{13})$/)
    if (timestampMatch) {
      const ts = parseInt(timestampMatch[1], 10)
      if (ts < cutoff) toDelete.push(key)
    } else {
      // No timestamp embedded — safe to clean up unconditionally (these are
      // supposed to be transient)
      toDelete.push(key)
    }
  }

  toDelete.forEach(k => localStorage.removeItem(k))
  if (toDelete.length > 0) {
    console.log(`[StorageManager] Purged ${toDelete.length} stale localStorage keys`)
  }
}

async function runEmergencyCleanup() {
  const { cacheCleanup } = await import('@/lib/services/cache-cleanup')
  await cacheCleanup.fullCacheCleanup()
  console.warn('[StorageManager] Emergency cleanup triggered — storage was >80% full')
}

async function runRoutineCleanup() {
  const now = Date.now()
  const lastStr = localStorage.getItem(LAST_CLEANUP_KEY)
  if (lastStr && now - parseInt(lastStr, 10) < CLEANUP_INTERVAL_MS) return

  localStorage.setItem(LAST_CLEANUP_KEY, String(now))

  // Check quota first — escalate to emergency if near full
  if ('storage' in navigator) {
    try {
      const { usage = 0, quota = 1 } = await navigator.storage.estimate()
      const ratio = usage / quota
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StorageManager] Storage: ${(usage / 1024 / 1024).toFixed(1)} MB / ${(quota / 1024 / 1024).toFixed(0)} MB (${(ratio * 100).toFixed(1)}%)`)
      }
      if (ratio > QUOTA_WARNING_THRESHOLD) {
        await runEmergencyCleanup()
        return // emergency cleanup already covers everything
      }
    } catch {
      // navigator.storage.estimate() not supported — proceed with routine cleanup
    }
  }

  // Lazy-import services to avoid pulling them into the server bundle
  const [
    { offlineChecklistService },
    { getOfflineDieselService },
    { offlineAssetService },
    { photoStorageService },
  ] = await Promise.all([
    import('@/lib/services/offline-checklist-service'),
    import('@/lib/services/offline-diesel-service'),
    import('@/lib/services/offline-asset-service'),
    import('@/lib/services/photo-storage-service'),
  ])

  await Promise.allSettled([
    offlineChecklistService.cleanOldData(),
    offlineChecklistService.cleanCorruptedData(),
    getOfflineDieselService().cleanup(),
    offlineAssetService.cleanOldData(),
    photoStorageService.cleanupOldPhotos(),
  ])

  purgeStaleLocalStorageKeys()

  console.log('[StorageManager] Routine cleanup complete')
}

export function StorageManager() {
  const { toast } = useToast()

  useEffect(() => {
    // Handle global QuotaExceededError — can come from any IDB/localStorage write
    function handleStorageError(event: ErrorEvent) {
      const msg = event.message ?? ''
      if (
        msg.includes('QuotaExceededError') ||
        msg.includes('quota') ||
        msg.includes('storage')
      ) {
        runEmergencyCleanup().then(() => {
          toast({
            title: 'Almacenamiento casi lleno',
            description: 'Se liberó espacio automáticamente. Si el problema persiste, ve a Configuración → Limpiar caché.',
            variant: 'destructive',
          })
        })
      }
    }

    window.addEventListener('error', handleStorageError)

    // Startup cleanup (deferred)
    const startupTimer = setTimeout(runRoutineCleanup, STARTUP_DELAY_MS)

    // Re-run when app is resumed after being backgrounded for a while
    let hiddenAt: number | null = null
    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible' && hiddenAt !== null) {
        const awayMs = Date.now() - hiddenAt
        hiddenAt = null
        if (awayMs > 60 * 60 * 1000) {
          // App was backgrounded for >1 hour — run cleanup on resume
          runRoutineCleanup()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(startupTimer)
      window.removeEventListener('error', handleStorageError)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [toast])

  return null
}
