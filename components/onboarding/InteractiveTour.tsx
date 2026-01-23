'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, ChevronRight, CheckCircle, MapPin } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

interface TourStep {
  id: string
  title: string
  description: string
  target?: string // CSS selector or data-tour attribute
  page: string // Required page path
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: string // Action text
  highlight?: boolean // Whether to highlight the target
}

interface InteractiveTourProps {
  userRole?: string
  onComplete: () => void
  onSkip: () => void
}

export function InteractiveTour({ userRole, onComplete, onSkip }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const router = useRouter()
  const pathname = usePathname()
  const cardRef = useRef<HTMLDivElement>(null)

  const getStepsForRole = (role?: string): TourStep[] => {
    const commonStart: TourStep[] = [
      {
        id: 'welcome',
        title: '¡Bienvenido al Sistema de Mantenimiento!',
        description: 'Te voy a mostrar las partes más importantes del sistema. Haz clic en "Siguiente" para comenzar.',
        page: '/dashboard',
        position: 'bottom'
      },
      {
        id: 'sidebar',
        title: 'Menú de Navegación',
        description: 'Aquí encuentras todos los módulos del sistema. Cada sección tiene funciones específicas organizadas por categoría.',
        target: '[data-tour="sidebar"]',
        page: '/dashboard',
        position: 'right',
        highlight: true
      }
    ]

    if (['OPERADOR', 'DOSIFICADOR'].includes(role || '')) {
      return [
        ...commonStart,
        {
          id: 'checklists',
          title: 'Checklists - Tu Responsabilidad Principal',
          description: '¡IMPORTANTE! Los checklists diarios son OBLIGATORIOS. Si no completas tu checklist, no recibirás el pago del día. Haz clic en "Ver Checklists" para verlos ahora.',
          target: 'a[href="/checklists"]',
          page: '/dashboard',
          position: 'right',
          action: 'Ver Mis Checklists',
          highlight: true
        },
        {
          id: 'checklist-list',
          title: 'Lista de Checklists',
          description: 'Aquí verás todos los checklists asignados a tus activos. Los checklists pendientes aparecen primero. Completa cada uno antes de operar el equipo.',
          page: '/checklists',
          position: 'top',
          highlight: false
        },
        {
          id: 'assets',
          title: 'Tus Activos Asignados',
          description: 'Haz clic aquí para ver todos los activos bajo tu responsabilidad. Cada activo necesita su checklist diario completado.',
          target: 'a[href="/activos"]',
          page: '/dashboard',
          position: 'right',
          action: 'Ver Mis Activos',
          highlight: true
        },
        {
          id: 'complete',
          title: '¡Listo para Trabajar!',
          description: 'Ya conoces lo esencial. Recuerda: completa tus checklists diarios ANTES de operar cualquier equipo. ¡Éxito!',
          page: '/dashboard',
          position: 'bottom'
        }
      ]
    }

    if (['JEFE_PLANTA', 'JEFE_UNIDAD_NEGOCIO', 'GERENCIA_GENERAL'].includes(role || '')) {
      return [
        ...commonStart,
        {
          id: 'compliance',
          title: 'Dashboard de Cumplimiento',
          description: 'Esta es tu herramienta principal. Monitorea el cumplimiento de políticas, activos sin operadores, y checklists pendientes. Haz clic para verlo.',
          target: '[data-tour="compliance"]',
          page: '/dashboard',
          position: 'right',
          action: 'Ver Cumplimiento',
          highlight: true
        },
        {
          id: 'compliance-dashboard',
          title: 'Panel de Control',
          description: 'Aquí ves el estado de cumplimiento en tiempo real. Los semáforos indican la gravedad: Verde = OK, Amarillo = Advertencia, Naranja = Crítico, Rojo = Emergencia.',
          target: '[data-tour="compliance-dashboard"]',
          page: '/compliance',
          position: 'top',
          highlight: true
        },
        {
          id: 'forgotten-assets',
          title: 'Activos Olvidados',
          description: 'El sistema identifica automáticamente activos sin checklists recientes o sin operador. Como jefe, eres responsable de estos activos.',
          target: 'a[href="/compliance/activos-olvidados"]',
          page: '/compliance',
          position: 'right',
          action: 'Ver Activos Olvidados',
          highlight: true
        },
        {
          id: 'personnel',
          title: 'Gestión de Personal',
          description: 'Asigna operadores a activos, gestiona turnos, y monitorea el cumplimiento de tu equipo desde aquí.',
          target: 'a[href="/rh/personal"]',
          page: '/dashboard',
          position: 'right',
          action: 'Ver Personal',
          highlight: true
        },
        {
          id: 'complete',
          title: '¡Listo para Gestionar!',
          description: 'Usa el dashboard de cumplimiento como tu punto de partida cada día. Revisa los semáforos y actúa sobre los alertas.',
          page: '/dashboard',
          position: 'bottom'
        }
      ]
    }

    return [
      ...commonStart,
      {
        id: 'explore',
        title: 'Explora el Sistema',
        description: 'Usa el menú lateral para explorar las diferentes secciones. Cada módulo está diseñado para una función específica.',
        target: '[data-tour="sidebar"]',
        page: '/dashboard',
        position: 'right',
        highlight: true
      },
      {
        id: 'complete',
        title: '¡Todo Listo!',
        description: 'Ya conoces los elementos básicos. Puedes comenzar a usar el sistema.',
        page: '/dashboard',
        position: 'bottom'
      }
    ]
  }

  const steps = getStepsForRole(userRole)
  const currentStepData = steps[currentStep]

  useEffect(() => {
    if (!currentStepData) return

    // Navigate to required page if not there
    if (pathname !== currentStepData.page) {
      router.push(currentStepData.page)
      return
    }

    // Find and highlight target element
    if (currentStepData.target) {
      const findElement = () => {
        const element = document.querySelector(currentStepData.target!) as HTMLElement
        if (element) {
          setTargetElement(element)
          updateTooltipPosition(element)
          
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else {
          // Retry after a short delay
          setTimeout(findElement, 200)
        }
      }
      findElement()
    } else {
      setTargetElement(null)
    }
  }, [currentStep, currentStepData, pathname])

  const updateTooltipPosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const position = currentStepData.position || 'bottom'
    
    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top - 20
        left = rect.left + rect.width / 2
        break
      case 'bottom':
        top = rect.bottom + 20
        left = rect.left + rect.width / 2
        break
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - 20
        break
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + 20
        break
    }

    setTooltipPosition({ top, left })
  }

  const handleNext = () => {
    if (currentStepData.action && currentStepData.target) {
      // User wants to interact with the highlighted element
      const element = document.querySelector(currentStepData.target) as HTMLElement
      if (element) {
        element.click()
        // Move to next step after navigation
        setTimeout(() => {
          setCurrentStep(currentStep + 1)
        }, 500)
      }
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('interactive_tour_completed', 'true')
    }
    onComplete()
  }

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('interactive_tour_completed', 'true')
    }
    onSkip()
  }

  if (!currentStepData) return null

  const progress = ((currentStep + 1) / steps.length) * 100
  const isLastStep = currentStep === steps.length - 1

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[9998]" onClick={handleSkip} />

      {/* Highlight for target element */}
      {targetElement && currentStepData.highlight && (
        <div
          className="fixed pointer-events-none z-[9999] ring-4 ring-blue-500 ring-offset-2 rounded-lg transition-all duration-300"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
          }}
        />
      )}

      {/* Tooltip Card */}
      <Card
        ref={cardRef}
        className="fixed z-[10000] w-96 shadow-2xl"
        style={
          targetElement && currentStepData.target
            ? {
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transform:
                  currentStepData.position === 'right'
                    ? 'translateY(-50%)'
                    : currentStepData.position === 'left'
                    ? 'translate(-100%, -50%)'
                    : currentStepData.position === 'top'
                    ? 'translate(-50%, -100%)'
                    : 'translate(-50%, 0)',
              }
            : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }
        }
      >
        <CardHeader className="relative pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <Badge variant="outline" className="text-xs">
                  Paso {currentStep + 1} de {steps.length}
                </Badge>
              </div>
              <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{currentStepData.description}</p>

          {/* Progress */}
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Saltar Tour
            </Button>

            {isLastStep ? (
              <Button onClick={handleComplete}>
                Completar
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNext}>
                {currentStepData.action || 'Siguiente'}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

