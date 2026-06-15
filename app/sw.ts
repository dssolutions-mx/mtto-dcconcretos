import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist"

/** Must match PRECACHE handler below — defaultCache uses its own page caches. */
const CHECKLIST_EXECUTION_CACHE = "checklist-execution-pages"

/** Warmed at install via handleRequest (runtime NetworkFirst), not PrecacheStrategy. */
const OFFLINE_ROUTES = ["/checklists", "/checklists/offline-ejecutar"] as const

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  precacheOptions: {
    cleanupOutdatedCaches: true,
  },
  runtimeCaching: [
    {
      matcher: /\/_next\/static\/css\/.+\.css$/i,
      handler: new CacheFirst({
        cacheName: "next-static-css-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 365 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.destination === "document" &&
        url.pathname.startsWith("/checklists/ejecutar/"),
      handler: new NetworkFirst({
        cacheName: CHECKLIST_EXECUTION_CACHE,
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 48,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all(
      OFFLINE_ROUTES.map(async (url) => {
        try {
          await serwist.handleRequest({ request: new Request(url), event })
        } catch {
          /* ignore per-url failures */
        }
      })
    )
  )
})

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: string[]; cacheName?: string } | undefined

  if (data?.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }

  if (data?.type !== "PRECACHE" || !Array.isArray(data.urls) || data.urls.length === 0) {
    return
  }

  const cacheName = data.cacheName ?? CHECKLIST_EXECUTION_CACHE

  event.waitUntil(
    caches.open(cacheName).then((cache) =>
      Promise.all(
        data.urls!.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { credentials: "same-origin" }))
            if (response.ok || response.type === "opaque") {
              await cache.put(url, response)
            }
          } catch {
            /* ignore per-url failures */
          }
        })
      )
    )
  )
})
