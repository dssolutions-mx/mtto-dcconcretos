'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ChevronRight, ChevronLeft, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TourStep {
  id: string
  target: string // CSS selector
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: {
    label: string
    onClick: () => void
  }
}

interface OnboardingTourProps {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  storageKey?: string
}

export function OnboardingTour({
  steps,
  onComplete,
  onSkip,
  storageKey = 'onboarding_tour_completed'
}: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({})
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check if tour was already completed
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem(storageKey)
      if (completed === 'true') {
        return
      }
    }

    // Start tour after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      startTour()
    }, 1000)

    return () => clearTimeout(timer)
  }, [storageKey])

  useEffect(() => {
    if (isActive && steps.length > 0) {
      updateTargetElement()
    }
  }, [isActive, currentStep, steps])

  const startTour = () => {
    if (steps.length === 0) return
    setIsActive(true)
    setCurrentStep(0)
  }

  const updateTargetElement = () => {
    const step = steps[currentStep]
    if (!step) return

    const element = document.querySelector(step.target) as HTMLElement
    if (!element) {
      // Element not found, skip to next step
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1)
      } else {
        completeTour()
      }
      return
    }

    setTargetElement(element)
    updateOverlay(element)
    scrollToElement(element)
  }

  const updateOverlay = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const padding = 10

    setOverlayStyle({
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'auto',
      zIndex: 9998,
    })

    // Update highlight position
    requestAnimationFrame(() => {
      if (overlayRef.current) {
        const highlight = overlayRef.current.querySelector('.highlight') as HTMLElement
        if (highlight) {
          highlight.style.top = `${rect.top - padding}px`
          highlight.style.left = `${rect.left - padding}px`
          highlight.style.width = `${rect.width + padding * 2}px`
          highlight.style.height = `${rect.height + padding * 2}px`
        }
      }
    })
  }

  const scrollToElement = (element: HTMLElement) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    })
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true')
    }
    setIsActive(false)
    onSkip?.()
  }

  const completeTour = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true')
    }
    setIsActive(false)
    onComplete?.()
  }

  if (!isActive || steps.length === 0 || !targetElement) {
    return null
  }

  const step = steps[currentStep]
  const position = step.position || 'bottom'

  // Calculate tooltip position
  const rect = targetElement.getBoundingClientRect()
  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  }

  switch (position) {
    case 'top':
      tooltipStyle.bottom = `${window.innerHeight - rect.top + 20}px`
      tooltipStyle.left = `${rect.left + rect.width / 2}px`
      tooltipStyle.transform = 'translateX(-50%)'
      break
    case 'bottom':
      tooltipStyle.top = `${rect.bottom + 20}px`
      tooltipStyle.left = `${rect.left + rect.width / 2}px`
      tooltipStyle.transform = 'translateX(-50%)'
      break
    case 'left':
      tooltipStyle.top = `${rect.top + rect.height / 2}px`
      tooltipStyle.right = `${window.innerWidth - rect.left + 20}px`
      tooltipStyle.transform = 'translateY(-50%)'
      break
    case 'right':
      tooltipStyle.top = `${rect.top + rect.height / 2}px`
      tooltipStyle.left = `${rect.right + 20}px`
      tooltipStyle.transform = 'translateY(-50%)'
      break
  }

  return createPortal(
    <>
      {/* Overlay with highlight */}
      <div
        ref={overlayRef}
        className="fixed inset-0 pointer-events-auto"
        style={overlayStyle}
        onClick={(e) => {
          // Prevent clicks outside the tooltip
          e.stopPropagation()
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div
          className="highlight absolute rounded-lg border-2 border-primary shadow-lg bg-white pointer-events-none transition-all duration-200"
          style={{
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
          }}
        />
      </div>

      {/* Tooltip */}
      <Card
        className="fixed z-[9999] w-[90vw] max-w-[400px] shadow-2xl pointer-events-auto"
        style={tooltipStyle}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">
                  {step.title}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {currentStep + 1} / {steps.length}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {step.description}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={skipTour}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={previousStep}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step.action && (
                <Button size="sm" onClick={step.action.onClick}>
                  {step.action.label}
                </Button>
              )}
              {currentStep < steps.length - 1 ? (
                <Button size="sm" onClick={nextStep}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={completeTour}>
                  Completar
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>,
    document.body
  )
}
