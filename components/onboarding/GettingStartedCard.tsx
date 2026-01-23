'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BookOpen, 
  FileText, 
  HelpCircle,
  ExternalLink,
  CheckCircle,
  Shield,
  Clock,
  Users
} from 'lucide-react'
import Link from 'next/link'

interface GettingStartedCardProps {
  userRole?: string
  userName?: string
}

export function GettingStartedCard({ userRole, userName }: GettingStartedCardProps) {
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

  const getRoleGuides = (role?: string) => {
    const guides = {
      'OPERADOR': [
        { title: 'Completar Checklists Diarios', href: '/checklists', icon: CheckCircle, color: 'text-green-600' },
        { title: 'Ver Mis Activos Asignados', href: '/activos', icon: FileText, color: 'text-blue-600' },
        { title: 'Reportar Problemas', href: '/ordenes', icon: Shield, color: 'text-orange-600' }
      ],
      'JEFE_PLANTA': [
        { title: 'Dashboard de Cumplimiento', href: '/compliance', icon: Shield, color: 'text-blue-600' },
        { title: 'Activos Olvidados', href: '/compliance/activos-olvidados', icon: Clock, color: 'text-orange-600' },
        { title: 'Gestionar Personal', href: '/rh/personal', icon: Users, color: 'text-purple-600' },
        { title: 'Revisar Incidentes', href: '/compliance/incidentes', icon: FileText, color: 'text-red-600' }
      ],
      'GERENCIA_GENERAL': [
        { title: 'Dashboard de Cumplimiento', href: '/compliance', icon: Shield, color: 'text-blue-600' },
        { title: 'Reportes Ejecutivos', href: '/reportes', icon: FileText, color: 'text-green-600' },
        { title: 'Configuración del Sistema', href: '/compliance/configuracion', icon: CheckCircle, color: 'text-purple-600' }
      ]
    }

    return guides[role as keyof typeof guides] || guides['OPERADOR']
  }

  const roleGuides = getRoleGuides(userRole)

  return (
    <Card className="w-full border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-2xl flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Bienvenido a MantenPro
            </CardTitle>
            <CardDescription className="text-base">
              Hola {userName} • {getRoleDisplayName(userRole)}
            </CardDescription>
          </div>
          <Badge className="bg-blue-600">Nuevo</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Quick Start Section */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Primeros Pasos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roleGuides.map((guide, index) => {
              const Icon = guide.icon
              return (
                <Link key={index} href={guide.href}>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-4 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${guide.color}`} />
                      </div>
                      <div className="text-left flex-1">
                        <div className="font-medium">{guide.title}</div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Start Guided Tour */}
        <div className="pt-4 border-t">
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            ¿Necesitas ayuda?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="justify-start"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // Clear all tour completion flags
                  localStorage.removeItem('interactive_tour_completed')
                  localStorage.removeItem('nextstep_tour_operator-onboarding_completed')
                  localStorage.removeItem('nextstep_tour_manager-onboarding_completed')
                  localStorage.removeItem('nextstep_tour_admin-onboarding_completed')
                  localStorage.removeItem('nextstep_tour_default-onboarding_completed')
                  // Reload to restart tour
                  window.location.reload()
                }
              }}
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Iniciar Tour Interactivo
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/compliance">
                <Shield className="h-4 w-4 mr-2" />
                Ver Políticas
              </Link>
            </Button>
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-sm">Cumplimiento de Políticas</p>
              <p className="text-sm text-muted-foreground">
                Este sistema está diseñado para cumplir con la Política POL-OPE-001 de Mantenimiento. 
                Todas las funciones están alineadas con los requisitos de la empresa.
              </p>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <div className="flex justify-end pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('getting_started_dismissed', 'true')
                window.location.reload()
              }
            }}
          >
            Entendido, no mostrar de nuevo
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
