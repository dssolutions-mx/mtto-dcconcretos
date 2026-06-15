"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

function waitingWorker(registration: ServiceWorkerRegistration): ServiceWorker | null {
  return registration.waiting ?? null
}

export function SwUpdatePrompt() {
  const [visible, setVisible] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  const applyUpdate = useCallback(() => {
    const worker = registration ? waitingWorker(registration) : null
    if (!worker) return
    worker.postMessage({ type: "SKIP_WAITING" })
    setVisible(false)
  }, [registration])

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      if (waitingWorker(reg) && navigator.serviceWorker.controller) {
        setRegistration(reg)
        setVisible(true)
      }
    }

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      const installing = reg.installing
      if (!installing) return

      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          checkWaiting(reg)
        }
      })
    }

    void navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg)
      checkWaiting(reg)
      reg.addEventListener("updatefound", () => onUpdateFound(reg))
    })

    const interval = window.setInterval(() => {
      void navigator.serviceWorker.ready.then((reg) => {
        void reg.update()
        checkWaiting(reg)
      })
    }, 60 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      window.clearInterval(interval)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg border bg-background p-4 shadow-lg sm:left-auto sm:right-4"
    >
      <p className="text-sm font-medium">Nueva versión disponible</p>
      <Button size="sm" onClick={applyUpdate} className="shrink-0 gap-2">
        <RefreshCw className="h-4 w-4" />
        Recargar
      </Button>
    </div>
  )
}
