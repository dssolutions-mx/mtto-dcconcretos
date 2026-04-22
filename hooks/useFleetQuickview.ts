'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type FleetQuickviewPayload = {
  reading: {
    unit: 'hours' | 'kilometers' | 'both' | 'none'
    hours: number | null
    kilometers: number | null
  }
  preventive: {
    next_name: string | null
    next_due_date: string | null
    days_until: number | null
    next_due_unit: 'days'
    interval_value: number | null
    status: 'ok' | 'upcoming' | 'overdue' | 'no_plan'
  }
  incidents: { open_count: number; worst_impact: string | null }
  schedules: { overdue: number; today: number; upcoming: number }
}

const CACHE_MS = 30_000
const cache = new Map<string, { at: number; data: FleetQuickviewPayload }>()

export type UseFleetQuickviewResult = {
  data: FleetQuickviewPayload | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useFleetQuickview(assetId: string | null): UseFleetQuickviewResult {
  const [data, setData] = useState<FleetQuickviewPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async (id: string, force = false) => {
    const now = Date.now()
    const hit = cache.get(id)
    if (!force && hit && now - hit.at < CACHE_MS) {
      setData(hit.data)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/assets/${id}/fleet-quickview`)
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Error')
      cache.set(id, { at: Date.now(), data: j as FleetQuickviewPayload })
      if (mounted.current) setData(j as FleetQuickviewPayload)
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Error')
        setData(null)
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!assetId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    const hit = cache.get(assetId)
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setData(hit.data)
      setError(null)
      return
    }
    load(assetId)
    return () => {
      mounted.current = false
    }
  }, [assetId, load])

  const refresh = useCallback(() => {
    if (assetId) load(assetId, true)
  }, [assetId, load])

  return { data, loading, error, refresh }
}
