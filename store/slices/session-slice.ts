import { StateCreator } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { SessionState, SessionActivity, AuthStore } from '@/types/auth-store'

export interface SessionSlice extends SessionState {
  // Session actions
  scheduleTokenRefresh: (session: Session) => void
  clearTokenRefreshTimer: () => void
  addSessionActivity: (action: string, source: string) => void
  resetSession: () => void
  isSessionExpiringSoon: () => boolean
  getSessionTimeRemaining: () => number
}

export const createSessionSlice: StateCreator<
  AuthStore,
  [],
  [],
  SessionSlice
> = (set, get) => ({
  // Initial state
  activeTokenRefreshTimer: null,
  tokenExpiryWarningShown: false,
  sessionStartTime: null,
  sessionActivity: [],

  // Actions
  scheduleTokenRefresh: (session) => {
    // **CRITICAL: Prevents race conditions by clearing existing timers**
    get().clearTokenRefreshTimer()
    
    if (!session.expires_at) return
    
    const expiresAt = new Date(session.expires_at * 1000).getTime()
    const now = Date.now()
    
    // **SOLUTION: Proactive refresh at 75% of token lifetime**
    // This prevents unexpected logouts by refreshing BEFORE expiry
    const timeUntilRefresh = (expiresAt - now) * 0.75
    
    if (timeUntilRefresh > 0) {
      console.log(`📅 Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`)
      
      const timer = setTimeout(async () => {
        console.log('🔄 Proactive token refresh triggered')
        
        // **SOLUTION: Add session activity tracking to prevent concurrent refreshes**
        get().addSessionActivity('proactive_refresh', 'timer')
        
        try {
          await get().refreshSession()
        } catch (error) {
          console.error('Proactive refresh failed:', error)
          get().addSessionActivity('proactive_refresh_failed', 'timer')
        }
      }, timeUntilRefresh)
      
      set({ activeTokenRefreshTimer: timer } as Partial<AuthStore>)
      get().addSessionActivity('refresh_scheduled', 'session_slice')
    }
  },

  clearTokenRefreshTimer: () => {
    const timer = get().activeTokenRefreshTimer
    if (timer) {
      clearTimeout(timer)
      set({ activeTokenRefreshTimer: null } as Partial<AuthStore>)
      get().addSessionActivity('refresh_timer_cleared', 'session_slice')
    }
  },

  addSessionActivity: (action, source) => {
    set((state) => {
      const newActivity: SessionActivity = {
        timestamp: Date.now(),
        action,
        source
      }
      
      // **SOLUTION: Prevent memory leaks by keeping only last 50 activities**
      const activities = [...state.sessionActivity, newActivity]
      if (activities.length > 50) {
        activities.splice(0, activities.length - 50)
      }
      
      return { sessionActivity: activities } as Partial<AuthStore>
    })
  },

  resetSession: () => {
    get().clearTokenRefreshTimer()
    set({
      tokenExpiryWarningShown: false,
      sessionStartTime: null,
      sessionActivity: []
    } as Partial<AuthStore>)
  },

  isSessionExpiringSoon: () => {
    const session = get().session
    if (!session?.expires_at) return false
    
    const expiresAt = new Date(session.expires_at * 1000).getTime()
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
    
    return expiresAt <= fiveMinutesFromNow
  },

  getSessionTimeRemaining: () => {
    const session = get().session
    if (!session?.expires_at) return 0
    
    const expiresAt = new Date(session.expires_at * 1000).getTime()
    const now = Date.now()
    
    return Math.max(0, expiresAt - now)
  }
}) 