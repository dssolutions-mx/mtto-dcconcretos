'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'

/**
 * AuthInitializer — Zustand auth + offline-aware health check.
 * Effect returns a real cleanup (subscription + listeners) so Strict Mode
 * does not leak duplicate onAuthStateChange handlers or parallel inits.
 */
export function AuthInitializer() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const { setUser, setSession, clearAuth } = useAuthStore.getState()

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session) {
            setUser(session.user)
            setSession(session)
          }
          break
        case 'SIGNED_OUT':
          clearAuth()
          break
        case 'USER_UPDATED':
          if (session) setUser(session.user)
          break
      }
    })

    const handleOnline = () => {
      useAuthStore.getState().setOnlineStatus(true)
    }
    const handleOffline = () => {
      useAuthStore.getState().setOnlineStatus(false)
    }

    if (typeof navigator !== 'undefined') {
      useAuthStore.getState().setOnlineStatus(navigator.onLine)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/health-check', { method: 'HEAD' })
        if (cancelled) return
        const isOfflineMode = response.headers.get('X-Offline-Mode') === 'true'
        const authRequired = response.headers.get('X-Auth-Required') === 'true'

        if (isOfflineMode && authRequired) {
          const currentState = useAuthStore.getState()
          if (currentState.user && currentState.profile) {
            useAuthStore.getState().setOnlineStatus(false)
            useAuthStore.setState({
              isInitialized: true,
              isLoading: false,
              lastAuthCheck: Date.now(),
              authCheckSource: 'offline-validation',
            })
            return
          }
          router.push('/login')
          // Must not return here: skipping initialize() left isInitialized false forever,
          // so after sign-in the dashboard spinner never cleared until a full reload.
        }
      } catch {
        // Health check failed — continue with normal init
      }

      if (cancelled) return

      const initPromise = useAuthStore.getState().initialize()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout after 8 seconds')), 8000)
      )

      try {
        await Promise.race([initPromise, timeoutPromise])
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('timeout')) {
          useAuthStore.setState({ isInitialized: true, isLoading: false })
        }
      }
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [router])

  return null
}
