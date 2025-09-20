import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { useAuthStore } from '@/store'

/**
 * Hook for mobile session recovery using Zustand
 * Integrates with the auth store for proper state management
 */
export function useMobileSessionRecovery() {
  const { 
    user, 
    session,
    isLoading 
  } = useAuthZustand()
  
  // Get mobile-specific functions directly from store
  const { recoverMobileSession, isMobileDevice } = useAuthStore((state) => ({
    recoverMobileSession: state.recoverMobileSession,
    isMobileDevice: state.isMobileDevice
  }))
  
  /**
   * Enhanced fetch with session recovery for mobile
   */
  const fetchWithSessionRecovery = async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    const isMobile = isMobileDevice()
    
    if (!isMobile) {
      // On desktop, use normal fetch
      return fetch(url, options)
    }

    // On mobile, try normal fetch first
    let response = await fetch(url, options)
    
    // If we get a 401 and we're on mobile, try session recovery
    if (response.status === 401) {
      console.log('🔄 Mobile: 401 received, attempting session recovery')
      
      const recoveryResult = await recoverMobileSession()
      
      if (recoveryResult.success) {
        console.log('✅ Mobile: Session recovered, retrying request')
        
        // Retry the request with the recovered session
        response = await fetch(url, options)
      } else {
        console.log('❌ Mobile: Session recovery failed, redirecting to login')
        
        // Redirect to login if session recovery fails
        window.location.href = '/login?redirectedFrom=' + encodeURIComponent(window.location.pathname)
        throw new Error('Session recovery failed')
      }
    }
    
    return response
  }

  /**
   * Check if session is valid and recover if needed
   */
  const ensureValidSession = async (): Promise<boolean> => {
    if (!isMobileDevice()) {
      return !!user // On desktop, just check if user exists
    }

    // On mobile, check if we have a valid session
    if (user && session) {
      return true
    }

    // Try to recover session
    const recoveryResult = await recoverMobileSession()
    return recoveryResult.success
  }

  return {
    recoverMobileSession,
    fetchWithSessionRecovery,
    isMobileDevice,
    ensureValidSession,
    user,
    session,
    isLoading
  }
} 

/**
 * Standalone fetch helper usable outside React components (no hooks).
 * For services, workers, or utility modules.
 */
export async function fetchWithSessionRecoveryStandalone(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    const state = useAuthStore.getState()
    const isMobile = typeof state.isMobileDevice === 'function' ? state.isMobileDevice() : false

    if (!isMobile) {
      return fetch(url, options)
    }

    let response = await fetch(url, options)
    if (response.status !== 401) return response

    const recovery = await state.recoverMobileSession()
    if (recovery?.success) {
      return fetch(url, options)
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login?redirectedFrom=' + encodeURIComponent(window.location?.pathname || '/')
    }
    throw new Error('Session recovery failed')
  } catch (error) {
    // Re-throw to let callers handle
    throw error
  }
}