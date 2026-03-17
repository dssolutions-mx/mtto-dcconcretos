"use client"

import { useState, useEffect, useCallback } from 'react'

export interface DashboardPendingActions {
  technicalValidation: number
  viabilityReview: number
  gmApproval: number
}

export function useDashboardPendingActions() {
  const [data, setData] = useState<DashboardPendingActions | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/pending-actions', { cache: 'no-store', credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        setData({
          technicalValidation: json.technicalValidation ?? 0,
          viabilityReview: json.viabilityReview ?? 0,
          gmApproval: json.gmApproval ?? 0,
        })
      } else {
        setData({ technicalValidation: 0, viabilityReview: 0, gmApproval: 0 })
      }
    } catch {
      setData({ technicalValidation: 0, viabilityReview: 0, gmApproval: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, refetch }
}
