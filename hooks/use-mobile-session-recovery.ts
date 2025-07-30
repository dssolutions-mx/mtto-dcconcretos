import { useAuthZustand } from '@/hooks/use-auth-zustand'

/**
 * Hook for mobile session recovery using Zustand
 * Integrates with the auth store for proper state management
 */
export function useMobileSessionRecovery() {
  const { 
    recoverMobileSession, 
    isMobileDevice, 
    user, 
    session,
    isLoading 
  } = useAuthZustand()
  
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