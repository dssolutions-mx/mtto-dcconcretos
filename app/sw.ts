import { defaultCache } from "@serwist/next/worker"
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { ExpirationPlugin, NetworkFirst, Serwist } from "serwist"

/** Must match PRECACHE handler below — defaultCache uses its own page caches. */
const CHECKLIST_EXECUTION_CACHE = "checklist-execution-pages"

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
  runtimeCaching: [
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

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; urls?: string[] } | undefined
  if (data?.type !== "PRECACHE" || !Array.isArray(data.urls) || data.urls.length === 0) {
    return
  }

  event.waitUntil(
    caches.open(CHECKLIST_EXECUTION_CACHE).then((cache) =>
      Promise.all(
        data.urls!.map((url) =>
          cache.add(new Request(url, { credentials: "same-origin" })).catch(() => undefined)
        )
      )
    )
  )
})
