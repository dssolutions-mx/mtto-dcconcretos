import { StateCreator } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { CacheState, CacheEntry, UserProfile, AuthStore } from '@/types/auth-store'

export interface CacheSlice extends CacheState {
  // Cache operations
  getCachedProfile: (userId: string) => UserProfile | null
  setCachedProfile: (userId: string, profile: UserProfile, ttl?: number) => void
  getCachedSession: (key: string) => Session | null
  setCachedSession: (key: string, session: Session, ttl?: number) => void
  clearCache: () => void
  pruneExpiredCache: () => void
  getCacheHitRate: () => number
}

export const createCacheSlice: StateCreator<
  AuthStore,
  [],
  [],
  CacheSlice
> = (set, get) => ({
  // Initial state
  profileCache: new Map(),
  sessionCache: new Map(),
  cacheHits: 0,
  cacheMisses: 0,

  // Cache operations
  getCachedProfile: (userId) => {
    const cache = get().profileCache
    const entry = cache.get(userId)
    
    if (!entry) {
      // **SOLUTION: Track cache misses to monitor performance**
      set((state) => ({ cacheMisses: state.cacheMisses + 1 } as Partial<AuthStore>))
      return null
    }
    
    const now = Date.now()
    if (now > entry.timestamp + entry.ttl) {
      // **SOLUTION: Auto-expire stale cache entries**
      set((state) => {
        const newCache = new Map(state.profileCache)
        newCache.delete(userId)
        return { 
          profileCache: newCache, 
          cacheMisses: state.cacheMisses + 1 
        } as Partial<AuthStore>
      })
      return null
    }
    
    // **SOLUTION: Track cache hits for performance monitoring**
    set((state) => ({ cacheHits: state.cacheHits + 1 } as Partial<AuthStore>))
    console.log(`🎯 Cache HIT for profile ${userId}`)
    return entry.data
  },

  setCachedProfile: (userId, profile, ttl = 10 * 60 * 1000) => { // 10 minutes default TTL
    console.log(`💾 Caching profile for ${userId} (TTL: ${ttl/1000}s)`)
    
    set((state) => {
      const newCache = new Map(state.profileCache)
      newCache.set(userId, {
        data: profile,
        timestamp: Date.now(),
        ttl
      })
      return { profileCache: newCache } as Partial<AuthStore>
    })
  },

  getCachedSession: (key) => {
    const cache = get().sessionCache
    const entry = cache.get(key)
    
    console.log(`🔍 Cache check for "${key}":`, entry ? 'HIT' : 'MISS')
    
    if (!entry) {
      set((state) => ({ cacheMisses: state.cacheMisses + 1 } as Partial<AuthStore>))
      return null
    }
    
    const now = Date.now()
    const isExpired = now > entry.timestamp + entry.ttl
    
    if (isExpired) {
      const ageSeconds = Math.round((now - entry.timestamp) / 1000)
      console.log(`⏰ Cache entry "${key}" expired (${ageSeconds}s old)`)
      set((state) => {
        const newCache = new Map(state.sessionCache)
        newCache.delete(key)
        return { 
          sessionCache: newCache, 
          cacheMisses: state.cacheMisses + 1 
        } as Partial<AuthStore>
      })
      return null
    }
    
    const ageSeconds = Math.round((now - entry.timestamp) / 1000)
    console.log(`✅ Cache HIT for "${key}" (${ageSeconds}s old)`)
    set((state) => ({ cacheHits: state.cacheHits + 1 } as Partial<AuthStore>))
    return entry.data
  },

  setCachedSession: (key, session, ttl = 30 * 60 * 1000) => { // 30 minutes default TTL
    console.log(`💾 Caching session "${key}" for ${ttl / 1000}s`)
    set((state) => {
      const newCache = new Map(state.sessionCache)
      newCache.set(key, {
        data: session,
        timestamp: Date.now(),
        ttl
      })
      return { sessionCache: newCache } as Partial<AuthStore>
    })
  },

  clearCache: () => {
    console.log('🧹 Clearing all auth cache')
    set({
      profileCache: new Map(),
      sessionCache: new Map(),
      cacheHits: 0,
      cacheMisses: 0
    } as Partial<AuthStore>)
  },

  pruneExpiredCache: () => {
    const now = Date.now()
    const state = get()
    
    // **SOLUTION: Regular cache cleanup prevents memory leaks**
    let prunedProfiles = 0
    let prunedSessions = 0
    
    set((currentState) => {
      // Prune profiles
      const newProfileCache = new Map(currentState.profileCache)
      for (const [key, entry] of newProfileCache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          newProfileCache.delete(key)
          prunedProfiles++
        }
      }
      
      // Prune sessions
      const newSessionCache = new Map(currentState.sessionCache)
      for (const [key, entry] of newSessionCache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          newSessionCache.delete(key)
          prunedSessions++
        }
      }
      
      if (prunedProfiles > 0 || prunedSessions > 0) {
        console.log(`🧹 Pruned ${prunedProfiles} profiles, ${prunedSessions} sessions from cache`)
      }
      
      return {
        profileCache: newProfileCache,
        sessionCache: newSessionCache
      } as Partial<AuthStore>
    })
  },

  getCacheHitRate: () => {
    const { cacheHits, cacheMisses } = get()
    const total = cacheHits + cacheMisses
    
    if (total === 0) return 0
    
    // **SOLUTION: Monitor cache effectiveness**
    const hitRate = (cacheHits / total) * 100
    return Math.round(hitRate * 100) / 100 // Round to 2 decimal places
  }
}) 