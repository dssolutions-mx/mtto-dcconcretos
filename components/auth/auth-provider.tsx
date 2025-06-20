"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase-types"
import { createClient } from "@/lib/supabase"
import { 
  hasModuleAccess, 
  hasWriteAccess, 
  hasCreateAccess, 
  hasDeleteAccess, 
  hasAuthorizationAccess,
  canAuthorizeAmount,
  getAuthorizationLimit,
  getRoleScope,
  canAccessRoute,
  UI_PERMISSIONS,
  type ModulePermissions 
} from "@/lib/auth/role-permissions"

type UserProfile = {
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

type AuthContextType = {
  supabase: SupabaseClient<Database>
  user: User | null
  profile: UserProfile | null
  loading: boolean
  
  // Permission checking functions
  hasModuleAccess: (module: keyof ModulePermissions) => boolean
  hasWriteAccess: (module: keyof ModulePermissions) => boolean
  hasCreateAccess: (module: keyof ModulePermissions) => boolean
  hasDeleteAccess: (module: keyof ModulePermissions) => boolean
  hasAuthorizationAccess: (module: keyof ModulePermissions) => boolean
  canAuthorizeAmount: (amount: number) => boolean
  canAccessRoute: (pathname: string) => boolean
  
  // UI helpers
  ui: {
    canShowCreateButton: (module: keyof ModulePermissions) => boolean
    canShowEditButton: (module: keyof ModulePermissions) => boolean
    canShowDeleteButton: (module: keyof ModulePermissions) => boolean
    canShowAuthorizeButton: (module: keyof ModulePermissions) => boolean
    shouldShowInNavigation: (module: keyof ModulePermissions) => boolean
  }
  
  // User context
  authorizationLimit: number
  roleScope: 'global' | 'business_unit' | 'plant'
  organizationalContext: {
    plantId?: string
    plantName?: string
    businessUnitId?: string
    businessUnitName?: string
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nombre,
          apellido,
          email,
          role,
          plant_id,
          business_unit_id,
          can_authorize_up_to,
          status,
          employee_code,
          plants:plant_id(id, name, code, business_unit_id),
          business_units:business_unit_id(id, name)
        `)
        .eq('id', currentUser.id)
        .eq('status', 'active')
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      return null
    }
  }

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          // Only log if it's not the expected "no session" error
          if (error.message !== 'Auth session missing!' && error.name !== 'AuthSessionMissingError') {
            console.error('Error getting session:', error)
          }
        }

        if (session?.user) {
          setUser(session.user)
          const userProfile = await fetchProfile(session.user)
          setProfile(userProfile)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event)
      
      if (session?.user) {
        setUser(session.user)
        const userProfile = await fetchProfile(session.user)
        setProfile(userProfile)
      } else {
        setUser(null)
        setProfile(null)
      }
      
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Create permission checking functions bound to current user
  const permissionCheckers = {
    hasModuleAccess: (module: keyof ModulePermissions) => 
      profile ? hasModuleAccess(profile.role, module) : false,
    
    hasWriteAccess: (module: keyof ModulePermissions) => 
      profile ? hasWriteAccess(profile.role, module) : false,
    
    hasCreateAccess: (module: keyof ModulePermissions) => 
      profile ? hasCreateAccess(profile.role, module) : false,
    
    hasDeleteAccess: (module: keyof ModulePermissions) => 
      profile ? hasDeleteAccess(profile.role, module) : false,
    
    hasAuthorizationAccess: (module: keyof ModulePermissions) => 
      profile ? hasAuthorizationAccess(profile.role, module) : false,
    
    canAuthorizeAmount: (amount: number) => 
      profile ? canAuthorizeAmount(profile.role, amount) : false,
    
    canAccessRoute: (pathname: string) => 
      profile ? canAccessRoute(profile.role, pathname) : false
  }

  // UI helpers bound to current user
  const uiHelpers = {
    canShowCreateButton: (module: keyof ModulePermissions) => 
      profile ? UI_PERMISSIONS.canShowCreateButton(profile.role, module) : false,
    
    canShowEditButton: (module: keyof ModulePermissions) => 
      profile ? UI_PERMISSIONS.canShowEditButton(profile.role, module) : false,
    
    canShowDeleteButton: (module: keyof ModulePermissions) => 
      profile ? UI_PERMISSIONS.canShowDeleteButton(profile.role, module) : false,
    
    canShowAuthorizeButton: (module: keyof ModulePermissions) => 
      profile ? UI_PERMISSIONS.canShowAuthorizeButton(profile.role, module) : false,
    
    shouldShowInNavigation: (module: keyof ModulePermissions) => 
      profile ? UI_PERMISSIONS.shouldShowInNavigation(profile.role, module) : false
  }

  const contextValue: AuthContextType = {
    supabase,
    user,
    profile,
    loading,
    ...permissionCheckers,
    ui: uiHelpers,
    authorizationLimit: profile ? getAuthorizationLimit(profile.role) : 0,
    roleScope: profile ? getRoleScope(profile.role) : 'plant',
    organizationalContext: {
      plantId: profile?.plant_id || undefined,
      plantName: profile?.plants?.name || undefined,
      businessUnitId: profile?.business_unit_id || undefined,
      businessUnitName: profile?.business_units?.name || undefined
    }
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
