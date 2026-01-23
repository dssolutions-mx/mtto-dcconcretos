'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Building2,
  Shield,
  Clock,
  CheckCircle,
  PlayCircle,
  BookOpen,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface OnboardingWelcomeScreenProps {
  userRole?: string
  userName?: string
  onStart: (path: 'quick' | 'full' | 'custom') => void
  onSkip: () => void
}

export function OnboardingWelcomeScreen({
  userRole,
  userName,
  onStart,
  onSkip
}: OnboardingWelcomeScreenProps) {
  const [selectedPath, setSelectedPath] = useState<'quick' | 'full' | 'custom' | null>(null)

  const getRoleDisplayName = (role?: string) => {
    const roleNames: Record<string, string> = {
      'OPERADOR': 'Operador',
      'DOSIFICADOR': 'Dosificador',
      'JEFE_PLANTA': 'Jefe de Planta',
      'ENCARGADO_MANTENIMIENTO': 'Encargado de Mantenimiento',
      'JEFE_UNIDAD_NEGOCIO': 'Jefe de Unidad de Negocio',
      'AREA_ADMINISTRATIVA': 'Área Administrativa',
      'GERENCIA_GENERAL': 'Gerencia General'
    }
    return roleNames[role || ''] || 'Usuario'
  }

  const learningPaths = [
    {
      id: 'quick',
      name: 'Tour Rápido',
      duration: '5 minutos',
      description: 'Lo esencial para empezar',
      features: ['Navegación básica', 'Funciones principales', 'Primeros pasos'],
      icon: PlayCircle,
      recommended: false
    },
    {
      id: 'full',
      name: 'Tour Completo',
      duration: '15 minutos',
      description: 'Domina todo el sistema',
      features: ['Todo lo del tour rápido', 'Funciones avanzadas', 'Mejores prácticas', 'Tips y trucos'],
      icon: BookOpen,
      recommended: true
    },
    {
      id: 'custom',
      name: 'Personalizado',
      duration: 'Tú decides',
      description: 'Elige qué aprender',
      features: ['Módulos a tu medida', 'Salta lo que ya sabes', 'Enfoque en tu rol'],
      icon: Sparkles,
      recommended: false
    }
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-4xl"
        >
          <Card className="relative overflow-hidden shadow-2xl border-2">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10"
              onClick={onSkip}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Header with branding */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <Building2 className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-1">
                    ¡Bienvenido a MantenPro!
                  </h1>
                  <p className="text-blue-100 text-lg">
                    Hola {userName || 'Usuario'} • {getRoleDisplayName(userRole)}
                  </p>
                </div>
              </div>
              <p className="text-blue-50 text-lg max-w-2xl">
                Sistema integral de gestión de mantenimiento diseñado para maximizar la eficiencia 
                y cumplir con las políticas de la empresa.
              </p>
            </div>

            <CardContent className="p-8 space-y-6">
              {/* Benefits section */}
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Lo que aprenderás
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      icon: Shield,
                      title: 'Cumplimiento',
                      description: 'Políticas y procedimientos obligatorios'
                    },
                    {
                      icon: Clock,
                      title: 'Eficiencia',
                      description: 'Optimiza tu trabajo diario'
                    },
                    {
                      icon: Sparkles,
                      title: 'Funciones avanzadas',
                      description: 'Aprovecha todo el potencial'
                    }
                  ].map((benefit, index) => (
                    <div key={index} className="flex gap-3 p-4 rounded-lg bg-muted/50">
                      <benefit.icon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-medium mb-1">{benefit.title}</h3>
                        <p className="text-sm text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning paths */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Elige tu ruta de aprendizaje</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {learningPaths.map((path) => {
                    const Icon = path.icon
                    const isSelected = selectedPath === path.id
                    
                    return (
                      <button
                        key={path.id}
                        onClick={() => setSelectedPath(path.id as any)}
                        className={cn(
                          "relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-lg",
                          isSelected
                            ? "border-blue-600 bg-blue-50 shadow-md"
                            : "border-gray-200 hover:border-blue-300"
                        )}
                      >
                        {path.recommended && (
                          <Badge className="absolute top-3 right-3 bg-green-600">
                            Recomendado
                          </Badge>
                        )}
                        
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                          isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600"
                        )}>
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-1">{path.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Clock className="h-3.5 w-3.5" />
                          {path.duration}
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{path.description}</p>
                        
                        <ul className="space-y-2">
                          {path.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm">
                              <CheckCircle className={cn(
                                "h-4 w-4 flex-shrink-0",
                                isSelected ? "text-blue-600" : "text-gray-400"
                              )} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  className="text-muted-foreground"
                >
                  Saltar por ahora
                </Button>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onStart('quick')}
                  >
                    Tour Rápido (5 min)
                  </Button>
                  <Button
                    onClick={() => onStart(selectedPath || 'full')}
                    disabled={!selectedPath}
                    className="gap-2"
                  >
                    {selectedPath ? 'Comenzar' : 'Selecciona una opción'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress indicator for returning users */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Tu progreso será guardado</p>
                  <Badge variant="outline">Puedes volver cuando quieras</Badge>
                </div>
                <Progress value={0} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Podrás pausar y continuar más tarde desde donde lo dejaste
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
