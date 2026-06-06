"use client"

import { useCallback, useEffect, useState } from "react"

export type ConnectivityState = "online" | "degraded" | "offline"

const HEALTH_CHECK_TIMEOUT_MS = 4000
const POLL_INTERVAL_MS = 30_000

async function probeHealth(): Promise<boolean> {
  if (!navigator.onLine) return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

  try {
    const response = await fetch("/api/health", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export function useConnectivity(): ConnectivityState {
  // Start "online" to keep SSR/hydration stable; the effect below immediately
  // re-evaluates against navigator.onLine + a health probe on mount.
  const [state, setState] = useState<ConnectivityState>("online")

  const evaluate = useCallback(async () => {
    if (!navigator.onLine) {
      setState("offline")
      return
    }

    const healthy = await probeHealth()
    setState(healthy ? "online" : "degraded")
  }, [])

  useEffect(() => {
    void evaluate()

    const onOnline = () => void evaluate()
    const onOffline = () => setState("offline")

    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    const interval = setInterval(() => {
      void evaluate()
    }, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      clearInterval(interval)
    }
  }, [evaluate])

  return state
}
