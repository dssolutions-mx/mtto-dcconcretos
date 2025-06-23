import type { AuthStore } from '@/types/auth-store'
import { createClient } from '@/lib/supabase'
// TEMPORARILY DISABLED: import { createEnhancedClient } from '@/lib/supabase-enhanced'

// Use the main store type
type Store = AuthStore

// Simple debounce utility
function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, wait)
    })
  }
}

// Debounced auth check to prevent race conditions
export const createDebouncedAuthCheck = (store: () => Store) =>
  debounce(
    async (source: string) => {
      const startTime = Date.now()
      const storeInstance = store()

      try {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) throw error

        // Update store with latest user data
        storeInstance.setUser(user)
        storeInstance.updateLastAuthCheck(source)

        // Record successful auth check latency
        const latency = Date.now() - startTime
        storeInstance.recordAuthLatency(latency)
        storeInstance.updateSessionStability(true)

        return { success: true, user }
      } catch (error) {
        console.error(`Auth check failed from ${source}:`, error)
        storeInstance.incrementFailedOperationsCount()
        storeInstance.updateSessionStability(false)
        storeInstance.setError({
          code: 'AUTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : String(error),
          source,
          timestamp: Date.now()
        })

        return { success: false, error }
      }
    },
    100 // 100ms debounce
  )

// Memoized selectors for complex state
export const authSelectors = {
  // Get user with profile in one selector
  getUserWithProfile: (state: Store) => ({
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
  }),

  // Check if fully authenticated
  isFullyAuthenticated: (state: Store) =>
    state.user !== null &&
    state.profile !== null &&
    state.isInitialized &&
    !state.isLoading,

  // Get session info with expiry status
  getSessionInfo: (state: Store) => {
    const session = state.session
    const isExpiringSoon = session?.expires_at
      ? new Date(session.expires_at * 1000).getTime() < Date.now() + 5 * 60 * 1000
      : false

    return {
      session,
      isExpiringSoon,
      isValid: session !== null,
      expiresAt: session?.expires_at
        ? new Date(session.expires_at * 1000)
        : null,
    }
  },

  // Get auth status summary
  getAuthStatusSummary: (state: Store) => ({
    isAuthenticated: state.user !== null,
    hasProfile: state.profile !== null,
    isInitialized: state.isInitialized,
    isLoading: state.isLoading,
    hasError: state.error !== null,
    lastCheck: state.lastAuthCheck,
    source: state.authCheckSource,
  }),

  // Get role and permissions
  getRoleInfo: (state: Store) => {
    if (!state.profile) {
      return {
        role: null,
        canAuthorize: false,
        maxAuthorization: 0,
        isManagement: false,
        canExecuteChecklists: false,
      }
    }

    const { role, can_authorize_up_to } = state.profile
    
    return {
      role,
      canAuthorize: can_authorize_up_to !== null && can_authorize_up_to > 0,
      maxAuthorization: can_authorize_up_to || 0,
      isManagement: ['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO'].includes(role),
      canExecuteChecklists: [
        'OPERADOR',
        'DOSIFICADOR',
        'ENCARGADO_MANTENIMIENTO',
        'JEFE_PLANTA'
      ].includes(role),
    }
  },

  // Get cache performance metrics
  getCacheMetrics: (state: Store) => ({
    cacheHits: state.cacheHits,
    cacheMisses: state.cacheMisses,
    hitRate: state.cacheHits + state.cacheMisses > 0
      ? (state.cacheHits / (state.cacheHits + state.cacheMisses)) * 100
      : 0,
    profileCacheSize: state.profileCache.size,
    sessionCacheSize: state.sessionCache.size,
  }),

  // Get current timestamp for debugging
  getCurrentTimestamp: () => new Date().toISOString(),
}

// Performance monitoring utilities
export class AuthPerformanceMonitor {
  private static instance: AuthPerformanceMonitor
  private measurements: Map<string, number[]> = new Map()
  private thresholds = {
    authCheck: 500, // ms
    sessionRefresh: 1000, // ms
    profileLoad: 300, // ms
  }

  static getInstance(): AuthPerformanceMonitor {
    if (!AuthPerformanceMonitor.instance) {
      AuthPerformanceMonitor.instance = new AuthPerformanceMonitor()
    }
    return AuthPerformanceMonitor.instance
  }

  startMeasurement(operation: string): () => void {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      
      this.recordMeasurement(operation, duration)
      
      // Check against thresholds
      const threshold = this.thresholds[operation as keyof typeof this.thresholds]
      if (threshold && duration > threshold) {
        console.warn(`Slow auth operation detected: ${operation} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`)
      }
    }
  }

  recordMeasurement(operation: string, duration: number): void {
    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, [])
    }
    
    const measurements = this.measurements.get(operation)!
    measurements.push(duration)
    
    // Keep only last 100 measurements
    if (measurements.length > 100) {
      measurements.shift()
    }
  }

  getAverageTime(operation: string): number {
    const measurements = this.measurements.get(operation) || []
    if (measurements.length === 0) return 0
    
    const sum = measurements.reduce((a, b) => a + b, 0)
    return sum / measurements.length
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {}
    
    this.measurements.forEach((measurements, operation) => {
      if (measurements.length > 0) {
        const avg = this.getAverageTime(operation)
        const max = Math.max(...measurements)
        const min = Math.min(...measurements)
        const threshold = this.thresholds[operation as keyof typeof this.thresholds]
        
        report[operation] = {
          average: Math.round(avg * 100) / 100,
          max: Math.round(max * 100) / 100,
          min: Math.round(min * 100) / 100,
          count: measurements.length,
          threshold,
          exceedsThreshold: threshold ? avg > threshold : false,
        }
      }
    })
    
    return report
  }

  reset(): void {
    this.measurements.clear()
  }
}

// Utility to measure auth operations
export function measureAuthOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const monitor = AuthPerformanceMonitor.getInstance()
  const endMeasurement = monitor.startMeasurement(operation)
  
  return fn().finally(() => {
    endMeasurement()
  })
}

// Throttle utility for frequent operations
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean
  
  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    if (!inThrottle) {
      const result = func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
      return result
    }
    return undefined as ReturnType<T>
  } as T
}

// React hook utilities
export function createAuthHook<T>(
  selector: (state: Store) => T,
  equalityFn?: (a: T, b: T) => boolean
) {
  return function useAuthSelector() {
    // This would integrate with your Zustand store
    // The actual implementation would use useAuthStore(selector, equalityFn)
    return selector
  }
}

// Batch updates utility
export class BatchUpdater {
  private updates: Array<() => void> = []
  private timeoutId: NodeJS.Timeout | null = null

  addUpdate(update: () => void): void {
    this.updates.push(update)
    
    if (this.timeoutId === null) {
      this.timeoutId = setTimeout(() => {
        this.flush()
      }, 0) // Next tick
    }
  }

  flush(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    
    const updates = [...this.updates]
    this.updates = []
    
    // Execute all batched updates
    updates.forEach(update => {
      try {
        update()
      } catch (error) {
        console.error('Batched update failed:', error)
      }
    })
  }
} 