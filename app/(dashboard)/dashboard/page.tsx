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
  BarChart3,
  Loader2,
  ChevronRight,
  RefreshCw
} from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useIsMobile } from "@/hooks/use-mobile"
import { RoleGuard, AdminOnlyGuard, AuthorizedOnlyGuard } from "@/components/auth/role-guard"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getRoleDisplayName, type ModulePermissions } from "@/lib/auth/role-permissions"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"

function DashboardContent() {
  const { 
    profile, 
    ui, 
    authorizationLimit, 
    organizationalContext, 
    isLoading, 
    isInitialized, 
    isAuthenticated,
    error,
    refreshProfile
  } = useAuthZustand()
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [showAccessAlert, setShowAccessAlert] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Handler to refresh profile
  const handleRefreshProfile = async () => {
    setIsRefreshing(true)
    try {
      await refreshProfile()
      console.log('✅ Profile refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh profile:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Check for access denied error from middleware
  useEffect(() => {
    if (searchParams.get('error') === 'access_denied') {
      setShowAccessAlert(true)
      const timer = setTimeout(() => setShowAccessAlert(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  // Show loading state while initializing
  if (!isInitialized || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center space-y-4 max-w-sm">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <p className={cn(
              "font-medium",
              isMobile ? "text-base" : "text-lg"
            )}>
              Cargando Dashboard
            </p>
            <p className={cn(
              "text-muted-foreground",
              isMobile ? "text-sm" : "text-sm"
            )}>
              {!isInitialized ? 'Inicializando sistema...' : 'Cargando información del usuario...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <Alert variant="destructive" className={cn(
          "max-w-md w-full",
          isMobile && "mx-4"
        )}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p><strong>Error de autenticación:</strong></p>
              <p className="text-sm">{typeof error === 'string' ? error : error.message || 'Error desconocido'}</p>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => router.push('/login')}
                className={cn(
                  "mt-2 w-full",
                  isMobile && "min-h-[44px]" // Better touch target
                )}
              >
                Volver al login
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Show authentication required
  if (!isAuthenticated || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <Alert className={cn(
          "max-w-md w-full",
          isMobile && "mx-4"
        )}>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-3">
              <p><strong>Autenticación requerida</strong></p>
              <p className="text-sm">Debes iniciar sesión para acceder al dashboard.</p>
              <Button
                variant="default"
                size={isMobile ? "default" : "sm"}
                onClick={() => router.push('/login')}
                className={cn(
                  "mt-2 w-full",
                  isMobile && "min-h-[44px]" // Better touch target
                )}
              >
                Iniciar sesión
              </Button>
            </div>
          </AlertDescription>
        </Alert>
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
      color: "bg-blue-500",
      shortDesc: "Equipos"
    },
    {
      title: "Mantenimiento", 
      description: "Planes y historial de mantenimiento",
      icon: Wrench,
      module: "maintenance" as const,
      href: "/preventivo",
      color: "bg-green-500",
      shortDesc: "Planes"
    },
    {
      title: "Órdenes de Trabajo",
      description: "Gestión de órdenes de trabajo",
      icon: FileText,
      module: "work_orders" as const,
      href: "/ordenes",
      color: "bg-purple-500",
      shortDesc: "Órdenes"
    },
    {
      title: "Compras",
      description: "Órdenes de compra y procurement",
      icon: ShoppingCart,
      module: "purchases" as const,
      href: "/compras",
      color: "bg-orange-500",
      shortDesc: "Compras"
    },
    {
      title: "Inventario",
      description: "Control de stock y materiales", 
      icon: Package,
      module: "inventory" as const,
      href: "/inventario",
      color: "bg-teal-500",
      shortDesc: "Stock"
    },
    {
      title: "Personal",
      description: "Gestión de recursos humanos",
      icon: Users,
      module: "personnel" as const,
      href: "/gestion/personal",
      color: "bg-indigo-500",
      shortDesc: "Personal"
    },
    {
      title: "Checklists",
      description: "Inspecciones y verificaciones",
      icon: ClipboardList,
      module: "checklists" as const,
      href: "/checklists",
      color: "bg-pink-500",
      shortDesc: "Inspecciones"
    },
    {
      title: "Reportes",
      description: "Análisis y reportes del sistema",
      icon: BarChart3,
      module: "reports" as const,
      href: "/reportes",
      color: "bg-yellow-500",
      shortDesc: "Reportes"
    }
  ]

  const getAccessBadge = (module: string) => {
    const moduleKey = module as keyof ModulePermissions
    if (!ui.shouldShowInNavigation(moduleKey)) {
      return <Badge variant="destructive" className={cn(isMobile && "text-xs")}>Sin Acceso</Badge>
    }
    
    const permissions = []
    if (ui.canShowCreateButton(moduleKey)) permissions.push("Crear")
    if (ui.canShowEditButton(moduleKey)) permissions.push("Editar")
    if (ui.canShowDeleteButton(moduleKey)) permissions.push("Eliminar")
    if (ui.canShowAuthorizeButton(moduleKey)) permissions.push("Autorizar")
   
   if (permissions.length === 0) {
     return <Badge variant="outline" className={cn(isMobile && "text-xs")}>Solo Lectura</Badge>
   }
   
   return <Badge variant="secondary" className={cn(isMobile && "text-xs")}>
     {isMobile ? `${permissions.length} permisos` : permissions.join(", ")}
   </Badge>
  }

  // Pull to refresh handler
  const handlePullToRefresh = async () => {
    await handleRefreshProfile()
    // Add a small delay to show the refresh animation
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return (
    <PullToRefresh onRefresh={handlePullToRefresh} disabled={isRefreshing}>
      <div className={cn(
        "space-y-6",
        isMobile ? "p-4" : "p-6"
      )}>
        {/* Success indicator for Zustand implementation */}
      <div className={cn(
        "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg",
        isMobile ? "p-3" : "p-3"
      )}>
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle className={cn(isMobile ? "h-4 w-4" : "h-4 w-4")} />
          <span className={cn(
            "font-medium",
            isMobile ? "text-sm" : "text-sm"
          )}>
            🎉 Dashboard migrado a Zustand - Funcionando correctamente
          </span>
          <Badge variant="secondary" className="ml-2">
            Pure Zustand
          </Badge>
        </div>
      </div>

      {/* Access Denied Alert */}
      {showAccessAlert && (
        <Alert variant="destructive" className={cn(isMobile && "mx-0")}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={cn(isMobile && "text-sm")}>
            <strong>Acceso denegado:</strong> Tu rol {profile.role} no tiene permisos para acceder al módulo "{searchParams.get('module')}".
          </AlertDescription>
        </Alert>
      )}

      {/* User Info Header (Zustand-powered) - Mobile Optimized */}
      <Card className={cn(isMobile && "shadow-sm")}>
        <CardHeader className={cn(isMobile && "pb-3")}>
          <div className={cn(
            "flex items-center justify-between",
            isMobile && "flex-col gap-3 items-start"
          )}>
            <div className={cn(isMobile && "w-full")}>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isMobile ? "text-lg flex-wrap" : "text-xl"
              )}>
                <Shield className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                <span className={cn(isMobile && "break-words")}>
                  Panel de Control - {getRoleDisplayName(profile.role)}
                </span>
                <Badge variant="default" className={cn(
                  "bg-green-600",
                  isMobile && "text-xs"
                )}>
                  Zustand
                </Badge>
              </CardTitle>
              <CardDescription className={cn(isMobile && "text-sm mt-1")}>
                Bienvenido, {profile.nombre} {profile.apellido}
              </CardDescription>
            </div>
            <div className={cn(
              "text-right space-y-1",
              isMobile && "w-full text-center"
            )}>
              <div className={cn(
                "flex items-center gap-2",
                isMobile ? "justify-center flex-col gap-1" : "justify-end"
              )}>
                <div className={cn(
                  "text-muted-foreground",
                  isMobile ? "text-sm text-center" : "text-sm"
                )}>
                  Límite de Autorización
                </div>
                <Button
                  size={isMobile ? "sm" : "sm"}
                  variant="outline"
                  onClick={handleRefreshProfile}
                  disabled={isRefreshing}
                  className={cn(
                    isMobile ? "h-8 px-3 text-xs" : "h-6 px-2"
                  )}
                >
                  {isRefreshing ? (
                    <Loader2 className={cn(isMobile ? "h-3 w-3" : "h-3 w-3", "animate-spin")} />
                  ) : (
                    <>
                      <RefreshCw className={cn(isMobile ? "h-3 w-3" : "h-3 w-3", "mr-1")} />
                      <span className={cn(isMobile && "hidden sm:inline")}>
                        Actualizar Perfil
                      </span>
                    </>
                  )}
                </Button>
              </div>
              <div className={cn(
                "font-bold text-green-600",
                isMobile ? "text-xl" : "text-2xl"
              )}>
                ${authorizationLimit.toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
          )}>
            <div className={cn(isMobile && "text-center")}>
              <div className="text-sm font-medium text-muted-foreground">Empleado</div>
              <div className={cn(isMobile ? "text-base" : "text-lg")}>
                {profile.employee_code || 'No asignado'}
              </div>
            </div>
            <div className={cn(isMobile && "text-center")}>
              <div className="text-sm font-medium text-muted-foreground">Planta</div>
              <div className={cn(isMobile ? "text-base" : "text-lg")}>
                {organizationalContext.plantName || 'Global'}
              </div>
            </div>
            <div className={cn(isMobile && "text-center")}>
              <div className="text-sm font-medium text-muted-foreground">Unidad de Negocio</div>
              <div className={cn(isMobile ? "text-base" : "text-lg")}>
                {organizationalContext.businessUnitName || 'Global'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Role-Specific Features */}
      
      {/* GERENCIA GENERAL - Full Access Dashboard - Mobile Optimized */}
      {profile?.role === 'GERENCIA_GENERAL' && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader className={cn(isMobile && "pb-3")}>
            <CardTitle className={cn(
              "flex items-center gap-2 text-purple-800",
              isMobile ? "text-lg flex-wrap" : "text-xl"
            )}>
              <Shield className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
              <span className={cn(isMobile && "break-words")}>
                Panel de Gerencia General
              </span>
            </CardTitle>
            <CardDescription className={cn(
              "text-purple-700",
              isMobile && "text-sm"
            )}>
              Acceso completo a todos los módulos del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className={cn(
            "space-y-4",
            isMobile && "space-y-3"
          )}>
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1 gap-3" : "grid-cols-1 md:grid-cols-3"
            )}>
              <Card className="bg-white">
                <CardContent className={cn(
                  isMobile ? "p-4" : "pt-6"
                )}>
                  <div className={cn(
                    "flex items-center gap-2",
                    isMobile && "flex-col text-center"
                  )}>
                    <TrendingUp className={cn(
                      "text-green-500",
                      isMobile ? "h-4 w-4" : "h-5 w-5"
                    )} />
                    <span className={cn(
                      "font-medium",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      Sin Límite de Autorización
                    </span>
                  </div>
                  <p className={cn(
                    "text-muted-foreground mt-2",
                    isMobile ? "text-xs text-center" : "text-sm"
                  )}>
                    Autorización ilimitada para todas las operaciones
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className={cn(
                  isMobile ? "p-4" : "pt-6"
                )}>
                  <div className={cn(
                    "flex items-center gap-2",
                    isMobile && "flex-col text-center"
                  )}>
                    <BarChart3 className={cn(
                      "text-blue-500",
                      isMobile ? "h-4 w-4" : "h-5 w-5"
                    )} />
                    <span className={cn(
                      "font-medium",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      Reportes Ejecutivos
                    </span>
                  </div>
                  <p className={cn(
                    "text-muted-foreground mt-2",
                    isMobile ? "text-xs text-center" : "text-sm"
                  )}>
                    Acceso a todos los reportes y análisis
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-white">
                <CardContent className={cn(
                  isMobile ? "p-4" : "pt-6"
                )}>
                  <div className={cn(
                    "flex items-center gap-2",
                    isMobile && "flex-col text-center"
                  )}>
                    <Users className={cn(
                      "text-purple-500",
                      isMobile ? "h-4 w-4" : "h-5 w-5"
                    )} />
                    <span className={cn(
                      "font-medium",
                      isMobile ? "text-sm" : "text-base"
                    )}>
                      Gestión Global
                    </span>
                  </div>
                  <p className={cn(
                    "text-muted-foreground mt-2",
                    isMobile ? "text-xs text-center" : "text-sm"
                  )}>
                    Control total de todas las unidades
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className={cn(
              "flex gap-2",
              isMobile ? "flex-col gap-3" : "flex-wrap"
            )}>
              <Button 
                asChild 
                size={isMobile ? "default" : "sm"}
                className={cn(
                  "bg-purple-600 hover:bg-purple-700",
                  isMobile && "w-full min-h-[44px]"
                )}
              >
                <Link href="/reportes?type=executive">
                  <BarChart3 className={cn(
                    isMobile ? "h-4 w-4 mr-2" : "mr-1"
                  )} />
                  Dashboard Ejecutivo
                  {isMobile && (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </Link>
              </Button>
              <Button 
                asChild 
                size={isMobile ? "default" : "sm"}
                variant="outline"
                className={cn(
                  isMobile && "w-full min-h-[44px]"
                )}
              >
                <Link href="/compras?status=high_value">
                  <ShoppingCart className={cn(
                    isMobile ? "h-4 w-4 mr-2" : "mr-1"
                  )} />
                  Compras Alto Valor
                  {isMobile && (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
                </Link>
              </Button>
              <Button 
                asChild 
                size={isMobile ? "default" : "sm"}
                variant="outline"
                className={cn(
                  isMobile && "w-full min-h-[44px]"
                )}
              >
                <Link href="/gestion">
                  <Shield className={cn(
                    isMobile ? "h-4 w-4 mr-2" : "mr-1"
                  )} />
                  Configuración Sistema
                  {isMobile && (
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  )}
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
                    Gestión de operadores
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
                <Link href="/compras?plant={organizationalContext.plantId}&requires_approval=true">
                  Aprobar Compras
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/personal?plant={organizationalContext.plantId}">
                  Personal
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AREA_ADMINISTRATIVA - Administrative Features */}
      {profile?.role === 'AREA_ADMINISTRATIVA' && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Users className="h-5 w-5" />
              Panel Área Administrativa
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

      {/* Modules Grid - Mobile Optimized */}
      <div>
        <h2 className={cn(
          "font-bold mb-4",
          isMobile ? "text-xl" : "text-2xl"
        )}>
          Módulos del Sistema
        </h2>
        <div className={cn(
          "grid gap-4",
          isMobile 
            ? "grid-cols-2 gap-3" // 2 columns on mobile for better accessibility
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        )}>
          {moduleCards.map((card) => {
            const hasAccess = ui.shouldShowInNavigation(card.module)
            const Icon = card.icon

            return (
              <Card 
                key={card.module} 
                className={cn(
                  "relative overflow-hidden transition-all",
                  hasAccess ? 'cursor-pointer hover:shadow-md' : 'opacity-50',
                  isMobile 
                    ? "min-h-[140px] active:scale-95 transition-transform" // Better mobile feedback
                    : "hover:scale-[1.02]",
                  !hasAccess && "pointer-events-none"
                )}
                onClick={() => hasAccess && router.push(card.href)}
              >
                <CardHeader className={cn(
                  isMobile ? "pb-2 px-3 pt-3" : "pb-3"
                )}>
                  <div className={cn(
                    "flex items-center justify-between",
                    isMobile && "flex-col gap-2 items-start"
                  )}>
                    <div className={cn(
                      `p-2 rounded-md ${card.color} text-white`,
                      isMobile && "self-center"
                    )}>
                      <Icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
                    </div>
                    {!isMobile && getAccessBadge(card.module)}
                  </div>
                  <CardTitle className={cn(
                    isMobile ? "text-sm text-center leading-tight" : "text-lg"
                  )}>
                    {isMobile ? card.title : card.title}
                  </CardTitle>
                  {!isMobile && (
                    <CardDescription className="text-sm">
                      {card.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                {hasAccess && (
                  <CardContent className={cn(
                    "pt-0",
                    isMobile ? "px-3 pb-3" : ""
                  )}>
                    {isMobile ? (
                      // Mobile: Show access badge at bottom
                      <div className="flex justify-center">
                        {getAccessBadge(card.module)}
                      </div>
                    ) : (
                      // Desktop: Show permission badges
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
                    )}
                  </CardContent>
                )}

                {!hasAccess && (
                  <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                    <div className="bg-white rounded-full p-2">
                      <Shield className={cn(isMobile ? "h-4 w-4" : "h-6 w-6", "text-red-500")} />
                    </div>
                  </div>
                )}

                {/* Mobile: Arrow indicator for navigation */}
                {isMobile && hasAccess && (
                  <div className="absolute top-3 right-3">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* Quick Actions for AREA_ADMINISTRATIVA - Mobile Optimized */}
      <RoleGuard module="purchases" requireAuth>
        <Card>
          <CardHeader className={cn(isMobile && "pb-3")}>
            <CardTitle className={cn(
              "flex items-center gap-2",
              isMobile ? "text-lg" : "text-xl"
            )}>
              <Calendar className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
              <span className={cn(isMobile && "text-base")}>
                Acciones Rápidas - Área Administrativa
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "grid gap-4",
              isMobile ? "grid-cols-1 gap-3" : "grid-cols-1 md:grid-cols-3"
            )}>
              <Button 
                asChild 
                variant="outline" 
                className={cn(
                  "h-auto flex flex-col",
                  isMobile 
                    ? "p-4 min-h-[80px] active:scale-95 transition-transform"
                    : "p-4"
                )}
              >
                <Link href="/compras?status=pending">
                  <ShoppingCart className={cn(
                    "mb-2",
                    isMobile ? "h-5 w-5" : "h-6 w-6"
                  )} />
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    Revisar Compras
                  </span>
                  <span className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-xs" : "text-xs"
                  )}>
                    Pendientes de aprobación
                  </span>
                  {isMobile && (
                    <ChevronRight className="h-3 w-3 mt-1 text-muted-foreground" />
                  )}
                </Link>
              </Button>

              
              <Button 
                asChild 
                variant="outline" 
                className={cn(
                  "h-auto flex flex-col",
                  isMobile 
                    ? "p-4 min-h-[80px] active:scale-95 transition-transform"
                    : "p-4"
                )}
              >
                <Link href="/gestion/personal?action=new">
                  <Users className={cn(
                    "mb-2",
                    isMobile ? "h-5 w-5" : "h-6 w-6"
                  )} />
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    Nuevo Personal
                  </span>
                  <span className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-xs" : "text-xs"
                  )}>
                    Registrar empleado
                  </span>
                  {isMobile && (
                    <ChevronRight className="h-3 w-3 mt-1 text-muted-foreground" />
                  )}
                </Link>
              </Button>
              
              <Button 
                asChild 
                variant="outline" 
                className={cn(
                  "h-auto flex flex-col",
                  isMobile 
                    ? "p-4 min-h-[80px] active:scale-95 transition-transform"
                    : "p-4"
                )}
              >
                <Link href="/reportes?type=financial">
                  <BarChart3 className={cn(
                    "mb-2",
                    isMobile ? "h-5 w-5" : "h-6 w-6"
                  )} />
                  <span className={cn(
                    "font-medium",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    Reportes Financieros
                  </span>
                  <span className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-xs" : "text-xs"
                  )}>
                    Análisis de gastos
                  </span>
                  {isMobile && (
                    <ChevronRight className="h-3 w-3 mt-1 text-muted-foreground" />
                  )}
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
    </PullToRefresh>
  )
}

function DashboardFallback() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
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
