import { StateCreator } from 'zustand'
import { MetricsState, MetricsSummary, AuthStore } from '@/types/auth-store'

export interface MetricsSlice extends MetricsState {
  recordAuthLatency: (latency: number) => void
  updateSessionStability: (isStable: boolean) => void
  incrementOfflineOperations: () => void
  incrementFailedOperationsCount: () => void
  getAverageAuthLatency: () => number
  getMetricsSummary: () => MetricsSummary
}

export const createMetricsSlice: StateCreator<
  AuthStore,
  [],
  [],
  MetricsSlice
> = (set, get) => ({
  // Initial state
  authLatency: [],
  sessionStability: 100, // Start with 100% stability
  offlineOperations: 0,
  failedOperationsCount: 0,
  lastMetricsUpdate: Date.now(),

  // Actions
  recordAuthLatency: (latency) => {
    set((state) => {
      const newLatencies = [...state.authLatency, latency]
      
      // **SOLUTION: Keep only last 100 measurements to prevent memory leaks**
      if (newLatencies.length > 100) {
        newLatencies.splice(0, newLatencies.length - 100)
      }
      
      return {
        authLatency: newLatencies,
        lastMetricsUpdate: Date.now()
      } as Partial<AuthStore>
    })
    
    // **SOLUTION: Alert if latency becomes problematic**
    if (latency > 5000) { // 5 seconds
      console.warn(`⚠️ High auth latency detected: ${latency}ms`)
    }
  },

  updateSessionStability: (isStable) => {
    set((state) => {
      // **SOLUTION: Rolling average for session stability tracking**
      // Heavy weight on historical data to smooth out temporary issues
      const weight = 0.95
      const currentStability = state.sessionStability
      const newStability = currentStability * weight + (isStable ? 100 : 0) * (1 - weight)
      
      return {
        sessionStability: newStability,
        lastMetricsUpdate: Date.now()
      } as Partial<AuthStore>
    })
    
    // **SOLUTION: Early warning system for session instability**
    const currentStability = get().sessionStability
    if (currentStability < 95) {
      console.warn(`⚠️ Session stability degraded: ${currentStability.toFixed(2)}%`)
    }
  },

  incrementOfflineOperations: () => {
    set((state) => ({
      offlineOperations: state.offlineOperations + 1,
      lastMetricsUpdate: Date.now()
    } as Partial<AuthStore>))
  },

  incrementFailedOperationsCount: () => {
    set((state) => {
      const newFailedOps = state.failedOperationsCount + 1
      
      // **SOLUTION: Circuit breaker pattern - alert on too many failures**
      if (newFailedOps % 5 === 0) { // Alert every 5 failures
        console.error(`🚨 Auth failures accumulating: ${newFailedOps} total failures`)
      }
      
      return {
        failedOperationsCount: newFailedOps,
        lastMetricsUpdate: Date.now()
      } as Partial<AuthStore>
    })
  },

  getAverageAuthLatency: () => {
    const latencies = get().authLatency
    if (latencies.length === 0) return 0
    
    const sum = latencies.reduce((a, b) => a + b, 0)
    return Math.round(sum / latencies.length)
  },

  getMetricsSummary: () => {
    const state = get()
    const averageLatency = get().getAverageAuthLatency()
    const cacheHitRate = get().getCacheHitRate()
    
    const summary: MetricsSummary = {
      averageAuthLatency: averageLatency,
      sessionStability: Math.round(state.sessionStability * 100) / 100,
      offlineOperations: state.offlineOperations,
      failedOperationsCount: state.failedOperationsCount,
      cacheHitRate: cacheHitRate,
      lastUpdate: state.lastMetricsUpdate,
    }
    
    // **SOLUTION: Auto-logging of concerning metrics**
    if (summary.sessionStability < 99) {
      console.warn('📊 Session stability below 99%:', summary)
    }
    
    if (summary.averageAuthLatency > 1000) {
      console.warn('📊 High average auth latency:', summary)
    }
    
    if (summary.cacheHitRate < 80) {
      console.warn('📊 Low cache hit rate:', summary)
    }
    
    return summary
  }
}) 