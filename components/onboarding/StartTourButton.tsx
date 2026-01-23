'use client'

import { Button } from '@/components/ui/button'
import { useNextStep } from 'nextstepjs'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { getTourStepsForRole } from './tour-steps'
import { Play } from 'lucide-react'

export function StartTourButton() {
  const { startNextStep } = useNextStep()
  const { profile } = useAuthZustand()
  
  const tourSteps = getTourStepsForRole(profile?.role)
  const tourId = tourSteps[0]?.tour || 'default-onboarding'

  const handleStartTour = async () => {
    console.log('🎬 StartTourButton clicked:', { 
      hasProfile: !!profile, 
      profileRole: profile?.role,
      tourStepsCount: tourSteps.length,
      tourId 
    })

    if (!profile || tourSteps.length === 0) {
      console.warn('❌ Cannot start tour: profile or tour steps missing', { profile, tourSteps })
      return
    }
    
    // Clear completion flag
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`nextstep_tour_${tourId}_completed`)
      console.log('🧹 Cleared tour completion flag for:', tourId)
    }
    
    // Wait for first selector, then start
    const firstStepSelector = tourSteps[0]?.steps[0]?.selector
    console.log('⏳ Waiting for selector:', firstStepSelector)
    
    const waitForSelector = (selector?: string, attempt = 0): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!selector || typeof document === 'undefined') return resolve(true)
        const el = document.querySelector(selector)
        if (el) return resolve(true)
        if (attempt >= 20) return resolve(false)
        setTimeout(() => {
          resolve(waitForSelector(selector, attempt + 1))
        }, 200)
      })
    }
    
    const found = await waitForSelector(firstStepSelector)
    console.log('🎯 Selector found:', found)
    
    // Wait a bit more for NextStepReact to be fully ready
    setTimeout(() => {
      try {
        console.log('🚀 Starting tour:', tourId, 'with', tourSteps[0]?.steps?.length, 'steps')
        startNextStep(tourId)
        console.log('✅ startNextStep called successfully')
      } catch (error) {
        console.error('❌ Error starting tour:', error)
        // Try dispatching event as fallback
        window.dispatchEvent(new CustomEvent('start-tour'))
      }
    }, 800)
  }

  return (
    <Button
      onClick={handleStartTour}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Play className="h-4 w-4" />
      Iniciar Tour Guiado
    </Button>
  )
}

