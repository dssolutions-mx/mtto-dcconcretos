import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document"
        },
      },
    ],
  },
})

serwist.addEventListeners()

const ROUTE_PRECACHE = "offline-route-precache"

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: string[] } | undefined
  if (data?.type !== "PRECACHE" || !Array.isArray(data.urls) || data.urls.length === 0) {
    return
  }

  event.waitUntil(
    caches.open(ROUTE_PRECACHE).then((cache) =>
      Promise.all(
        data.urls!.map((url) =>
          cache.add(new Request(url, { credentials: "same-origin" })).catch(() => undefined)
        )
      )
    )
  )
})
