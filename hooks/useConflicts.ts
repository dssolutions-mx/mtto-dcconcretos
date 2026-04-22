'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FleetConflictRow } from '@/types/fleet'

export function useConflicts() {
  const [conflicts, setConflicts] = useState<FleetConflictRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets/conflicts')
      const j = await res.json()
      setConflicts(j.conflicts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { conflicts, loading, refresh }
}
