import { StateCreator } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { 
  AuthState, 
  UserProfile, 
  AuthError, 
  AuthStore 
} from '@/types/auth-store'

/** One shared initialize at a time (React Strict Mode remounts, duplicate effects). */
let initializeInFlight: Promise<void> | null = null

export interface AuthSlice extends AuthState {
  // Actions
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
}

export const createAuthSlice: StateCreator<
  AuthStore,
  [],
  [],
  AuthSlice
> = (set, get) => ({
  // Initial state
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  error: null,
  lastAuthCheck: 0,
  authCheckSource: 'initial',

  // Mobile session recovery
  recoverMobileSession: async () => {
    console.log('🔄 Mobile session recovery initiated...')
    const startTime = Date.now()
    
    const supabase = createClient()
    
    try {
      // First attempt: try to get user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (user && !userError) {
        console.log('✅ Mobile session recovery: User found on first attempt')
        set({
          user,
          lastAuthCheck: Date.now(),
          authCheckSource: 'mobile-recovery-first'
        } as Partial<AuthStore>)
        return { success: true, user }
      }

      // Second attempt: try to get session
      if (userError?.message?.includes('Auth session missing')) {
        console.log('🔄 Mobile session recovery: Attempting session refresh')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (session?.user && !sessionError) {
          console.log('✅ Mobile session recovery: Session refresh successful')
          set({
            user: session.user,
            session,
            lastAuthCheck: Date.now(),
            authCheckSource: 'mobile-recovery-session'
          } as Partial<AuthStore>)
          return { success: true, user: session.user }
        }
      }

      // Third attempt: try to refresh session
      console.log('🔄 Mobile session recovery: Attempting session refresh')
      const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (session?.user && !refreshError) {
        console.log('✅ Mobile session recovery: Session refresh successful')
        set({
          user: session.user,
          session,
          lastAuthCheck: Date.now(),
          authCheckSource: 'mobile-recovery-refresh'
        } as Partial<AuthStore>)
        return { success: true, user: session.user }
      }

      console.log('❌ Mobile session recovery: All attempts failed')
      return { 
        success: false, 
        error: 'Session recovery failed after all attempts'
      }

    } catch (error) {
      console.error('❌ Mobile session recovery error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  },

  isMobileDevice: () => {
    if (typeof window === 'undefined') return false
    
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  },

  // Actions
  initialize: async () => {
    if (get().isInitialized) {
      console.log('✅ Auth already initialized, skipping')
      return
    }
    if (initializeInFlight) {
      await initializeInFlight
      return
    }

    initializeInFlight = (async () => {
    console.log('🔧 Fast auth initialization...')
    const startTime = Date.now()

    if (get().isInitialized) {
      return
    }

    try {
      // FAST PATH 1: Check persisted state first (most reliable)
      const currentState = get()
      if (currentState.user && currentState.profile) {
        console.log('✅ FAST: Using persisted user data (user + profile)')
        set({
          isInitialized: true,
          isLoading: false,
          lastAuthCheck: Date.now(),
          authCheckSource: 'persisted'
        } as Partial<AuthStore>)
        
        // Try to get session in background
        setTimeout(() => {
          const supabase = createClient()
          supabase.auth.getSession()
            .then(({ data: { session } }) => {
              if (session) {
                get().setCachedSession('current', session, 30 * 60 * 1000)
                set({ session } as Partial<AuthStore>)
              }
            })
            .catch(() => {})
        }, 100)
        
        console.log(`✅ Fast init complete: ${Date.now() - startTime}ms`)
        return
      }
      
      // FAST PATH 2: Check cached session but ensure profile is loaded
      const cachedSession = get().getCachedSession('current')
      if (cachedSession && cachedSession.user) {
        console.log('🎯 FAST: Using cached session')
        
        // Check if we already have profile for this user
        const existingProfile = currentState.profile
        if (existingProfile && existingProfile.id === cachedSession.user.id) {
          console.log('✅ FAST: Profile already exists for cached user')
          set({
            user: cachedSession.user,
            session: cachedSession,
            profile: existingProfile,
            isInitialized: true,
            isLoading: false,
            lastAuthCheck: Date.now(),
            authCheckSource: 'cache-with-profile'
          } as Partial<AuthStore>)
          
          console.log(`✅ Fast init complete: ${Date.now() - startTime}ms`)
          return
        }
        
        // No profile yet, need to load it synchronously
        console.log('⏳ Loading profile for cached user...')
        set({
          user: cachedSession.user,
          session: cachedSession,
          isInitialized: true,
          isLoading: true, // Keep loading true until profile is loaded
          lastAuthCheck: Date.now(),
          authCheckSource: 'cache'
        } as Partial<AuthStore>)
        
        // Load profile synchronously during initialization
        try {
          await get().loadProfile(cachedSession.user.id)
          console.log('✅ Profile loaded during initialization')
        } catch (profileError) {
          console.error('❌ Profile loading failed during initialization:', profileError)
          // Don't fail initialization, but set loading to false
          set({ isLoading: false } as Partial<AuthStore>)
        }
        
        console.log(`✅ Fast init complete: ${Date.now() - startTime}ms`)
        return
      }
      
      // SLOW PATH: No cache, need fresh data - but with shorter timeout
      console.log('🌐 No cache, fetching fresh session...')
      const supabase = createClient()
      
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session fetch timeout')), 12000)
      )
      
      try {
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any
        
        if (session?.user) {
          console.log('✅ Fresh session obtained')
          get().setCachedSession('current', session, 30 * 60 * 1000)
          
          set({
            user: session.user,
            session: session,
            isInitialized: true,
            isLoading: true, // Keep loading true until profile is loaded
            lastAuthCheck: Date.now(),
            authCheckSource: 'fresh'
          } as Partial<AuthStore>)
          
          // Load profile synchronously during initialization
          try {
            await get().loadProfile(session.user.id)
            console.log('✅ Profile loaded during fresh session initialization')
          } catch (profileError) {
            console.error('❌ Profile loading failed during fresh session initialization:', profileError)
            // Don't fail initialization, but set loading to false
            set({ isLoading: false } as Partial<AuthStore>)
          }
        } else {
          console.log('ℹ️ No session found')
          set({
            isInitialized: true,
            isLoading: false,
            lastAuthCheck: Date.now(),
            authCheckSource: 'no-session'
          } as Partial<AuthStore>)
        }
      } catch (fetchError) {
        console.log('⚠️ Session fetch failed, completing initialization anyway')
        set({
          isInitialized: true,
          isLoading: false,
          lastAuthCheck: Date.now(),
          authCheckSource: 'fetch-error',
          error: {
            code: 'INIT_ERROR',
            message: 'Session fetch timeout',
            source: 'initialize',
            timestamp: Date.now()
          }
        } as Partial<AuthStore>)
      }
      
      const latency = Date.now() - startTime
      get().recordAuthLatency(latency)
      console.log(`✅ Initialization complete: ${latency}ms`)
      
    } catch (error: any) {
      console.error('❌ Auth initialization error:', error)
      
      set({
        error: {
          code: 'INIT_ERROR',
          message: error.message || 'Initialization failed',
          source: 'initialize',
          timestamp: Date.now()
        },
        isLoading: false
      } as Partial<AuthStore>)
    }
    })()

    try {
      await initializeInFlight
    } finally {
      initializeInFlight = null
    }
  },

  signIn: async (email, password) => {
    console.log('🔐 Attempting sign in...')
    const startTime = Date.now()
    
    set({ isLoading: true } as Partial<AuthStore>)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ Sign in successful')
      
      if (data.session) {
        // Cache the new session with longer TTL
        get().setCachedSession('current', data.session, 30 * 60 * 1000) // 30 minutes
      }

      set({
        user: data.user,
        session: data.session,
        error: null,
        lastAuthCheck: Date.now(),
        authCheckSource: 'signIn'
      } as Partial<AuthStore>)

      if (data.user) {
        try {
          await get().loadProfile(data.user.id)
          console.log('✅ Profile loaded after sign in')
          
          set({
            isLoading: false,
            isInitialized: true,
          } as Partial<AuthStore>)
        } catch (profileError) {
          console.error('❌ Profile loading failed after sign in:', profileError)
          
          // If profile loading fails, sign out the user
          console.log('🚪 Signing out due to profile loading failure')
          get().clearAuth()
          
          return { 
            success: false, 
            error: 'No se pudo cargar el perfil del usuario. Por favor contacte al administrador.' 
          }
        }
      } else {
        set({ isLoading: false, isInitialized: true } as Partial<AuthStore>)
      }
      
      const latency = Date.now() - startTime
      get().recordAuthLatency(latency)
      get().updateSessionStability(true)

      return { success: true }
    } catch (error: any) {
      console.error('❌ Sign in error:', error)
      
      // Check if we're offline and should queue the operation
      const isOffline = !get().isOnline
      if (isOffline) {
        console.log('📱 Device is offline, queueing sign in operation')
        get().addToQueue({
          type: 'auth',
          payload: { action: 'signIn', email, password },
          maxRetries: 3
        })
        
        set({
          error: {
            code: 'OFFLINE_SIGNIN',
            message: 'Sin conexión. El inicio de sesión se procesará cuando vuelva la conectividad.',
            source: 'signIn',
            timestamp: Date.now()
          },
          isLoading: false
        } as Partial<AuthStore>)
        
        return { 
          success: false, 
          error: 'Sin conexión. El inicio de sesión se procesará automáticamente cuando vuelva la conectividad.' 
        }
      }
      
      get().incrementFailedOperationsCount()
      get().updateSessionStability(false)
      
      set({
        error: {
          code: 'SIGNIN_ERROR',
          message: error.message || 'Failed to sign in',
          source: 'signIn',
          timestamp: Date.now()
        },
        isLoading: false
      } as Partial<AuthStore>)
      
      return { success: false, error: error.message || 'Failed to sign in' }
    }
  },

  signOut: async () => {
    console.log('🚪 Starting comprehensive sign out process...')
    set({ isLoading: true } as Partial<AuthStore>)

    const supabase = createClient()
    const isOffline = !get().isOnline

    const clearClientStorage = () => {
      if (typeof window === 'undefined') return
      try {
        localStorage.clear()
        sessionStorage.clear()
        console.log('🗑️ Cleared browser storage')
      } catch (storageError) {
        console.warn('⚠️ Failed to clear browser storage:', storageError)
      }
    }

    try {
      if (isOffline) {
        console.log('📱 Device is offline, queueing sign out operation')
        get().clearAuth()
        clearClientStorage()
        get().addToQueue({
          type: 'sign_out',
          payload: { action: 'signOut' },
          maxRetries: 2,
        })
        if (typeof window !== 'undefined') {
          console.log('🔄 Forcing hard redirect to login (offline)')
          window.location.href = '/login'
        }
        return
      }

      // Revoke Supabase session before wiping storage; clearing localStorage first breaks
      // token/cookie cleanup and leaves stale sb-* cookies that fight the proxy + /login.
      const signOutPromise = supabase.auth.signOut({ scope: 'global' })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      )

      try {
        const { error } = (await Promise.race([signOutPromise, timeoutPromise])) as {
          error?: { message?: string } | null
        }
        if (error) {
          console.warn('⚠️ Supabase sign out error:', error.message)
        } else {
          console.log('✅ Supabase sign out successful')
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn('⚠️ Supabase sign out timeout or failure (continuing local cleanup):', msg)
      }

      get().clearAuth()
      clearClientStorage()

      if (typeof window !== 'undefined') {
        console.log('🔄 Forcing hard redirect to login')
        window.location.href = '/login'
      }
    } catch (error: unknown) {
      console.error('❌ Sign out error:', error)
      get().clearAuth()
      clearClientStorage()

      const message = error instanceof Error ? error.message : 'Failed to sign out'
      set({
        error: {
          code: 'SIGNOUT_ERROR',
          message,
          source: 'signOut',
          timestamp: Date.now(),
        },
        isLoading: false,
      } as Partial<AuthStore>)

      if (typeof window !== 'undefined') {
        console.log('🔄 Forcing hard redirect to login (error recovery)')
        window.location.href = '/login'
      }
    }
  },

  refreshSession: async () => {
    console.log('🔄 Refreshing session...')
    const startTime = Date.now()
    
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) throw error
      
      if (data.session) {
        console.log('✅ Session refreshed successfully')
        
        // Cache the refreshed session with longer TTL
        get().setCachedSession('current', data.session, 30 * 60 * 1000) // 30 minutes
        
        set({
          user: data.user,
          session: data.session,
          lastAuthCheck: Date.now(),
          authCheckSource: 'refresh'
        } as Partial<AuthStore>)
        
        const latency = Date.now() - startTime
        get().recordAuthLatency(latency)
        get().updateSessionStability(true)
      }
    } catch (error: any) {
      console.error('❌ Session refresh error:', error)
      
      get().incrementFailedOperationsCount()
      get().updateSessionStability(false)
      
      set({
        error: {
          code: 'REFRESH_ERROR',
          message: error.message || 'Failed to refresh session',
          source: 'refreshSession',
          timestamp: Date.now()
        }
      } as Partial<AuthStore>)
    }
  },

  setUser: (user) => {
    set({ user } as Partial<AuthStore>)
  },

  setSession: (session) => {
    if (session) {
      get().setCachedSession('current', session)
    }
    set({ session } as Partial<AuthStore>)
  },

  setProfile: (profile) => {
    if (profile) {
      get().setCachedProfile(profile.id, profile)
    }
    set({ profile } as Partial<AuthStore>)
  },

  setError: (error) => {
    set({ error } as Partial<AuthStore>)
  },

  clearAuth: () => {
    console.log('🧹 Clearing comprehensive auth state...')
    
    // Clear all caches
    get().clearCache()
    
    // Reset all auth-related state to initial values
    set({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: true, // Keep as initialized to prevent re-initialization loops
      error: null,
      lastAuthCheck: Date.now(),
      authCheckSource: 'clearAuth',
      // Reset metrics but keep them for debugging
      cacheHits: 0,
      cacheMisses: 0,
      authLatencies: [],
      sessionStabilityEvents: []
      // Don't reset failedOperations - it's an OfflineOperation[] managed by offline slice
    } as Partial<AuthStore>)
    
    console.log('✅ Auth state cleared completely')
  },

  updateLastAuthCheck: (source) => {
    set({
      lastAuthCheck: Date.now(),
      authCheckSource: source
    } as Partial<AuthStore>)
  },

  loadProfile: async (userId) => {
    console.log(`👤 Loading profile for user ${userId}`)
    
    const cachedProfile = get().getCachedProfile(userId)
    if (cachedProfile) {
      console.log('🎯 Using cached profile')
      // Always clear loading; callers (e.g. initialize) set isLoading true before loadProfile,
      // and the early return previously left isLoading stuck — dashboard spun forever.
      set({ profile: cachedProfile, isLoading: false } as Partial<AuthStore>)
      return
    }
    
    const supabase = createClient()
    
    try {
      console.log('🌐 Fetching profile from database...')
      
      // Add timeout to prevent hanging
      const profilePromise = supabase
        .from('profiles')
        .select(`
          *,
          plants(id, name),
          business_units(id, name)
        `)
        .eq('id', userId)
        .single()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      )
      
      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any
      
      if (error) {
        console.error('❌ Database error loading profile:', error)
        throw error
      }
      
      if (!profile) {
        console.error('❌ No profile found for user:', userId)
        throw new Error(`Profile not found for user ${userId}`)
      }
      
      console.log('✅ Profile loaded successfully:', profile.email)
      
      get().setCachedProfile(userId, profile)
      
      set({ 
        profile,
        isLoading: false 
      } as Partial<AuthStore>)
      
    } catch (error: any) {
      console.error('❌ Profile loading error:', error)
      get().incrementFailedOperationsCount()
      
      const errorMessage = error.message || 'Failed to load profile'
      
      set({
        error: {
          code: 'PROFILE_LOAD_ERROR',
          message: errorMessage,
          source: 'loadProfile',
          timestamp: Date.now()
        },
        isLoading: false
      } as Partial<AuthStore>)
      
      // Re-throw the error so signIn can handle it
      throw error
    }
  },

  refreshProfile: async () => {
    console.log('🔄 Refreshing profile...')
    const user = get().user
    if (!user) {
      console.log('⚠️ No user to refresh profile for')
      return
    }
    
    try {
      await get().loadProfile(user.id)
    } catch (error) {
      console.error('❌ Profile refresh error:', error)
    }
  },

  /**
   * Password reset email is NOT sent by this Next.js app (no custom API/SMTP here).
   * The browser calls Supabase Auth; Supabase delivers the message using the project's
   * Auth email templates and SMTP (dashboard: Authentication → Email Templates / SMTP).
   */
  resetPasswordForEmail: async (email) => {
    console.log('📧 Requesting password reset for:', email)
    const startTime = Date.now()
    
    const supabase = createClient()
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      })
      
      if (error) throw error
      
      console.log('✅ Password reset email sent successfully')
      
      const latency = Date.now() - startTime
      get().recordAuthLatency(latency)
      
      return { success: true }
    } catch (error: any) {
      console.error('❌ Password reset request error:', error)
      
      get().incrementFailedOperationsCount()
      
      set({
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: error.message || 'Failed to send password reset email',
          source: 'resetPasswordForEmail',
          timestamp: Date.now()
        }
      } as Partial<AuthStore>)
      
      return { success: false, error: error.message || 'Failed to send password reset email' }
    }
  },

  // Update password for authenticated user
  updatePassword: async (newPassword) => {
    console.log('🔐 Updating password...')
    const startTime = Date.now()
    
    const supabase = createClient()
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) throw error
      
      console.log('✅ Password updated successfully')
      
      const latency = Date.now() - startTime
      get().recordAuthLatency(latency)
      get().updateSessionStability(true)
      
      return { success: true }
    } catch (error: any) {
      console.error('❌ Password update error:', error)
      
      get().incrementFailedOperationsCount()
      get().updateSessionStability(false)
      
      set({
        error: {
          code: 'PASSWORD_UPDATE_ERROR',
          message: error.message || 'Failed to update password',
          source: 'updatePassword',
          timestamp: Date.now()
        }
      } as Partial<AuthStore>)
      
      return { success: false, error: error.message || 'Failed to update password' }
    }
  }
}) 