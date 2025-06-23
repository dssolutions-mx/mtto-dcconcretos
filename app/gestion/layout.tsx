import { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Users, Package, BarChart3, Settings, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: {
    template: '%s | Gestión Organizacional',
    default: 'Gestión Organizacional',
  },
  description: 'Sistema de gestión organizacional para plantas, personal y activos',
}

const navigationItems = [
  {
    title: 'Plantas',
    href: '/gestion/plantas',
    icon: Building2,
    description: 'Configurar plantas y ubicaciones'
  },
  {
    title: 'Personal',
    href: '/gestion/personal',
    icon: Users,
    description: 'Gestionar empleados y roles'
  },
  {
    title: 'Asignación de Activos',
    href: '/gestion/activos/asignaciones',
    icon: Package,
    description: 'Asignar operadores a activos'
  },
  {
    title: 'Autorizaciones',
    href: '/gestion/autorizaciones',
    icon: Shield,
    description: 'Configurar límites y delegaciones de autorización'
  },
  {
    title: 'Reportes',
    href: '/gestion/reportes',
    icon: BarChart3,
    description: 'Análisis organizacional'
  }
]

export default function GestionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/gestion" className="flex items-center space-x-2">
                <Settings className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Gestión Organizacional</span>
              </Link>
            </div>
            <nav className="hidden md:flex space-x-1">
              {navigationItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
} 