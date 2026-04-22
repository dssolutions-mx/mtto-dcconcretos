'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SavedViewConfig, UserSavedView } from '@/types/fleet'

export function useSavedViews() {
  const [views, setViews] = useState<UserSavedView[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assets/saved-views')
      if (!res.ok) {
        setViews([])
        return
      }
      const j = await res.json()
      setViews(j.views ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveView = useCallback(async (name: string, config: SavedViewConfig) => {
    const res = await fetch('/api/assets/saved-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config }),
    })
    if (!res.ok) throw new Error('No se pudo guardar')
    await refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { views, loading, refresh, saveView }
}
