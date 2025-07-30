import { User, Session } from '@supabase/supabase-js'
import { type ModulePermissions } from '@/lib/auth/role-permissions'

// User Profile type (matching existing system)
export interface UserProfile {
  id: string
  nombre: string
  apellido: string
  email: string
  role: string
  plant_id: string | null
  business_unit_id: string | null
  can_authorize_up_to: number
  status: string
  employee_code: string | null
  telefono: string | null
  emergency_contact: {
    name?: string | null
    phone?: string | null
  } | null
  plants?: {
    id: string
    name: string
    code: string
    business_unit_id: string
  }
  business_units?: {
    id: string
    name: string
  }
}

// Auth error types
export interface AuthError {
  code: string
  message: string
  source: string
  timestamp: number
}

// Session activity tracking
export interface SessionActivity {
  timestamp: number
  action: string
  source: string
}

// Cache entry structure
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// Metrics tracking
export interface MetricsSummary {
  averageAuthLatency: number
  sessionStability: number
  offlineOperations: number
  failedOperationsCount: number
  cacheHitRate: number
  lastUpdate: number
}

// Auth state interface
export interface AuthState {
  // Core auth data
  user: User | null
  session: Session | null
  profile: UserProfile | null
  
  // Loading states
  isLoading: boolean
  isInitialized: boolean
  
  // Error handling
  error: AuthError | null
  
  // Auth metadata
  lastAuthCheck: number
  authCheckSource: string
}

// Session management state
export interface SessionState {
  activeTokenRefreshTimer: NodeJS.Timeout | null
  tokenExpiryWarningShown: boolean
  sessionStartTime: number | null
  sessionActivity: SessionActivity[]
}

// Cache state
export interface CacheState {
  profileCache: Map<string, CacheEntry<UserProfile>>
  sessionCache: Map<string, CacheEntry<Session>>
  cacheHits: number
  cacheMisses: number
}

// Metrics state
export interface MetricsState {
  authLatency: number[]
  sessionStability: number
  offlineOperations: number
  failedOperationsCount: number
  lastMetricsUpdate: number
}

// Updated offline operation interface to match working implementation
export interface OfflineOperation {
  id: string
  type: 'auth' | 'profile_update' | 'session_refresh' | 'sign_out'
  payload: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

// Updated offline state to match working implementation
export interface OfflineState {
  queue: OfflineOperation[]
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  failedOperations: OfflineOperation[]
}

// Combined store interface
export interface AuthStore extends 
  AuthState, 
  SessionState, 
  CacheState, 
  MetricsState,
  OfflineState {
  
  // Auth actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setError: (error: AuthError | null) => void
  clearAuth: () => void
  updateLastAuthCheck: (source: string) => void
  loadProfile: (userId: string) => Promise<void>
  refreshProfile: () => Promise<void>
  
  // Mobile session recovery
  recoverMobileSession: () => Promise<{ success: boolean; user?: User; error?: string }>
  isMobileDevice: () => boolean
  
  // Password management actions
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  
  // Session actions
  scheduleTokenRefresh: (session: Session) => void
  clearTokenRefreshTimer: () => void
  addSessionActivity: (action: string, source: string) => void
  resetSession: () => void
  isSessionExpiringSoon: () => boolean
  getSessionTimeRemaining: () => number
  
  // Cache actions
  getCachedProfile: (userId: string) => UserProfile | null
  setCachedProfile: (userId: string, profile: UserProfile, ttl?: number) => void
  getCachedSession: (key: string) => Session | null
  setCachedSession: (key: string, session: Session, ttl?: number) => void
  clearCache: () => void
  pruneExpiredCache: () => void
  
  // Metrics actions
  recordAuthLatency: (latency: number) => void
  updateSessionStability: (isStable: boolean) => void
  incrementOfflineOperations: () => void
  incrementFailedOperationsCount: () => void
  getAverageAuthLatency: () => number
  getMetricsSummary: () => MetricsSummary
  getCacheHitRate: () => number
  
  // Updated offline actions to match working implementation
  addToQueue: (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => void
  removeFromQueue: (id: string) => void
  processQueue: () => Promise<void>
  setOnlineStatus: (isOnline: boolean) => void
  incrementRetryCount: (id: string) => void
  clearQueue: () => void
  getQueueStats: () => { pending: number; failed: number; total: number }
} 