'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  Building2, 
  MapPin, 
  Package, 
  UserCheck, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  Target,
  Info,
  Loader2
} from 'lucide-react'
import { PersonnelManagementDragDrop } from './personnel-management-drag-drop'
import { AssetPlantAssignmentDragDrop } from '@/components/assets/asset-plant-assignment-drag-drop'
import { AssetAssignmentDragDrop } from '@/components/assets/asset-assignment-drag-drop'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { toast } from 'react-hot-toast'

type WizardStep = 'personnel' | 'assets' | 'operators' | 'complete'

interface StepConfig {
  id: WizardStep
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<any>
  tips: string[]
}

const steps: StepConfig[] = [
  {
    id: 'personnel',
    title: 'Paso 1: Asignar Personal',
    description: 'Asigna personal a plantas o unidades de negocio',
    icon: Users,
    component: PersonnelManagementDragDrop,
    tips: [
      'Usa asignación masiva para mover múltiples operadores a la vez',
      'Los operadores sin asignar aparecen en la sección "Sin Asignar"',
      'Puedes arrastrar operadores entre unidades de negocio y plantas'
    ]
  },
  {
    id: 'assets',
    title: 'Paso 2: Asignar Activos a Plantas',
    description: 'Ubica activos en plantas específicas',
    icon: Package,
    component: AssetPlantAssignmentDragDrop,
    tips: [
      'Después de asignar un activo, se te pedirá asignar un operador automáticamente',
      'Si un activo tiene operadores asignados, se te preguntará cómo resolver el conflicto',
      'Puedes mover activos entre plantas de la misma unidad de negocio'
    ]
  },
  {
    id: 'operators',
    title: 'Paso 3: Asignar Operadores a Activos',
    description: 'Conecta operadores con los activos que operarán',
    icon: UserCheck,
    component: AssetAssignmentDragDrop,
    tips: [
      'Cada activo puede tener un operador principal y múltiples secundarios',
      'Selecciona una planta para ver sus activos y operadores disponibles',
      'Arrastra operadores desde la columna izquierda hacia los activos'
    ]
  }
]

