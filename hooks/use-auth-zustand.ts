import { useAuthStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
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
  type ModulePermissions 
} from '@/lib/auth/role-permissions'

/**
 * Direct Zustand-based auth hook - replaces the problematic context-based one
 * This fixes the eternal loading issue by using Zustand state management
 */
export function useAuthZustand() {
  // Get auth state from Zustand store
  const { user, profile, isLoading, isInitialized, error, session } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      profile: state.profile,
      isLoading: state.isLoading,
      isInitialized: state.isInitialized,
      error: state.error,
      session: state.session,
    }))
  )

  // Get auth actions
  const { signIn, signOut, refreshSession, refreshProfile } = useAuthStore(
    useShallow((state) => ({
      signIn: state.signIn,
      signOut: state.signOut,
      refreshSession: state.refreshSession,
      refreshProfile: state.refreshProfile,
    }))
  )

  // Permission checking functions bound to current user
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
      profile ? amount <= (profile.can_authorize_up_to || 0) : false,
    
    canAccessRoute: (pathname: string) => 
      profile ? canAccessRoute(profile.role, pathname) : false
  }

  // UI helpers bound to current user
  const UI_PERMISSIONS = {
    canShowCreateButton: (role: string, module: keyof ModulePermissions) => {
      return hasCreateAccess(role as any, module)
    },
    canShowEditButton: (role: string, module: keyof ModulePermissions) => {
      return hasWriteAccess(role as any, module)
    },
    canShowDeleteButton: (role: string, module: keyof ModulePermissions) => {
      return hasDeleteAccess(role as any, module)
    },
    canShowAuthorizeButton: (role: string, module: keyof ModulePermissions) => {
      return hasAuthorizationAccess(role as any, module)
    },
    shouldShowInNavigation: (role: string, module: keyof ModulePermissions) => {
      return hasModuleAccess(role as any, module)
    }
  }

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

  // Get authorization limit
  const authorizationLimit = profile ? (profile.can_authorize_up_to || 0) : 0

  // Get organizational context
  const organizationalContext = {
    plantName: profile?.plants?.name || null,
    businessUnitName: profile?.business_units?.name || null,
    plantId: profile?.plant_id || null,
    businessUnitId: profile?.business_unit_id || null,
  }

  return {
    // Core auth data
    user,
    profile,
    loading: isLoading,
    isLoading,
    isInitialized,
    error,
    session,

    // Auth actions
    signIn,
    signOut,
    refreshSession,
    refreshProfile,

    // Permission checkers
    ...permissionCheckers,

    // UI helpers
    ui: uiHelpers,

    // Authorization limit
    authorizationLimit,

    // Organizational context
    organizationalContext,

    // Status helpers
    isAuthenticated: user !== null && profile !== null,
    isFullyLoaded: isInitialized && !isLoading && profile !== null,
  }
} 