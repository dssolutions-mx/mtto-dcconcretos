'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'

/**
 * Single source of truth: Supabase onAuthStateChange (including INITIAL_SESSION).
 * Loads profile on sign-in so isAuthenticated (user + profile) is not stuck false.
 */
export function AuthInitializer() {
  useEffect(() => {
    const supabase = createClient()

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const {
        setUser,
        setSession,
        clearAuth,
        loadProfile,
      } = useAuthStore.getState()

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user)
          setSession(session)
          try {
            await loadProfile(session.user.id)
          } catch {
            useAuthStore.setState({ isLoading: false })
          }
          useAuthStore.setState({
            isInitialized: true,
            isLoading: false,
            lastAuthCheck: Date.now(),
            authCheckSource: 'initial-session',
          })
        } else {
          clearAuth()
          useAuthStore.setState({
            isInitialized: true,
            isLoading: false,
            lastAuthCheck: Date.now(),
            authCheckSource: 'initial-session-empty',
          })
        }
        return
      }

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            setUser(session.user)
            setSession(session)
            const prof = useAuthStore.getState().profile
            if (!prof || prof.id !== session.user.id) {
              try {
                await loadProfile(session.user.id)
              } catch {
                useAuthStore.setState({ isLoading: false })
              }
            } else {
              useAuthStore.setState({ isLoading: false })
            }
          }
          break
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
        default:
          break
      }
    })

    return () => {
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  return null
}
