"use client"

import { useState, useEffect } from "react"
import type { ExecutiveKPIs } from "@/app/api/dashboard/executive-kpis/route"

export function useExecutiveKPIs() {
  const [data, setData] = useState<ExecutiveKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/dashboard/executive-kpis")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch KPIs")
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
