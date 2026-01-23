'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { NextStepReact, useNextStep } from 'nextstepjs'
import { useNextAdapter } from 'nextstepjs/adapters/next'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { useSystemSettings } from '@/hooks/use-system-settings'
import { getTourStepsForRole } from './tour-steps'

export function ProductTour() {
  const { profile, isInitialized, isAuthenticated } = useAuthZustand()
  const { isOnboardingTourEnabled, loading: settingsLoading } = useSystemSettings()
  const { startNextStep } = useNextStep()
  const pathname = usePathname()
  
  // Don't show tour on auth pages
  const isAuthPage = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/auth') || 
                     pathname?.startsWith('/reset-password') ||
                     pathname === '/'
  
  const tourSteps = getTourStepsForRole(profile?.role)
  const tourId = tourSteps[0]?.tour || 'default-onboarding'

  // Debug logging
  useEffect(() => {
    console.log('🎯 ProductTour initialized:', {
      hasProfile: !!profile,
      profileRole: profile?.role,
      tourStepsCount: tourSteps.length,
      tourId,
      steps: tourSteps[0]?.steps?.length || 0
    })
  }, [profile, tourSteps, tourId])

  const waitForSelector = (selector?: string, attempt = 0, maxAttempts = 15, delay = 200): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!selector || typeof document === 'undefined') return resolve(true)
      const el = document.querySelector(selector)
      if (el) return resolve(true)
      if (attempt >= maxAttempts) return resolve(false)
      setTimeout(() => {
        resolve(waitForSelector(selector, attempt + 1, maxAttempts, delay))
      }, delay)
    })
  }

  useEffect(() => {
    // Check if tour should start automatically
    const checkAndStartTour = async () => {
      // Don't start tour if:
      // 1. Settings still loading
      // 2. Onboarding tour feature is disabled
      // 3. Auth not initialized
      // 4. User not authenticated
      // 5. No profile
      // 6. On auth page
      if (settingsLoading || !isOnboardingTourEnabled || !isInitialized || !isAuthenticated || !profile || isAuthPage) {
        console.log('⏸️ Auto-start: Skipping tour', {
          settingsLoading,
          isOnboardingTourEnabled,
          isInitialized,
          isAuthenticated,
          hasProfile: !!profile,
          isAuthPage
        })
        return
      }
      
      // Check for tour completion - check multiple possible keys for backward compatibility
      const possibleTourKeys = [
        `nextstep_tour_${tourId}_completed`,
        `nextstep_tour_operator-onboarding_completed`,
        `nextstep_tour_manager-onboarding_completed`,
        `nextstep_tour_admin-onboarding_completed`,
        `nextstep_tour_default-onboarding_completed`,
        `nextstep_tour_maintenance-manager-onboarding_completed`,
        `nextstep_tour_purchasing-assistant-onboarding_completed`,
        'interactive_tour_completed',
        'simple_tour_completed',
        'comprehensive_onboarding_completed',
        'onboarding_tour_completed'
      ]
      
      // Check if ANY tour has been completed (for backward compatibility)
      const tourCompleted = possibleTourKeys.some(key => {
        const value = localStorage.getItem(key)
        return value === 'true'
      })
      
      // Check database for policy acknowledgment
      let policyAcknowledged = localStorage.getItem('policy_acknowledged')
      
      // If not in localStorage, check database
      if (policyAcknowledged === null) {
        try {
          const { createClient } = await import('@/lib/supabase')
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          
          if (user) {
            // Get active policies
            const { data: activePolicies } = await supabase
              .from('policies')
              .select('id')
              .eq('is_active', true)
              .limit(1)

            if (activePolicies && activePolicies.length > 0) {
              // Check if user has acknowledged
              const { data: acknowledgment } = await supabase
                .from('policy_acknowledgments')
                .select('id')
                .eq('user_id', user.id)
                .eq('policy_id', activePolicies[0].id)
                .single()

              policyAcknowledged = acknowledgment ? 'true' : 'false'
              // Sync to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('policy_acknowledged', policyAcknowledged)
              }
            } else {
              // No active policies, consider acknowledged
              policyAcknowledged = 'true'
              if (typeof window !== 'undefined') {
                localStorage.setItem('policy_acknowledged', 'true')
              }
            }
          }
        } catch (error) {
          console.error('Error checking policy acknowledgment:', error)
          // On error, assume acknowledged to not block
          policyAcknowledged = 'true'
        }
      }
      
      console.log('🔍 Auto-start check:', {
        tourCompleted,
        policyAcknowledged,
        tourId,
        willStart: policyAcknowledged === 'true' && !tourCompleted,
        checkedKeys: possibleTourKeys.filter(key => localStorage.getItem(key) === 'true')
      })
      
      // Start tour if policy acknowledged and tour not completed
      // tourCompleted is now a boolean (true if ANY tour was completed)
      if (policyAcknowledged === 'true' && !tourCompleted) {
        console.log('⏳ Waiting for selector before starting tour...')
        const firstStepSelector = tourSteps[0]?.steps[0]?.selector
        const found = await waitForSelector(firstStepSelector, 0, 20, 200)
        console.log('🎯 Selector found:', found, 'for', firstStepSelector)
        
        // Add extra delay to ensure NextStepReact is fully mounted
        setTimeout(() => {
          try {
            console.log('🚀 Calling startNextStep with tourId:', tourId)
            startNextStep(tourId)
            console.log('✅ startNextStep called')
          } catch (error) {
            console.error('❌ Error auto-starting tour:', error)
          }
        }, 1000)
      } else {
        console.log('⏭️ Auto-start skipped:', {
          reason: tourCompleted ? 'Tour already completed' : 'Policy not acknowledged',
          tourCompleted,
          policyAcknowledged
        })
      }
    }

    // Delay to ensure NextStepReact is mounted
    const timeoutId = setTimeout(() => {
      checkAndStartTour()
    }, 500)

    // Listen for manual tour start events
    const handleManualStart = () => {
      console.log('📢 Manual start event received')
      if (profile && tourSteps.length > 0) {
        const firstStepSelector = tourSteps[0]?.steps[0]?.selector
        waitForSelector(firstStepSelector, 0, 20, 200).then((found) => {
          console.log('🎯 Manual start - selector found:', found)
          setTimeout(() => {
            try {
              console.log('🚀 Manual start - calling startNextStep:', tourId)
              startNextStep(tourId)
            } catch (error) {
              console.error('❌ Error manually starting tour:', error)
            }
          }, 500)
        })
      }
    }

    window.addEventListener('start-tour', handleManualStart)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('start-tour', handleManualStart)
    }
  }, [settingsLoading, isOnboardingTourEnabled, isInitialized, isAuthenticated, profile, tourId, startNextStep, tourSteps, isAuthPage])

  const scrollToSelector = async (selector?: string) => {
    if (!selector || typeof document === 'undefined') return
    const found = await waitForSelector(selector, 0, 20, 200)
    if (!found) return
    const el = document.querySelector(selector) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }
  }

  // Don't render tour if:
  // 1. Settings still loading
  // 2. Onboarding tour feature is disabled
  // 3. Auth not initialized
  // 4. User not authenticated
  // 5. On auth page
  // 6. No tour steps available
  if (settingsLoading || !isOnboardingTourEnabled || !isInitialized || !isAuthenticated || isAuthPage) {
    return null
  }

  if (tourSteps.length === 0) {
    console.warn('⚠️ ProductTour: No tour steps available')
    return null
  }

  console.log('✅ ProductTour: Rendering NextStepReact with', tourSteps.length, 'tours')

  return (
    <NextStepReact
      steps={tourSteps}
      navigationAdapter={useNextAdapter}
      cardTransition={{
        duration: 0.3,
        type: 'spring',
      }}
      onStepChange={async (stepIndex, tourName) => {
        console.log('📍 Tour step changed:', { stepIndex, tourName })
        const tour = tourSteps.find((t) => t.tour === tourName)
        const step = tour?.steps[stepIndex]
        const prevStep = stepIndex > 0 ? tour?.steps[stepIndex - 1] : null
        
        // If previous step had nextRoute, wait a bit for navigation to complete
        if (prevStep?.nextRoute) {
          console.log('⏳ Previous step navigated to:', prevStep.nextRoute, '- waiting for page load...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        // Wait for selector and scroll
        if (step?.selector) {
          await scrollToSelector(step.selector)
        }
      }}
      onStart={(tourName) => {
        console.log('🚀 Tour started:', tourName)
      }}
      onComplete={(completedTourId) => {
        console.log('✅ Tour completed:', completedTourId)
        if (typeof window !== 'undefined') {
          // Mark this specific tour as completed
          localStorage.setItem(`nextstep_tour_${completedTourId}_completed`, 'true')
          // Also mark all legacy keys for backward compatibility
          localStorage.setItem('interactive_tour_completed', 'true')
          localStorage.setItem('simple_tour_completed', 'true')
          localStorage.setItem('comprehensive_onboarding_completed', 'true')
          localStorage.setItem('onboarding_tour_completed', 'true')
        }
      }}
      onSkip={(skippedTourId) => {
        console.log('⏭️ Tour skipped:', skippedTourId)
        if (typeof window !== 'undefined') {
          // Mark this specific tour as completed (skipping counts as completion)
          localStorage.setItem(`nextstep_tour_${skippedTourId}_completed`, 'true')
          // Also mark all legacy keys for backward compatibility
          localStorage.setItem('interactive_tour_completed', 'true')
          localStorage.setItem('simple_tour_completed', 'true')
          localStorage.setItem('comprehensive_onboarding_completed', 'true')
          localStorage.setItem('onboarding_tour_completed', 'true')
        }
      }}
    />
  )
}