export function UnifiedAssignmentWizard() {
  const { profile } = useAuthZustand()
  const [currentStep, setCurrentStep] = useState<WizardStep>('personnel')
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [isNavigating, setIsNavigating] = useState(false)

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const handleStepComplete = useCallback(() => {
    const currentStepId = currentStep
    setCompletedSteps(prev => new Set([...prev, currentStepId]))
    
    // Auto-advance to next step if not the last one
    if (currentStepId !== 'operators') {
      const nextStepIndex = steps.findIndex(s => s.id === currentStepId) + 1
      if (nextStepIndex < steps.length) {
        setTimeout(() => {
          setIsNavigating(true)
          setTimeout(() => {
            setCurrentStep(steps[nextStepIndex].id as WizardStep)
            setIsNavigating(false)
          }, 300)
        }, 500)
      }
    } else {
      // Last step completed
      setCurrentStep('complete')
    }
  }, [currentStep])

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setIsNavigating(true)
      setTimeout(() => {
        setCurrentStep(steps[currentStepIndex + 1].id as WizardStep)
        setIsNavigating(false)
      }, 300)
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setIsNavigating(true)
      setTimeout(() => {
        setCurrentStep(steps[currentStepIndex - 1].id as WizardStep)
        setIsNavigating(false)
      }, 300)
    }
  }

  const handleStepClick = (stepId: WizardStep) => {
    const stepIndex = steps.findIndex(s => s.id === stepId)
    if (stepIndex <= currentStepIndex || completedSteps.has(stepId)) {
      setIsNavigating(true)
      setTimeout(() => {
        setCurrentStep(stepId)
        setIsNavigating(false)
      }, 300)
    }
  }

  const CurrentStepComponent = steps[currentStepIndex]?.component

  if (currentStep === 'complete') {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-800">
              ¡Asignaciones Completadas!
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Has completado el proceso de asignación. El personal, activos y operadores están correctamente organizados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {steps.map((step, index) => (
                <div 
                  key={step.id}
                  className="flex items-center gap-3 p-4 bg-white rounded-lg border border-green-200"
                >
                  <div className="flex-shrink-0">
                    <div className="rounded-full bg-green-100 p-2">
                      <step.icon className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">
                      Paso {index + 1}
                    </p>
                    <p className="text-xs text-gray-600">
                      {step.title.replace('Paso ' + (index + 1) + ': ', '')}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep('personnel')
                  setCompletedSteps(new Set())
                }}
              >
                Iniciar Nuevo Proceso
              </Button>
              <Button
                onClick={() => {
                  setCurrentStep('operators')
                  setCompletedSteps(new Set(['personnel', 'assets']))
                }}
              >
                Revisar Asignaciones
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b" id="asignaciones-organizacionales-header">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-6 w-6 text-blue-600" />
                Asignación Organizacional
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Proceso guiado para organizar personal, activos y operadores en tu estructura organizacional
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1 bg-white">
              {currentStepIndex + 1} de {steps.length}
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-xs text-gray-600">
              <span>{Math.round(progress)}% completado</span>
              <span>{completedSteps.size} de {steps.length} pasos completados</span>
            </div>
          </div>
        </CardHeader>

        {/* Step Navigation */}
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = step.id === currentStep
              const isCompleted = completedSteps.has(step.id)
              const isAccessible = index <= currentStepIndex || isCompleted

              return (
                <div key={step.id} className="flex-1 flex items-center">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center flex-1">
                    <button
                      onClick={() => isAccessible && handleStepClick(step.id)}
                      disabled={!isAccessible}
                      className={`
                        relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all
                        ${isActive 
                          ? 'border-blue-500 bg-blue-100 scale-110 shadow-lg' 
                          : isCompleted
                          ? 'border-green-500 bg-green-100'
                          : isAccessible
                          ? 'border-gray-300 bg-gray-50 hover:border-gray-400'
                          : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      )}
                      {isActive && (
                        <div className="absolute -inset-1 rounded-full border-2 border-blue-300 animate-pulse" />
                      )}
                    </button>
                    <div className="mt-2 text-center max-w-[120px]">
                      <p className={`text-xs font-medium ${
                        isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {step.title.replace('Paso ' + (index + 1) + ': ', '')}
                      </p>
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className={`
                      flex-1 h-0.5 mx-2 transition-all
                      ${isCompleted ? 'bg-green-500' : index < currentStepIndex ? 'bg-gray-300' : 'bg-gray-200'}
                    `} />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <div className={`
        transition-opacity duration-300
        ${isNavigating ? 'opacity-0' : 'opacity-100'}
      `}>
        <Card className="border-2 shadow-lg overflow-visible">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    {React.createElement(steps[currentStepIndex].icon, { className: 'h-6 w-6 text-blue-600' })}
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {steps[currentStepIndex].title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {steps[currentStepIndex].description}
                    </CardDescription>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="text-sm">
                Paso {currentStepIndex + 1}
              </Badge>
            </div>
          </CardHeader>

          {/* Tips Alert */}
          <CardContent className="pt-6 pb-0">
            <Alert className="mb-6 border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                <strong>Consejo:</strong> {steps[currentStepIndex].tips[0]}
              </AlertDescription>
            </Alert>
          </CardContent>

          {/* Step Component - Rendered outside CardContent to avoid padding interference */}
          <div className="px-6 pb-6 min-h-[600px]" style={{ pointerEvents: isNavigating ? 'none' : 'auto' }}>
            {CurrentStepComponent && <CurrentStepComponent />}
          </div>

          {/* Navigation Buttons */}
          <CardContent className="pt-6 border-t">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStepIndex === 0}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>

              <div className="flex gap-2 flex-wrap justify-center">
                {steps[currentStepIndex].tips.slice(1).map((tip, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {tip}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2">
                {currentStepIndex < steps.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    Continuar sin completar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button
                  onClick={handleStepComplete}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                >
                  {currentStepIndex === steps.length - 1 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Completar Proceso
                    </>
                  ) : (
                    <>
                      Marcar como Completado
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paso Actual</p>
                <p className="text-2xl font-bold text-blue-600">
                  {currentStepIndex + 1}/{steps.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                {React.createElement(steps[currentStepIndex].icon, { className: 'h-6 w-6 text-blue-600' })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completados</p>
                <p className="text-2xl font-bold text-green-600">
                  {completedSteps.size}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Progreso</p>
                <p className="text-2xl font-bold text-purple-600">
                  {Math.round(progress)}%
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

