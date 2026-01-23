'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { X, ChevronRight, ChevronLeft, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface TourStep {
  title: string
  description: string
  action?: {
    label: string
    href?: string
  }
}

interface SimpleTourProps {
  userRole?: string
  onComplete: () => void
  onSkip: () => void
}

export function SimpleTour({ userRole, onComplete, onSkip }: SimpleTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  const getStepsForRole = (role?: string): TourStep[] => {
    const commonSteps: TourStep[] = [
      {
        title: '¡Bienvenido al Sistema de Mantenimiento!',
        description: 'Este sistema te ayudará a gestionar el mantenimiento preventivo y correctivo de todos los activos de la empresa. Está diseñado para cumplir con la Política POL-OPE-001 de Mantenimiento.'
      },
      {
        title: 'Navegación del Sistema',
        description: 'Usa el menú lateral izquierdo para navegar entre módulos. Cada sección está organizada por función: Activos, Checklists, Órdenes de Trabajo, Compras, y más.'
      }
    ]

    if (['OPERADOR', 'DOSIFICADOR'].includes(role || '')) {
      return [
        ...commonSteps,
        {
          title: 'Checklists Diarios - Tu Responsabilidad',
          description: 'Los checklists diarios son OBLIGATORIOS según la política. Si no completas tu checklist, NO recibirás el pago del día y las operaciones pueden bloquearse.',
          action: {
            label: 'Ir a Mis Checklists',
            href: '/checklists'
          }
        },
        {
          title: 'Activos Asignados',
          description: 'Puedes ver todos los activos bajo tu responsabilidad en la sección de Activos. Asegúrate de completar los checklists diarios para cada uno.',
          action: {
            label: 'Ver Mis Activos',
            href: '/activos'
          }
        },
        {
          title: '¡Listo para Empezar!',
          description: 'Ya conoces lo esencial. Recuerda: completa tus checklists diarios y reporta cualquier problema inmediatamente. ¡Éxito!'
        }
      ]
    }

    if (['JEFE_PLANTA', 'JEFE_UNIDAD_NEGOCIO', 'GERENCIA_GENERAL'].includes(role || '')) {
      return [
        ...commonSteps,
        {
          title: 'Dashboard de Cumplimiento',
          description: 'Monitorea el cumplimiento de la Política POL-OPE-001. Ve qué activos no tienen operadores, qué checklists están pendientes, y qué incidentes han ocurrido.',
          action: {
            label: 'Ver Dashboard de Cumplimiento',
            href: '/compliance'
          }
        },
        {
          title: 'Activos Olvidados',
          description: 'El sistema identifica automáticamente activos sin checklists recientes o sin operador asignado. Como Jefe de Planta, eres responsable de estos activos.',
          action: {
            label: 'Ver Activos Olvidados',
            href: '/compliance/activos-olvidados'
          }
        },
        {
          title: 'Gestión de Personal',
          description: 'Asigna operadores a activos, gestiona turnos, y monitorea el cumplimiento de tu equipo.',
          action: {
            label: 'Gestionar Personal',
            href: '/rh/personal'
          }
        },
        {
          title: '¡Listo para Gestionar!',
          description: 'Ya conoces las herramientas principales. Usa el dashboard de cumplimiento como tu punto de partida cada día.'
        }
      ]
    }

    return [
      ...commonSteps,
      {
        title: 'Explora el Sistema',
        description: 'Usa el menú lateral para explorar las diferentes secciones del sistema. Cada módulo tiene su propia funcionalidad específica.',
        action: {
          label: 'Ir al Dashboard',
          href: '/dashboard'
        }
      }
    ]
  }

  const steps = getStepsForRole(userRole)
  const progress = ((currentStep + 1) / steps.length) * 100
  const currentStepData = steps[currentStep]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('simple_tour_completed', 'true')
    }
    onComplete()
  }

  const handleAction = () => {
    if (currentStepData.action?.href) {
      router.push(currentStepData.action.href)
      setTimeout(() => {
        handleComplete()
      }, 500)
    }
  }

  if (!currentStepData) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="pr-10">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl">{currentStepData.title}</CardTitle>
              <Badge variant="outline">
                {currentStep + 1} / {steps.length}
              </Badge>
            </div>
            <CardDescription className="text-base">
              {currentStepData.description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Progreso: {Math.round(progress)}%
            </p>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={onSkip}>
                Saltar
              </Button>
              
              {currentStepData.action ? (
                <Button onClick={handleAction}>
                  {currentStepData.action.label}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : currentStep < steps.length - 1 ? (
                <Button onClick={handleNext}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  Completar
                  <CheckCircle className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Can return to tour hint */}
          <div className="text-xs text-center text-muted-foreground">
            Puedes reiniciar este tour en cualquier momento desde el botón "Reiniciar Tour"
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

