/* eslint-disable react-hooks/set-state-in-effect -- initial fetch */
'use client'

import { useCallback, useEffect, useState } from 'react'

/** Global trust % from GET /api/assets/trust (fleet flota). */
export function useTrust() {
  const [globalTrustPct, setGlobalTrustPct] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/assets/trust')
    if (!res.ok) return
    const j = await res.json()
    setGlobalTrustPct(j.global_trust_pct ?? null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { globalTrustPct, refresh }
}
