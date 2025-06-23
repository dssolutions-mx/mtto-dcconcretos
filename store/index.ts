import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { AuthStore } from '@/types/auth-store'
import { createAuthSlice } from './slices/auth-slice'
import { createSessionSlice } from './slices/session-slice'
import { createCacheSlice } from './slices/cache-slice'
import { createMetricsSlice } from './slices/metrics-slice'
import { createOfflineSlice } from './slices/offline-slice'

// **SOLUTION: Custom persist options to control what gets persisted**
const persistOptions = {
  name: 'auth-store',
  version: 1,
  // **CRITICAL: Only persist essential data, not sensitive session info**
  partialize: (state: AuthStore) => ({
    user: state.user,
    profile: state.profile,
    lastAuthCheck: state.lastAuthCheck,
    authCheckSource: state.authCheckSource,
    cacheHits: state.cacheHits,
    cacheMisses: state.cacheMisses,
    // Persist offline queue for session management
    queue: state.queue,
    failedOperations: state.failedOperations,
    lastSyncTime: state.lastSyncTime,
    // Don't persist session, timers, or sensitive data
  }),
  migrate: (persistedState: any, version: number) => {
    if (version === 0) {
      // Migration logic for version upgrades
      return { ...persistedState, version: 1 }
    }
    return persistedState
  }
}

// **SOLUTION: Create the store with simplified middleware to avoid TypeScript issues**
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createSessionSlice(...args),
        ...createCacheSlice(...args),
        ...createMetricsSlice(...args),
        ...createOfflineSlice(...args),
      }),
      persistOptions
    ),
    {
      name: 'AuthStore',
      trace: true,
      anonymousActionType: 'action',
    }
  )
)

// Store utilities for non-hook access
export const authStore = {
  getState: useAuthStore.getState,
  setState: useAuthStore.setState,
  subscribe: useAuthStore.subscribe,
  destroy: useAuthStore.destroy,
}

// **SOLUTION: Performance utilities to prevent race conditions**
export const authUtils = {
  // Debounced auth check to prevent concurrent requests
  debouncedAuthCheck: (() => {
    let timeout: NodeJS.Timeout | null = null
    
    return (source: string) => {
      if (timeout) clearTimeout(timeout)
      
      timeout = setTimeout(async () => {
        const startTime = Date.now()
        console.log(`🔍 Debounced auth check from: ${source}`)
        
        try {
          const store = authStore.getState()
          await store.refreshSession()
          
          const latency = Date.now() - startTime
          store.recordAuthLatency(latency)
          store.updateSessionStability(true)
        } catch (error) {
          console.error(`Auth check failed from ${source}:`, error)
          const store = authStore.getState()
          store.incrementFailedOperationsCount()
          store.updateSessionStability(false)
        }
      }, 100) // 100ms debounce
    }
  })(),
  
  // **SOLUTION: Cache cleanup to prevent memory leaks**
  startCacheCleanup: () => {
    const cleanup = () => {
      const store = authStore.getState()
      store.pruneExpiredCache()
    }
    
    // Run cleanup every 5 minutes
    const interval = setInterval(cleanup, 5 * 60 * 1000)
    
    // Return cleanup function
    return () => clearInterval(interval)
  },
  
  // **SOLUTION: Health check for monitoring**
  healthCheck: () => {
    const store = authStore.getState()
    const metrics = store.getMetricsSummary()
    
    const health = {
      isHealthy: 
        metrics.sessionStability > 95 &&
        metrics.averageAuthLatency < 2000 &&
        metrics.cacheHitRate > 70,
      metrics,
      issues: [] as string[]
    }
    
    if (metrics.sessionStability <= 95) {
      health.issues.push(`Low session stability: ${metrics.sessionStability}%`)
    }
    
    if (metrics.averageAuthLatency >= 2000) {
      health.issues.push(`High auth latency: ${metrics.averageAuthLatency}ms`)
    }
    
    if (metrics.cacheHitRate <= 70) {
      health.issues.push(`Low cache hit rate: ${metrics.cacheHitRate}%`)
    }
    
    return health
  }
}

// **SOLUTION: Initialize store cleanup and monitoring**
if (typeof window !== 'undefined') {
  // Start cache cleanup
  authUtils.startCacheCleanup()
  
  // Health check every minute
  setInterval(() => {
    const health = authUtils.healthCheck()
    if (!health.isHealthy) {
      console.warn('🏥 Auth system health issues detected:', health.issues)
    }
  }, 60 * 1000)
} 