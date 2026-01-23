import { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Users, Package, BarChart3, ArrowRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Gestión Organizacional',
  description: 'Panel principal de gestión organizacional',
}

const managementModules = [
  {
    title: 'Gestión de Plantas',
    description: 'Configura plantas, ubicaciones y estructura organizacional',
    href: '/gestion/plantas',
    icon: Building2,
    color: 'bg-blue-500',
    features: [
      'Configuración de plantas',
      'Asignación de personal',
      'Gestión de permisos',
      'Estructura organizacional'
    ]
  },
  {
    title: 'Gestión de Personal',
    description: 'Administra empleados, roles y asignaciones con drag & drop',
    href: '/gestion/personal',
    icon: Users,
    color: 'bg-green-500',
    features: [
      'Drag & drop de personal',
      'Gestión de roles',
      'Asignación a plantas',
      'Control de permisos'
    ]
  },
  {
    title: 'Asignación de Activos',
    description: 'Asigna operadores a activos de manera visual e intuitiva',
    href: '/gestion/activos/asignaciones',
    icon: Package,
    color: 'bg-purple-500',
    features: [
      'Drag & drop de activos',
      'Operadores primarios/secundarios',
      'Validación automática',
      'Historial de asignaciones'
    ]
  },
  {
    title: 'Activos a Plantas',
    description: 'Asigna activos a plantas con jerarquía por unidades de negocio',
    href: '/gestion/activos/asignacion-plantas',
    icon: Package,
    color: 'bg-teal-500',
    features: [
      'Drag & drop de activos',
      'Vista jerárquica organizacional',
      'Control por unidades de negocio',
      'Auditoría de movimientos'
    ]
  },
  {
    title: 'Reportes y Análisis',
    description: 'Visualiza métricas organizacionales y de rendimiento',
    href: '/gestion/reportes',
    icon: BarChart3,
    color: 'bg-orange-500',
    features: [
      'Métricas organizacionales',
      'Análisis de asignaciones',
      'Reportes de eficiencia',
      'Dashboards interactivos'
    ]
  }
]

const quickStats = [
  { label: 'Plantas Activas', value: '5', trend: '+0%' },
  { label: 'Personal Total', value: '24', trend: '+12%' },
  { label: 'Activos Asignados', value: '18/20', trend: '+5%' },
  { label: 'Eficiencia', value: '94%', trend: '+3%' }
]

export default function GestionPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4" id="gestion-organizacional-header">
        <h1 className="text-4xl font-bold text-gray-900">
          Gestión Organizacional
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Sistema integral para la gestión de plantas, personal y activos con interfaces 
          intuitivas de drag & drop diseñadas para operaciones logísticas eficientes.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="flex items-center space-x-1 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">{stat.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Management Modules */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Módulos de Gestión</h2>
          <p className="text-gray-600 mt-2">
            Herramientas especializadas para la gestión organizacional moderna
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {managementModules.map((module, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${module.color}`}>
                      <module.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{module.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {module.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">Nuevo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Características:</h4>
                  <ul className="space-y-1">
                    {module.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href={module.href}>
                  <Button className="w-full group">
                    Acceder al Módulo
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            ¿Listo para optimizar tu gestión organizacional?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Comienza configurando tus plantas y asignando personal con nuestras 
            herramientas intuitivas de drag & drop.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/gestion/plantas">
              <Button size="lg" className="w-full sm:w-auto">
                Configurar Plantas
              </Button>
            </Link>
            <Link href="/gestion/personal">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Gestionar Personal
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 