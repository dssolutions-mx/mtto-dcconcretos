import type { SyncStats } from "./types"

const SYNC_CHANNEL = "offline-sync"
const FOREGROUND_SYNC_INTERVAL_MS = 2 * 60 * 1000

type DrainMessage = { type: "DRAIN"; accessToken?: string }
type StatsMessage = { type: "STATS"; stats: SyncStats }

let worker: Worker | null = null
let broadcastChannel: BroadcastChannel | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let listenersBound = false
let latestStats: SyncStats = { pending: 0, failed: 0, inFlight: 0 }

function assertClient(): void {
  if (typeof window === "undefined") {
    throw new Error("sync-bridge is only available in the browser")
  }
}

function getBroadcastChannel(): BroadcastChannel {
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL)
  }
  return broadcastChannel
}

function publishStats(stats: SyncStats): void {
  latestStats = stats
  getBroadcastChannel().postMessage({ type: "STATS", stats } satisfies StatsMessage)
}

function getWorker(): Worker | null {
  if (!worker) {
    try {
      worker = new Worker(new URL("../../workers/sync.worker.ts", import.meta.url))
      worker.onmessage = (event: MessageEvent<StatsMessage>) => {
        if (event.data?.type === "STATS") {
          publishStats(event.data.stats)
        }
      }
      worker.onerror = (event) => {
        console.warn("[offline-v2] sync worker error:", event.message)
      }
    } catch (error) {
      console.warn("[offline-v2] could not start sync worker:", error)
      worker = null
    }
  }
  return worker
}

async function resolveAccessToken(): Promise<string | undefined> {
  const { authStore } = await import("@/store")
  const state = authStore.getState()

  if (state.session?.access_token) {
    return state.session.access_token
  }

  await state.refreshSession()
  return authStore.getState().session?.access_token
}

function bindListeners(): void {
  if (listenersBound || typeof window === "undefined") return
  listenersBound = true

  window.addEventListener("online", () => {
    void requestSync()
  })

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void requestSync()
    }
  })

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "DRAIN") {
      void requestSync()
    }
  })

  intervalId = setInterval(() => {
    if (latestStats.pending > 0 || latestStats.failed > 0) {
      void requestSync()
    }
  }, FOREGROUND_SYNC_INTERVAL_MS)

  // Bootstrap drain on startup. The interval above only fires once latestStats
  // shows work, but latestStats stays {0,0,0} until a drain runs — and the
  // online/visibilitychange listeners only fire on a *transition*, not on a fresh
  // load that's already online. Without this, items queued in a previous session
  // wouldn't sync until the user toggled connectivity or enqueued something new.
  // Deferred so it runs after listenersBound is set (no recursion via requestSync).
  setTimeout(() => {
    void requestSync()
  }, 0)
}

export function initSyncBridge(): void {
  assertClient()
  bindListeners()
  getWorker()
}

export async function requestSync(): Promise<void> {
  assertClient()

  initSyncBridge()
  const activeWorker = getWorker()
  if (!activeWorker) return
  const accessToken = await resolveAccessToken()
  const message: DrainMessage = { type: "DRAIN", accessToken }
  activeWorker.postMessage(message)
}

export function getLatestSyncStats(): SyncStats {
  return latestStats
}

export function subscribeSyncStats(
  listener: (stats: SyncStats) => void
): () => void {
  assertClient()
  const channel = getBroadcastChannel()

  const onMessage = (event: MessageEvent<StatsMessage>) => {
    if (event.data?.type === "STATS") {
      listener(event.data.stats)
    }
  }

  channel.addEventListener("message", onMessage)
  listener(latestStats)

  return () => {
    channel.removeEventListener("message", onMessage)
  }
}

export function disposeSyncBridge(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  worker?.terminate()
  worker = null
  broadcastChannel?.close()
  broadcastChannel = null
  listenersBound = false
}
