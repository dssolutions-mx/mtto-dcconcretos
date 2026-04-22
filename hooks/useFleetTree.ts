'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FleetOrganizeLens, FleetTreeNode } from '@/types/fleet'

export interface FleetTreeResponse {
  lens: FleetOrganizeLens
  nodes: FleetTreeNode[]
  trust_by_asset_id: Record<string, number>
  policies: { field: string; window_days: number | null; severity: string }[]
  conflict_asset_ids: string[]
  asset_count: number
}

export function useFleetTree(lens: FleetOrganizeLens) {
  const [data, setData] = useState<FleetTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/assets/fleet-tree?lens=${encodeURIComponent(lens)}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as FleetTreeResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [lens])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    ...data,
    nodes: data?.nodes ?? [],
    trust_by_asset_id: data?.trust_by_asset_id ?? {},
    conflict_asset_ids: data?.conflict_asset_ids ?? [],
    loading,
    error,
    refresh,
  }
}
