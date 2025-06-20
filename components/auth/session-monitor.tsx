"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "./auth-provider"

export function SessionMonitor() {
  const { user } = useAuth()
  const supabase = createClient()
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return

    // Function to refresh the session
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          // Check if it's an expected error (no session)
          if (error.message === 'Auth session missing!' || error.name === 'AuthSessionMissingError') {
            // This is expected if user logged out, stop monitoring
            if (refreshIntervalRef.current) {
              clearInterval(refreshIntervalRef.current)
              refreshIntervalRef.current = null
            }
            return
          }
          console.error('Session refresh error:', error)
          return
        }

        if (session) {
          // Check if session is about to expire (within 5 minutes)
          const expiresAt = session.expires_at
          if (expiresAt) {
            const expiresIn = expiresAt * 1000 - Date.now()
            const fiveMinutes = 5 * 60 * 1000
            
            if (expiresIn < fiveMinutes) {
              // Refresh the session
              const { error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError) {
                // Check if it's because there's no session
                if (refreshError.message === 'Auth session missing!' || refreshError.name === 'AuthSessionMissingError') {
                  // Stop monitoring
                  if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current)
                    refreshIntervalRef.current = null
                  }
                  return
                }
                console.error('Session refresh failed:', refreshError)
              } else {
                console.log('Session refreshed successfully')
              }
            }
          }
        }
      } catch (error) {
        console.error('Session monitor error:', error)
      }
    }

    // Initial check
    refreshSession()

    // Set up periodic checks every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      refreshSession()
    }, 30000)

    // Listen for visibility changes to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('Connection restored, refreshing session...')
      refreshSession()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [user, supabase.auth])

  // This component doesn't render anything
  return null
} 