import { StateCreator } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { 
  AuthState, 
  UserProfile, 
  AuthError, 
  AuthStore 
} from '@/types/auth-store'

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

  // Actions
  initialize: async () => {
    console.log('🔧 Fast auth initialization...')
    const startTime = Date.now()
    
    if (get().isInitialized) {
      console.log('✅ Auth already initialized, skipping')
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
        setTimeout(() => reject(new Error('Session fetch timeout')), 5000) // Reduced to 5 seconds
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
          message: error.message || 'Failed to initialize auth',
          source: 'initialize',
          timestamp: Date.now()
        },
        isInitialized: true,
        isLoading: false,
        lastAuthCheck: Date.now(),
        authCheckSource: 'error'
      } as Partial<AuthStore>)
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
          
          // Ensure loading is set to false only after profile is loaded
          set({ isLoading: false } as Partial<AuthStore>)
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
        set({ isLoading: false } as Partial<AuthStore>)
      }
      
      const latency = Date.now() - startTime
      get().recordAuthLatency(latency)
      get().updateSessionStability(true)

      return { success: true }
    } catch (error: any) {
      console.error('❌ Sign in error:', error)
      
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
    console.log('🚪 Starting sign out process...')
    set({ isLoading: true } as Partial<AuthStore>)
    
    const supabase = createClient()
    
    try {
      // Add timeout to prevent hanging
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      )
      
      const { error } = await Promise.race([signOutPromise, timeoutPromise]) as any
      if (error) throw error
      
      console.log('✅ Sign out successful')
      get().clearAuth()
    } catch (error: any) {
      console.error('❌ Sign out error:', error)
      
      // Even if there's an error, clear the auth state locally
      get().clearAuth()
      
      set({
        error: {
          code: 'SIGNOUT_ERROR',
          message: error.message || 'Failed to sign out',
          source: 'signOut',
          timestamp: Date.now()
        }
      } as Partial<AuthStore>)
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
    console.log('🧹 Clearing auth state...')
    
    get().clearCache()
    
    set({
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      error: null,
      lastAuthCheck: Date.now(),
      authCheckSource: 'clearAuth'
    } as Partial<AuthStore>)
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
      set({ profile: cachedProfile } as Partial<AuthStore>)
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

  // Password reset request
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