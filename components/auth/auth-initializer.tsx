'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'

/**
 * AuthInitializer - Pure Zustand-based auth initialization
 * This replaces the AuthProviderEnhanced context pattern
 */
export function AuthInitializer() {
  const router = useRouter()
  const initRef = useRef(false)
  
  // Get store actions directly
  const { 
    initialize, 
    setUser, 
    setSession, 
    clearAuth,
    isInitialized 
  } = useAuthStore((state) => ({
    initialize: state.initialize,
    setUser: state.setUser,
    setSession: state.setSession,
    clearAuth: state.clearAuth,
    isInitialized: state.isInitialized
  }))

  useEffect(() => {
    if (initRef.current || isInitialized) return
    initRef.current = true

    console.log('🚀 AuthInitializer: Starting Zustand-only initialization')
    
    const supabase = createClient()

    // Initialize auth state immediately with timeout
    console.log('🔄 AuthInitializer: Calling initialize()')
    
    const initPromise = initialize()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Initialization timeout after 8 seconds')), 8000)
    )
    
    Promise.race([initPromise, timeoutPromise]).then(() => {
      console.log('✅ AuthInitializer: Zustand initialization complete')
    }).catch((error) => {
      console.error('❌ AuthInitializer: Initialization failed:', error)
      // Force initialization to complete on timeout
      if (error.message.includes('timeout')) {
        console.log('⚠️ Forcing initialization completion due to timeout')
        useAuthStore.setState({ isInitialized: true, isLoading: false })
      }
    })

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔄 AuthInitializer: Auth event: ${event}`)

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session) {
            console.log('✅ Setting user and session from auth event')
            setUser(session.user)
            setSession(session)
          }
          break

        case 'SIGNED_OUT':
          console.log('🚪 User signed out, clearing auth and redirecting')
          clearAuth()
          router.push('/login')
          break

        case 'USER_UPDATED':
          if (session) {
            console.log('👤 User updated, refreshing user data')
            setUser(session.user)
          }
          break
      }
    })

    return () => {
      console.log('🧹 AuthInitializer: Cleaning up subscription')
      subscription.unsubscribe()
    }
  }, [initialize, setUser, setSession, clearAuth, router, isInitialized])

  // This component doesn't render anything - it just initializes
  return null
} 