'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/store'

/**
 * AuthInitializer - Pure Zustand-based auth initialization with offline support
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
    isInitialized,
    setOnlineStatus
  } = useAuthStore((state) => ({
    initialize: state.initialize,
    setUser: state.setUser,
    setSession: state.setSession,
    clearAuth: state.clearAuth,
    isInitialized: state.isInitialized,
    setOnlineStatus: state.setOnlineStatus
  }))

  useEffect(() => {
    if (initRef.current || isInitialized) return
    initRef.current = true

    console.log('🚀 AuthInitializer: Starting Zustand-only initialization with offline support')
    
    // Check if middleware detected offline mode
    const checkOfflineMode = async () => {
      try {
        const response = await fetch('/api/health-check', { method: 'HEAD' })
        const isOfflineMode = response.headers.get('X-Offline-Mode') === 'true'
        const authRequired = response.headers.get('X-Auth-Required') === 'true'
        
        if (isOfflineMode) {
          console.log('📱 AuthInitializer: Offline mode detected from middleware')
          
          if (authRequired) {
            console.log('🔐 AuthInitializer: Checking persisted auth for offline validation')
            
            // Check if we have valid persisted auth
            const currentState = useAuthStore.getState()
            if (currentState.user && currentState.profile) {
              console.log('✅ AuthInitializer: Valid offline auth found, allowing access')
              setOnlineStatus(false)
              
              // Set up offline mode without network calls
              useAuthStore.setState({
                isInitialized: true,
                isLoading: false,
                lastAuthCheck: Date.now(),
                authCheckSource: 'offline-validation'
              })
              return
            } else {
              console.log('❌ AuthInitializer: No valid offline auth, redirecting to login')
              router.push('/login')
              return
            }
          }
        }
      } catch (error) {
        console.log('🌐 AuthInitializer: Health check failed, proceeding with normal init')
      }
      
      // Normal initialization flow
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

      // Set up auth state listener - NO REDIRECTS, only state sync
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`🔄 AuthInitializer: Auth event: ${event}`)

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            if (session) {
              console.log('✅ Syncing user and session from auth event')
              setUser(session.user)
              setSession(session)
            }
            break

          case 'SIGNED_OUT':
            console.log('🚪 User signed out, clearing auth state')
            clearAuth()
            // Let middleware handle redirects
            break

          case 'USER_UPDATED':
            if (session) {
              console.log('👤 User updated, refreshing user data')
              setUser(session.user)
            }
            break
        }
      })

      // Set up offline/online detection
      const handleOnline = () => {
        console.log('🌐 Network restored, updating store')
        setOnlineStatus(true)
      }

      const handleOffline = () => {
        console.log('📱 Network lost, updating store')
        setOnlineStatus(false)
      }

      // Set initial online status
      if (typeof navigator !== 'undefined') {
        setOnlineStatus(navigator.onLine)
      }

      // Add event listeners
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
      }

      return () => {
        console.log('🧹 AuthInitializer: Cleaning up subscription and listeners')
        subscription.unsubscribe()
        
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', handleOnline)
          window.removeEventListener('offline', handleOffline)
        }
      }
    }
    
    checkOfflineMode()
  }, [initialize, setUser, setSession, clearAuth, isInitialized, setOnlineStatus, router])

  // This component doesn't render anything - it just initializes
  return null
} 