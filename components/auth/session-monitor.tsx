"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

export function SessionMonitor() {
  const { user } = useAuthZustand()
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    // Listen for visibility changes to refresh when tab becomes active after being hidden
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        try {
          // Silently refresh the session when tab becomes active
          await supabase.auth.getSession()
        } catch (error) {
          // Ignore errors - the auth state change listener will handle any real issues
          console.debug('Session refresh on visibility change:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for online events
    const handleOnline = async () => {
      try {
        // Refresh session when coming back online
        await supabase.auth.getSession()
      } catch (error) {
        console.debug('Session refresh on online:', error)
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [user, supabase])

  // This component doesn't render anything
  return null
} 