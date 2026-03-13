import { useAuthStore } from '@/store'
import { useShallow } from 'zustand/react/shallow'
import {
  hasModuleAccess,
  hasWriteAccess,
  hasCreateAccess,
  hasDeleteAccess,
  hasAuthorizationAccess,
  canAccessRoute,
  getRoleDisplayName,
  isGMEscalator,
  isRHOwner,
  isTechnicalApprover,
  isViabilityReviewer,
  resolveCompatibleRoleInfo,
  type ModulePermissions,
} from '@/lib/auth/role-permissions'
import { resolveWarehouseResponsibility } from '@/lib/auth/warehouse-responsibility'
import { resolveBusinessRole, resolveRoleScope, effectiveRoleForPermissions, type RoleScope } from '@/lib/auth/role-model'

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
  const { signIn, signOut, refreshSession, refreshProfile, resetPasswordForEmail, updatePassword } = useAuthStore(
    useShallow((state) => ({
      signIn: state.signIn,
      signOut: state.signOut,
      refreshSession: state.refreshSession,
      refreshProfile: state.refreshProfile,
      resetPasswordForEmail: state.resetPasswordForEmail,
      updatePassword: state.updatePassword,
    }))
  )

  // Enforce inactive users cannot access: if profile.is_active === false, sign out ASAP
  const profileWithActiveFlag = profile as (typeof profile & { is_active?: boolean | null }) | null
  if (typeof window !== 'undefined' && profileWithActiveFlag?.is_active === false) {
    // Fire and forget sign out; avoid render loops by checking loading state
    queueMicrotask(() => {
      try { signOut() } catch {}
    })
  }

  // Permission checking: use effective role so JEFE_PLANTA etc. keep distinct permissions
  // (business_role would map them to COORDINADOR/OPERADOR with stricter access)
  const permissionRoleKey = effectiveRoleForPermissions(profile)
  const metadataRoleKey = permissionRoleKey ?? profile?.business_role ?? profile?.role ?? null
  const resolvedBusinessRole = profile?.business_role ?? resolveBusinessRole(profile?.role)
  const resolvedRoleScope: RoleScope | null =
    profile?.role_scope ?? resolveRoleScope(profile?.business_role ?? profile?.role)
  const legacyRoleInfo = profile?.role ? resolveCompatibleRoleInfo(profile.role) : null
  const roleInfo = metadataRoleKey
    ? {
        ...resolveCompatibleRoleInfo(metadataRoleKey),
        legacyRole: legacyRoleInfo?.legacyRole ?? null,
        businessRole: resolvedBusinessRole,
        scope: resolvedRoleScope,
      }
    : null
  const warehouseResponsibility = profile
    ? resolveWarehouseResponsibility({
        role: profile.role,
        ...(profile.warehouse_responsibility ?? {}),
      })
    : null

  const permissionCheckers = {
    hasModuleAccess: (module: keyof ModulePermissions) =>
      permissionRoleKey ? hasModuleAccess(permissionRoleKey, module) : false,

    hasWriteAccess: (module: keyof ModulePermissions) =>
      permissionRoleKey ? hasWriteAccess(permissionRoleKey, module) : false,

    hasCreateAccess: (module: keyof ModulePermissions) =>
      permissionRoleKey ? hasCreateAccess(permissionRoleKey, module) : false,

    hasDeleteAccess: (module: keyof ModulePermissions) =>
      permissionRoleKey ? hasDeleteAccess(permissionRoleKey, module) : false,

    hasAuthorizationAccess: (module: keyof ModulePermissions) =>
      permissionRoleKey ? hasAuthorizationAccess(permissionRoleKey, module) : false,

    canAuthorizeAmount: (amount: number) =>
      profile ? amount <= (profile.can_authorize_up_to || 0) : false,

    canAccessRoute: (pathname: string) =>
      permissionRoleKey ? canAccessRoute(permissionRoleKey, pathname) : false,
  }

  // UI helpers bound to current user
  const UI_PERMISSIONS = {
    canShowCreateButton: (role: string, module: keyof ModulePermissions) => {
      return hasCreateAccess(role, module)
    },
    canShowEditButton: (role: string, module: keyof ModulePermissions) => {
      return hasWriteAccess(role, module)
    },
    canShowDeleteButton: (role: string, module: keyof ModulePermissions) => {
      return hasDeleteAccess(role, module)
    },
    canShowAuthorizeButton: (role: string, module: keyof ModulePermissions) => {
      return hasAuthorizationAccess(role, module)
    },
    shouldShowInNavigation: (role: string, module: keyof ModulePermissions) => {
      return hasModuleAccess(role, module)
    }
  }

  const uiHelpers = {
    canShowCreateButton: (module: keyof ModulePermissions) =>
      permissionRoleKey ? UI_PERMISSIONS.canShowCreateButton(permissionRoleKey, module) : false,

    canShowEditButton: (module: keyof ModulePermissions) =>
      permissionRoleKey ? UI_PERMISSIONS.canShowEditButton(permissionRoleKey, module) : false,

    canShowDeleteButton: (module: keyof ModulePermissions) =>
      permissionRoleKey ? UI_PERMISSIONS.canShowDeleteButton(permissionRoleKey, module) : false,

    canShowAuthorizeButton: (module: keyof ModulePermissions) =>
      permissionRoleKey ? UI_PERMISSIONS.canShowAuthorizeButton(permissionRoleKey, module) : false,

    shouldShowInNavigation: (module: keyof ModulePermissions) =>
      permissionRoleKey ? UI_PERMISSIONS.shouldShowInNavigation(permissionRoleKey, module) : false,
  }

  // Get authorization limit
  const authorizationLimit = profile ? (profile.can_authorize_up_to || 0) : 0

  // Get organizational context
  const organizationalContext = {
    plantName: profile?.plants?.name || null,
    businessUnitName: profile?.business_units?.name || null,
    plantId: profile?.plant_id || null,
    businessUnitId: profile?.business_unit_id || null,
    role: profile?.role || null,
    legacyRole: roleInfo?.legacyRole ?? null,
    businessRole: roleInfo?.businessRole ?? null,
    roleScope: roleInfo?.scope ?? null,
    warehouseResponsibility,
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
    resetPasswordForEmail,
    updatePassword,

    // Permission checkers
    ...permissionCheckers,

    // UI helpers
    ui: uiHelpers,

    // Compatibility role model
    roleInfo,
    legacyRole: roleInfo?.legacyRole ?? null,
    businessRole: roleInfo?.businessRole ?? null,
    roleScope: roleInfo?.scope ?? null,
    roleDisplayName: metadataRoleKey ? getRoleDisplayName(metadataRoleKey) : null,
    warehouseResponsibility,
    isTechnicalApprover: metadataRoleKey ? isTechnicalApprover(metadataRoleKey) : false,
    isViabilityReviewer: metadataRoleKey ? isViabilityReviewer(metadataRoleKey) : false,
    isGMEscalator: metadataRoleKey ? isGMEscalator(metadataRoleKey) : false,
    isRhOwner: metadataRoleKey ? isRHOwner(metadataRoleKey) : false,

    // Authorization limit
    authorizationLimit,

    // Organizational context
    organizationalContext,

    // Status helpers
    isAuthenticated: user !== null && profile !== null,
    isFullyLoaded: isInitialized && !isLoading && profile !== null,
  }
} 