"use client"

import { useState, useEffect, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ShoppingCart, 
  FileText, 
  Users, 
  Package, 
  TrendingUp, 
  Shield,
  AlertCircle, 
  CheckCircle,
  Calendar,
  Wrench,
  ClipboardList,
  BarChart3
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { RoleGuard, AdminOnlyGuard, AuthorizedOnlyGuard } from "@/components/auth/role-guard"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getRoleDisplayName, type ModulePermissions } from "@/lib/auth/role-permissions"

function DashboardContent() {
  const { profile, ui, authorizationLimit, organizationalContext } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showAccessAlert, setShowAccessAlert] = useState(false)

  // Check for access denied error from middleware
  useEffect(() => {
    if (searchParams.get('error') === 'access_denied') {
      setShowAccessAlert(true)
      const timer = setTimeout(() => setShowAccessAlert(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando información del usuario...</p>
        </div>
      </div>
    )
  }

  const moduleCards = [
    {
      title: "Activos",
      description: "Gestión de equipos y maquinaria",
      icon: Package,
      module: "assets" as const,
      href: "/activos",
      color: "bg-blue-500"
    },
    {
      title: "Mantenimiento", 
      description: "Planes y historial de mantenimiento",
      icon: Wrench,
      module: "maintenance" as const,
      href: "/preventivo",
      color: "bg-green-500"
    },
    {
      title: "Órdenes de Trabajo",
      description: "Gestión de órdenes de trabajo",
      icon: FileText,
      module: "work_orders" as const,
      href: "/ordenes",
      color: "bg-purple-500"
    },
    {
      title: "Compras",
      description: "Órdenes de compra y procurement",
      icon: ShoppingCart,
      module: "purchases" as const,
      href: "/compras",
      color: "bg-orange-500"
    },
    {
      title: "Inventario",
      description: "Control de stock y materiales", 
      icon: Package,
      module: "inventory" as const,
      href: "/inventario",
      color: "bg-teal-500"
    },
    {
      title: "Personal",
      description: "Gestión de recursos humanos",
      icon: Users,
      module: "personnel" as const,
      href: "/gestion/personal",
      color: "bg-indigo-500"
    },
    {
      title: "Checklists",
      description: "Inspecciones y verificaciones",
      icon: ClipboardList,
      module: "checklists" as const,
      href: "/checklists",
      color: "bg-pink-500"
    },
    {
      title: "Reportes",
      description: "Análisis y reportes del sistema",
      icon: BarChart3,
      module: "reports" as const,
      href: "/reportes",
      color: "bg-yellow-500"
    }
  ]

        const getAccessBadge = (module: string) => {
     const moduleKey = module as keyof ModulePermissions
     if (!ui.shouldShowInNavigation(moduleKey)) {
       return <Badge variant="destructive">Sin Acceso</Badge>
     }
     
     const permissions = []
     if (ui.canShowCreateButton(moduleKey)) permissions.push("Crear")
     if (ui.canShowEditButton(moduleKey)) permissions.push("Editar")
     if (ui.canShowDeleteButton(moduleKey)) permissions.push("Eliminar")
     if (ui.canShowAuthorizeButton(moduleKey)) permissions.push("Autorizar")
    
    if (permissions.length === 0) {
      return <Badge variant="outline">Solo Lectura</Badge>
    }
    
    return <Badge variant="secondary">{permissions.join(", ")}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Access Denied Alert */}
      {showAccessAlert && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acceso denegado:</strong> Tu rol {profile.role} no tiene permisos para acceder al módulo "{searchParams.get('module')}".
          </AlertDescription>
        </Alert>
      )}

      {/* User Info Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Panel de Control - {getRoleDisplayName(profile.role)}
              </CardTitle>
              <CardDescription>
                Bienvenido, {profile.nombre} {profile.apellido}
              </CardDescription>
            </div>
            <div className="text-right space-y-1">
              <div className="text-sm text-muted-foreground">Límite de Autorización</div>
              <div className="text-2xl font-bold text-green-600">
                ${authorizationLimit.toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Empleado</div>
              <div className="text-lg">{profile.employee_code || 'No asignado'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Planta</div>
              <div className="text-lg">{organizationalContext.plantName || 'Global'}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Unidad de Negocio</div>
              <div className="text-lg">{organizationalContext.businessUnitName || 'Global'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-Specific Features */}
      
      {/* GERENCIA GENERAL - Full Access Dashboard */}
      {profile?.role === 'GERENCIA_GENERAL' && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Shield className="h-5 w-5" />
              Panel de Gerencia General
            </CardTitle>
            <CardDescription className="text-purple-700">
              Acceso completo a todos los módulos del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Sin Límite de Autorización</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Autorización ilimitada para todas las operaciones
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Reportes Ejecutivos</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Acceso a todos los reportes y análisis
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Gestión Global</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Control total de todas las unidades
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Link href="/reportes?type=executive">
                  Dashboard Ejecutivo
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/compras?status=high_value">
                  Compras Alto Valor
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/gestion">
                  Configuración Sistema
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ENCARGADO MANTENIMIENTO - Maintenance Focus */}
      {profile?.role === 'ENCARGADO_MANTENIMIENTO' && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Wrench className="h-5 w-5" />
              Panel de Mantenimiento
            </CardTitle>
            <CardDescription className="text-green-700">
              Gestión completa de mantenimiento en tu planta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Control Total Mantenimiento</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Gestión completa de activos y planes
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Compras de Mantenimiento</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crear y gestionar órdenes de compra
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Checklists Completos</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crear, editar y ejecutar checklists
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
                <Link href="/ordenes?filter=pending">
                  Órdenes Pendientes
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/preventivo">
                  Plan de Mantenimiento
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/checklists/crear">
                  Nuevo Checklist
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* JEFE_PLANTA - Plant Management */}
      {profile?.role === 'JEFE_PLANTA' && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Package className="h-5 w-5" />
              Panel de Jefe de Planta
            </CardTitle>
            <CardDescription className="text-blue-700">
              Supervisión completa de {organizationalContext.plantName || 'tu planta'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Gestión de Planta</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Control de activos y personal
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Autorización $50,000</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Aprobar compras de tu planta
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Personal de Planta</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Gestión del equipo local
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/activos?plant={organizationalContext.plantId}">
                  Activos de Planta
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/ordenes?plant={organizationalContext.plantId}">
                  Órdenes de Trabajo
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/reportes?type=plant">
                  Reportes de Planta
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AUXILIAR_COMPRAS - Purchasing Focus */}
      {profile?.role === 'AUXILIAR_COMPRAS' && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <ShoppingCart className="h-5 w-5" />
              Panel de Compras
            </CardTitle>
            <CardDescription className="text-orange-700">
              Gestión exclusiva de compras e inventario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Gestión Total de Compras</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crear, editar y procesar órdenes
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Control de Inventario</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Gestión completa de stock
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Link href="/compras/crear-tipificada">
                  Nueva Orden
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/compras?status=pending">
                  Órdenes Pendientes
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/inventario">
                  Gestionar Inventario
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OPERADOR/DOSIFICADOR - Checklist Focus */}
      {(profile?.role === 'OPERADOR' || profile?.role === 'DOSIFICADOR') && (
        <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-800">
              <ClipboardList className="h-5 w-5" />
              Panel de Operación
            </CardTitle>
            <CardDescription className="text-teal-700">
              Ejecución de checklists asignados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-500" />
                    <span className="font-medium">Checklists Asignados</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Ejecutar inspecciones y verificaciones diarias
                  </p>
                </CardContent>
              </Card>
            </div>

            <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
              <Link href="/checklists">
                Ver Checklists Pendientes
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* VISUALIZADOR - Read-Only Access */}
      {profile?.role === 'VISUALIZADOR' && (
        <Card className="border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <BarChart3 className="h-5 w-5" />
              Panel de Visualización
            </CardTitle>
            <CardDescription className="text-gray-700">
              Acceso de solo lectura a la información del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Tu rol permite visualizar información pero no realizar modificaciones en el sistema.
                </AlertDescription>
              </Alert>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <Link href="/reportes">
                  Ver Reportes
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/activos">
                  Ver Activos
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/calendario">
                  Ver Calendario
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AREA_ADMINISTRATIVA Specific Features (keep existing) */}
      {profile?.role === 'AREA_ADMINISTRATIVA' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <TrendingUp className="h-5 w-5" />
              Panel Administrativo
            </CardTitle>
            <CardDescription className="text-orange-700">
              Funciones exclusivas para roles administrativos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Autorización de Compras</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Puedes autorizar compras hasta ${authorizationLimit.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Gestión de Personal</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Acceso completo a recursos humanos
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/compras?filter=pending_approval">
                  Compras Pendientes
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/gestion/personal">
                  Gestionar Personal
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/reportes?type=admin">
                  Reportes Administrativos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modules Grid */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Módulos del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {moduleCards.map((card) => {
            const hasAccess = ui.shouldShowInNavigation(card.module)
            const Icon = card.icon

            return (
              <Card 
                key={card.module} 
                className={`relative overflow-hidden transition-all hover:shadow-md ${
                  hasAccess ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-50'
                }`}
                onClick={() => hasAccess && router.push(card.href)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-md ${card.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {getAccessBadge(card.module)}
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                
                {hasAccess && (
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="flex gap-1 flex-wrap">
                                                 {ui.canShowCreateButton(card.module) && (
                           <Badge variant="outline">Crear</Badge>
                         )}
                         {ui.canShowEditButton(card.module) && (
                           <Badge variant="outline">Editar</Badge>
                         )}
                         {ui.canShowDeleteButton(card.module) && (
                           <Badge variant="outline">Eliminar</Badge>
                         )}
                         {ui.canShowAuthorizeButton(card.module) && (
                           <Badge variant="outline">Autorizar</Badge>
                         )}
                      </div>
                    </div>
                  </CardContent>
                )}

                {!hasAccess && (
                  <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                    <div className="bg-white rounded-full p-2">
                      <Shield className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Quick Actions for AREA_ADMINISTRATIVA */}
      <RoleGuard module="purchases" requireAuth>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Acciones Rápidas - Área Administrativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild variant="outline" className="h-auto p-4 flex flex-col">
                <Link href="/compras?status=pending">
                  <ShoppingCart className="h-6 w-6 mb-2" />
                  <span className="font-medium">Revisar Compras</span>
                  <span className="text-xs text-muted-foreground">Pendientes de aprobación</span>
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="h-auto p-4 flex flex-col">
                <Link href="/gestion/personal?action=new">
                  <Users className="h-6 w-6 mb-2" />
                  <span className="font-medium">Nuevo Personal</span>
                  <span className="text-xs text-muted-foreground">Registrar empleado</span>
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="h-auto p-4 flex flex-col">
                <Link href="/reportes?type=financial">
                  <BarChart3 className="h-6 w-6 mb-2" />
                  <span className="font-medium">Reportes Financieros</span>
                  <span className="text-xs text-muted-foreground">Análisis de gastos</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleGuard>

      {/* Role Limitation Notice for checklists */}
      {profile.role === 'AREA_ADMINISTRATIVA' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Nota:</strong> Tu rol de Área Administrativa no incluye acceso al módulo de Checklists. 
            Este módulo está destinado a roles operativos y de mantenimiento.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cargando Panel de Control...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  )
}
