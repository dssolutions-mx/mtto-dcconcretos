"use client"

/**
 * Token refresh and session validation are handled by proxy.ts (getUser) and
 * Supabase autoRefreshToken. Extra getSession() on focus raced onAuthStateChange — removed.
 */
export function SessionMonitor() {
  return null
}
