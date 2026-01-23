'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { X, ChevronRight, ChevronLeft, Target, Info, AlertCircle, CheckCircle, BookOpen, Navigation, Shield, FileText, Users, Package, Wrench, ClipboardList, BarChart3, ShoppingCart, Settings, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface TourStep {
  id: string
  target?: string // CSS selector - optional for info-only steps
  title: string
  description: string
  detailedExplanation?: string // Why this exists, what it does
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: {
    label: string
    onClick: () => void
    href?: string
  }
  icon?: React.ReactNode
  type?: 'info' | 'navigation' | 'feature' | 'warning' | 'tip'
  showSkip?: boolean
}

interface ComprehensiveOnboardingTourProps {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  storageKey?: string
  userRole?: string
}

export function ComprehensiveOnboardingTour({
  steps,
  onComplete,
  onSkip,
  storageKey = 'comprehensive_onboarding_completed',
  userRole
}: ComprehensiveOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({})
  const overlayRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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
    }, 1500)

    return () => clearTimeout(timer)
  }, [storageKey])

  useEffect(() => {
    if (isActive && steps.length > 0) {
      // Wait a bit for DOM to be ready, then try to find element
      const timer = setTimeout(() => {
        updateTargetElement()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isActive, currentStep, steps])

  const startTour = () => {
    if (steps.length === 0) return
    setIsActive(true)
    setCurrentStep(0)
  }

  const updateTargetElement = (retryCount = 0) => {
    const step = steps[currentStep]
    if (!step) {
      setTargetElement(null)
      setOverlayStyle({})
      return
    }

    // If no target, it's an info-only step - show it without highlight
    if (!step.target) {
      setTargetElement(null)
      setOverlayStyle({})
      return
    }

    // Try to find the element
    const element = document.querySelector(step.target) as HTMLElement
    if (!element) {
      // Element not found - retry up to 3 times with delays
      if (retryCount < 3) {
        setTimeout(() => {
          updateTargetElement(retryCount + 1)
        }, 500)
        return
      }
      // After retries, show step without highlight (don't skip)
      console.warn(`Onboarding: Target element not found for step "${step.id}": ${step.target}`)
      setTargetElement(null)
      setOverlayStyle({})
      return
    }

    // Verify element is actually visible and has dimensions
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      // Element has no dimensions - retry
      if (retryCount < 3) {
        setTimeout(() => {
          updateTargetElement(retryCount + 1)
        }, 500)
        return
      }
      // After retries, show step without highlight (don't skip)
      console.warn(`Onboarding: Target element has no dimensions for step "${step.id}": ${step.target}`)
      setTargetElement(null)
      setOverlayStyle({})
      return
    }

    // Valid element found - set it up
    setTargetElement(element)
    updateOverlay(element)
    scrollToElement(element)
  }

  const updateOverlay = (element: HTMLElement) => {
    if (!element) {
      setOverlayStyle({})
      return
    }

    const rect = element.getBoundingClientRect()
    
    // Validate element dimensions - don't render highlight if element is invalid
    if (rect.width === 0 || rect.height === 0 || 
        rect.top < -1000 || rect.left < -1000 ||
        rect.top > window.innerHeight + 1000 || 
        rect.left > window.innerWidth + 1000) {
      setOverlayStyle({})
      return
    }

    const padding = 10

    setOverlayStyle({
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      pointerEvents: 'auto',
      zIndex: 9998,
      // Store highlight dimensions for use in JSX
      '--highlight-top': `${rect.top - padding}px`,
      '--highlight-left': `${rect.left - padding}px`,
      '--highlight-width': `${rect.width + padding * 2}px`,
      '--highlight-height': `${rect.height + padding * 2}px`,
    } as React.CSSProperties & {
      '--highlight-top': string
      '--highlight-left': string
      '--highlight-width': string
      '--highlight-height': string
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
      // Clear current target and overlay before moving to next step
      setTargetElement(null)
      setOverlayStyle({})
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      // Clear current target and overlay before moving to previous step
      setTargetElement(null)
      setOverlayStyle({})
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTour = () => {
    // Don't mark as completed if skipped - allow it to show again
    // Only mark as completed if user actually completes it
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

  const handleAction = () => {
    const step = steps[currentStep]
    if (step.action) {
      // Clear overlay before navigation
      setTargetElement(null)
      setOverlayStyle({})
      
      if (step.action.href) {
        router.push(step.action.href)
        // Wait longer for navigation and page load, then continue to next step
        setTimeout(() => {
          if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
          } else {
            completeTour()
          }
        }, 2000)
      } else if (step.action.onClick) {
        step.action.onClick()
        // Continue to next step after action
        setTimeout(() => {
          if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
          } else {
            completeTour()
          }
        }, 500)
      }
    }
  }

  if (!isActive || steps.length === 0) {
    return null
  }

  // Ensure currentStep is within bounds
  if (currentStep < 0 || currentStep >= steps.length) {
    console.error('Onboarding tour: currentStep out of bounds', { currentStep, stepsLength: steps.length })
    return null
  }

  const step = steps[currentStep]
  
  // Guard against undefined step
  if (!step) {
    console.error('Onboarding tour: Step is undefined at index', currentStep)
    return null
  }

  // Guard against missing required fields
  if (!step.title || !step.description) {
    console.error('Onboarding tour: Step missing required fields', step)
    return null
  }

  const progress = ((currentStep + 1) / steps.length) * 100

  // Calculate tooltip position with viewport bounds checking
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
  }

  if (step.target && targetElement) {
    const rect = targetElement.getBoundingClientRect()
    const position = step.position || 'bottom'
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const tooltipHeight = 300 // Approximate tooltip height
    const tooltipWidth = 500 // Approximate tooltip width
    const padding = 20

    // Determine best position based on available space
    let finalPosition = position
    const spaceAbove = rect.top
    const spaceBelow = viewportHeight - rect.bottom
    const spaceLeft = rect.left
    const spaceRight = viewportWidth - rect.right

    // Auto-adjust position if not enough space
    if (position === 'bottom' && spaceBelow < tooltipHeight + padding) {
      finalPosition = spaceAbove > spaceBelow ? 'top' : 'bottom'
    } else if (position === 'top' && spaceAbove < tooltipHeight + padding) {
      finalPosition = spaceBelow > spaceAbove ? 'bottom' : 'top'
    }

    switch (finalPosition) {
      case 'top':
        const topY = Math.max(padding, rect.top - tooltipHeight - padding)
        tooltipStyle.top = `${topY}px`
        tooltipStyle.left = `${Math.max(padding, Math.min(rect.left + rect.width / 2, viewportWidth - tooltipWidth / 2 - padding))}px`
        tooltipStyle.transform = 'translateX(-50%)'
        tooltipStyle.maxHeight = `${Math.min(tooltipHeight, rect.top - padding * 2)}px`
        break
      case 'bottom':
        const bottomY = Math.min(viewportHeight - tooltipHeight - padding, rect.bottom + padding)
        tooltipStyle.top = `${bottomY}px`
        tooltipStyle.left = `${Math.max(padding, Math.min(rect.left + rect.width / 2, viewportWidth - tooltipWidth / 2 - padding))}px`
        tooltipStyle.transform = 'translateX(-50%)'
        tooltipStyle.maxHeight = `${Math.min(tooltipHeight, viewportHeight - rect.bottom - padding * 2)}px`
        break
      case 'left':
        tooltipStyle.top = `${Math.max(padding, Math.min(rect.top + rect.height / 2, viewportHeight - tooltipHeight / 2 - padding))}px`
        tooltipStyle.right = `${Math.max(padding, viewportWidth - rect.left + padding)}px`
        tooltipStyle.transform = 'translateY(-50%)'
        tooltipStyle.maxWidth = `${Math.min(tooltipWidth, rect.left - padding * 2)}px`
        break
      case 'right':
        tooltipStyle.top = `${Math.max(padding, Math.min(rect.top + rect.height / 2, viewportHeight - tooltipHeight / 2 - padding))}px`
        tooltipStyle.left = `${Math.min(viewportWidth - tooltipWidth - padding, rect.right + padding)}px`
        tooltipStyle.transform = 'translateY(-50%)'
        tooltipStyle.maxWidth = `${Math.min(tooltipWidth, viewportWidth - rect.right - padding * 2)}px`
        break
    }

    // Ensure tooltip stays within viewport
    tooltipStyle.maxWidth = tooltipStyle.maxWidth || `${Math.min(tooltipWidth, viewportWidth - padding * 2)}px`
    tooltipStyle.maxHeight = tooltipStyle.maxHeight || `${Math.min(tooltipHeight, viewportHeight - padding * 2)}px`
  } else {
    // Center for info-only steps
    tooltipStyle.top = '50%'
    tooltipStyle.left = '50%'
    tooltipStyle.transform = 'translate(-50%, -50%)'
    tooltipStyle.maxWidth = '90vw'
    tooltipStyle.maxHeight = '90vh'
  }

  const getTypeIcon = () => {
    switch (step.type) {
      case 'navigation':
        return <Navigation className="h-5 w-5 text-blue-500" />
      case 'feature':
        return <Target className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-orange-500" />
      case 'tip':
        return <HelpCircle className="h-5 w-5 text-purple-500" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getTypeBadge = () => {
    switch (step.type) {
      case 'navigation':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Navegación</Badge>
      case 'feature':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Característica</Badge>
      case 'warning':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">Importante</Badge>
      case 'tip':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">Consejo</Badge>
      default:
        return <Badge variant="outline">Información</Badge>
    }
  }

  // Ensure we have valid step data before rendering portal
  if (typeof window === 'undefined') {
    return null
  }

  return createPortal(
    <>
      {/* Overlay with highlight - Only render if we have a valid target element */}
      {step.target && targetElement && (() => {
        // Re-check element is still valid
        if (!targetElement.getBoundingClientRect) {
          return null
        }
        
        const rect = targetElement.getBoundingClientRect()
        // Double-check element is still valid and visible
        if (!rect || rect.width === 0 || rect.height === 0 || 
            rect.top < -1000 || rect.left < -1000 ||
            rect.top > window.innerHeight + 1000 || 
            rect.left > window.innerWidth + 1000) {
          return null
        }
        
        const padding = 10
        return (
          <div
            ref={overlayRef}
            className="fixed inset-0 pointer-events-auto"
            style={overlayStyle}
            onClick={(e) => {
              // Prevent clicks outside the tooltip
              e.stopPropagation()
            }}
          >
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="highlight absolute rounded-lg border-2 border-primary shadow-lg bg-white pointer-events-none transition-all duration-200"
              style={{
                top: `${rect.top - padding}px`,
                left: `${rect.left - padding}px`,
                width: `${rect.width + padding * 2}px`,
                height: `${rect.height + padding * 2}px`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              }}
            />
          </div>
        )
      })()}
      
      {/* Full overlay for info-only steps (no target) */}
      {!step.target && (
        <div className="fixed inset-0 bg-black/60 z-[9998] pointer-events-auto" />
      )}

      {/* Full overlay for info-only steps */}
      {!step.target && (
        <div className="fixed inset-0 bg-black/60 z-[9998] pointer-events-auto" />
      )}

      {/* Tooltip - Only render if step has valid data */}
      {step && step.title && step.description && (
        <Card
          data-onboarding-tour="true"
          data-step-id={step.id}
          data-step-index={currentStep}
          className={cn(
            "fixed z-[9999] w-[90vw] max-w-[500px] shadow-2xl pointer-events-auto overflow-y-auto bg-white",
            !step.target && "max-w-[600px]"
          )}
          style={{
            ...tooltipStyle,
            maxHeight: tooltipStyle.maxHeight || '80vh',
            overflowY: 'auto',
            backgroundColor: 'white'
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {step.icon || getTypeIcon()}
                  <CardTitle className="text-lg flex-1 min-w-0">
                    {step.title || 'Sin título'}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {currentStep + 1} / {steps.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {getTypeBadge()}
                </div>
                <CardDescription className="text-sm mt-2">
                  {step.description || 'Sin descripción'}
                </CardDescription>
                {step.detailedExplanation && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <strong>¿Por qué?</strong> {step.detailedExplanation}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 flex-shrink-0"
                onClick={skipTour}
                aria-label="Cerrar tour"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[60vh]">
            {/* Progress bar */}
            <div className="mb-4">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Progreso: {Math.round(progress)}%
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button variant="outline" size="sm" onClick={previousStep}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {step.action && (
                  <Button 
                    size="sm" 
                    onClick={handleAction}
                    variant={step.type === 'warning' ? 'destructive' : 'default'}
                    className="flex-shrink-0"
                  >
                    {step.action.label}
                    {step.action.href && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                )}
                {currentStep < steps.length - 1 ? (
                  <Button size="sm" onClick={nextStep} className="flex-shrink-0">
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={completeTour} className="flex-shrink-0">
                    Completar Tour
                    <CheckCircle className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>,
    document.body
  )
}
