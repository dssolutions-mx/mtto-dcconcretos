'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { NextStepProvider } from 'nextstepjs'
import { PolicyAcknowledgmentModal } from './policy-acknowledgment-modal'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { useSystemSettings } from '@/hooks/use-system-settings'

interface OnboardingProviderProps {
  children: React.ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const { profile, isInitialized, isAuthenticated } = useAuthZustand()
  const { isPolicyAcknowledgmentEnabled, loading: settingsLoading } = useSystemSettings()
  const pathname = usePathname()

  // Don't show onboarding on auth pages
  const isAuthPage = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/auth') || 
                     pathname?.startsWith('/reset-password') ||
                     pathname === '/'

  useEffect(() => {
    // Only check policies if:
    // 1. Settings are loaded
    // 2. Policy acknowledgment feature is enabled
    // 3. Auth is initialized
    // 4. User is authenticated
    // 5. We're not on an auth page
    if (settingsLoading || !isPolicyAcknowledgmentEnabled || !isInitialized || !isAuthenticated || !profile || isAuthPage) {
      return
    }

    // Check if user needs to acknowledge policies
    checkPolicyAcknowledgment()
  }, [settingsLoading, isPolicyAcknowledgmentEnabled, isInitialized, isAuthenticated, profile, pathname, isAuthPage])

  const checkPolicyAcknowledgment = async () => {
    // Double check authentication before proceeding
    if (!isAuthenticated || !profile) {
      return
    }

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        console.log('⏸️ OnboardingProvider: No user found, skipping policy check')
        return
      }

      // Get active policies
      const { data: activePolicies } = await supabase
        .from('policies')
        .select('id')
        .eq('is_active', true)
        .limit(1)

      if (!activePolicies || activePolicies.length === 0) {
        // No active policies, set acknowledged to true
        if (typeof window !== 'undefined') {
          localStorage.setItem('policy_acknowledged', 'true')
        }
        return
      }

      // Check if user has acknowledged
      const { data: acknowledgment } = await supabase
        .from('policy_acknowledgments')
        .select('id')
        .eq('user_id', user.id)
        .eq('policy_id', activePolicies[0].id)
        .single()

      // Set localStorage based on database status
      if (typeof window !== 'undefined') {
        if (acknowledgment) {
          localStorage.setItem('policy_acknowledged', 'true')
        } else {
          localStorage.removeItem('policy_acknowledged')
          setShowPolicyModal(true)
        }
      }
    } catch (error) {
      console.error('Error checking policy acknowledgment:', error)
      // On error, assume acknowledged to not block user
      if (typeof window !== 'undefined') {
        localStorage.setItem('policy_acknowledged', 'true')
      }
    }
  }

  const handlePolicyAcknowledged = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('policy_acknowledged', 'true')
    }
    setShowPolicyModal(false)
  }

  return (
    <NextStepProvider>
      {children}
      {/* Only show policy modal if user is authenticated and not on auth page */}
      {isAuthenticated && !isAuthPage && (
        <PolicyAcknowledgmentModal
          open={showPolicyModal}
          onAcknowledged={handlePolicyAcknowledged}
        />
      )}
    </NextStepProvider>
  )
}
