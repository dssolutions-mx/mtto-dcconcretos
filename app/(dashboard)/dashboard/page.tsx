"use client"

import { useState, useEffect, Suspense } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { 
  ShoppingCart, 
  FileText, 
  Users, 
  Package, 
  Shield,
  AlertCircle, 
  AlertTriangle,
  CheckCircle,
  Wrench,
  ClipboardList,
  BarChart3,
  Loader2,
  ChevronRight,
  RefreshCw,
  Fuel
} from "lucide-react"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSystemSettings } from "@/hooks/use-system-settings"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getRoleDisplayName, type ModulePermissions } from "@/lib/auth/role-permissions"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { RestartOnboardingButton } from "@/components/onboarding/restart-onboarding-button"
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard"
const UserSanctionsWidget = dynamic(
  () =>
    import("@/components/compliance/user-sanctions-widget").then((m) => ({
      default: m.UserSanctionsWidget,
    })),
  { ssr: false, loading: () => null }
)
import { DashboardExecutiveLayout } from "@/components/dashboard/dashboard-executive-layout"
import { DashboardModuleLinks } from "@/components/dashboard/dashboard-module-links"
import { DashboardExecutiveKPIs } from "@/components/dashboard/dashboard-executive-kpis"
import { DashboardExecutiveHero } from "@/components/dashboard/dashboard-executive-hero"

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
    refreshProfile,
  } = useAuthZustand()
  const { isComplianceSystemEnabled } = useSystemSettings()
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [showAccessAlert, setShowAccessAlert] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showGettingStarted, setShowGettingStarted] = useState(false)

  // Check if getting started should be shown
  useEffect(() => {
    if (typeof window !== 'undefined' && profile) {
      const dismissed = localStorage.getItem('getting_started_dismissed')
      setShowGettingStarted(!dismissed)
    }
  }, [profile])

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

  // Role-specific dashboard redirects (do not wait on isLoading — profile may be ready while
  // a stale isLoading flag would block redirect after a cached-profile init path)
  useEffect(() => {
    if (!isInitialized || !profile?.role) return
    if (['OPERADOR', 'DOSIFICADOR'].includes(profile.role)) {
      router.push('/dashboard/operator')
    } else if (profile.role === 'MECANICO') {
      router.push('/dashboard/mechanic')
    } else if (profile.role === 'JEFE_UNIDAD_NEGOCIO') {
      router.push('/dashboard/jun')
    } else if (profile.role === 'RECURSOS_HUMANOS') {
      router.push('/dashboard/rh')
    } else if (profile.role === 'COORDINADOR_MANTENIMIENTO') {
      router.push('/dashboard/coordinador')
    } else if (profile.role === 'JEFE_PLANTA') {
      router.push('/dashboard/jefe-planta')
    }
  }, [isInitialized, profile?.role, router])

  // While client-side redirect to role dashboards runs, avoid painting the default dashboard (flash).
  const REDIRECT_ROLES = [
    'OPERADOR',
    'DOSIFICADOR',
    'MECANICO',
    'JEFE_UNIDAD_NEGOCIO',
    'RECURSOS_HUMANOS',
    'COORDINADOR_MANTENIMIENTO',
    'JEFE_PLANTA',
  ]

  if (isInitialized && profile?.role && REDIRECT_ROLES.includes(profile.role)) {
    return (
      <div className="flex min-h-[400px] items-center justify-center px-4">
        <div className="max-w-sm space-y-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando tu dashboard...</p>
        </div>
      </div>
    )
  }

  // Block only until auth is initialized; if we already have a profile, render (avoids infinite
  // spinner when isLoading was stuck true, e.g. loadProfile cache hit without clearing isLoading).
  if (!isInitialized || (isLoading && !profile)) {
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
              {!isInitialized
                ? 'Inicializando sistema...'
                : 'Cargando información del usuario...'}
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

  const EXEC_ROLES = ['GERENCIA_GENERAL', 'AREA_ADMINISTRATIVA', 'GERENTE_MANTENIMIENTO']
  const useExecutiveLayout = profile && EXEC_ROLES.includes(profile.role)

  const moduleCards = [
    {
      title: "Diesel",
      description: "Control de inventario y consumos de diesel",
      icon: Fuel,
      module: "inventory" as const, // Uses inventory permissions
      href: "/diesel",
      color: "bg-blue-600",
      shortDesc: "Diesel",
      isHighPriority: true // Mark as high priority for quick access
    },
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

  // Límite de Autorización: show only for limited-authority roles (not GG — GG has unlimited authority)
  const AUTHORIZING_ROLES = ['JEFE_UNIDAD_NEGOCIO', 'AREA_ADMINISTRATIVA', 'JEFE_PLANTA']
  const showAuthLimit = profile && AUTHORIZING_ROLES.includes(profile.role)

  return (
    <PullToRefresh onRefresh={handlePullToRefresh} disabled={isRefreshing}>

      {/*
        ── Executive layout ─────────────────────────────────────────────────────
        DashboardExecutiveLayout sets its own horizontal padding per section.
        SidebarWrapper uses p-0 on <main> for /dashboard* so this is not doubled.
      */}
      {useExecutiveLayout && (
        <>
          {/* Access Denied Alert inside exec — own padding row */}
          {showAccessAlert && (
            <div className="px-4 pb-0 pt-4 sm:px-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Acceso denegado:</strong> Tu rol {profile.role} no tiene permisos para acceder al módulo "{searchParams.get('module')}".
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DashboardExecutiveLayout
          hero={
            <DashboardExecutiveHero
              name={`${profile.nombre} ${profile.apellido}`.trim()}
              role={getRoleDisplayName(profile.role)}
            />
          }
          userName={`${profile.nombre} ${profile.apellido}`.trim()}
          userRole={getRoleDisplayName(profile.role)}
          authLimit={showAuthLimit ? authorizationLimit : undefined}
          shortcuts={
            profile.role === 'GERENCIA_GENERAL'
              ? [
                  { label: 'Reporte Gerencial', href: '/reportes/gerencial', icon: <BarChart3 className="h-4 w-4" /> },
                  { label: 'Compras Alto Valor', href: '/compras?tab=pending', icon: <ShoppingCart className="h-4 w-4" /> },
                  { label: 'Configuración Sistema', href: '/gestion', icon: <Shield className="h-4 w-4" /> },
                ]
              : profile.role === 'AREA_ADMINISTRATIVA'
              ? [
                  { label: 'Compras Pendientes', href: '/compras?tab=pending', icon: <ShoppingCart className="h-4 w-4" /> },
                  { label: 'Gestionar Personal', href: '/gestion/personal', icon: <Users className="h-4 w-4" /> },
                  { label: 'Reportes Administrativos', href: '/reportes?type=admin', icon: <BarChart3 className="h-4 w-4" /> },
                ]
              : [
                  { label: 'Incidentes activos', href: '/incidentes', icon: <AlertTriangle className="h-4 w-4" /> },
                  { label: 'Activos', href: '/activos', icon: <Package className="h-4 w-4" /> },
                  { label: 'Plan preventivo', href: '/preventivo', icon: <Wrench className="h-4 w-4" /> },
                ]
          }
          modules={
            <DashboardModuleLinks
              modules={moduleCards.map((c) => ({
                title: c.title,
                href: c.href,
                icon: c.icon,
                hasAccess: ui.shouldShowInNavigation(c.module),
              }))}
            />
          }
          kpis={<DashboardExecutiveKPIs role={profile.role as import("@/components/dashboard/dashboard-executive-kpis").ExecutiveKpiRole} />}
          actions={
            <div className="flex items-center gap-1.5">
              {/* RestartOnboarding — hidden on mobile to save hero space */}
              <span className="hidden sm:block">
                <RestartOnboardingButton />
              </span>
              {/* Refresh — icon-only on mobile, label on desktop */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshProfile}
                disabled={isRefreshing}
                className="h-8 w-8 p-0 sm:w-auto sm:px-3"
                aria-label="Actualizar perfil"
              >
                {isRefreshing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
                <span className="hidden sm:inline ml-1.5 text-xs">Actualizar</span>
              </Button>
            </div>
          }
          />

          {/* Compliance widget for exec roles */}
          {isComplianceSystemEnabled && (
            <div className="px-4 pb-4 sm:px-6">
              <UserSanctionsWidget maxItems={3} showOnlyActive={true} />
            </div>
          )}
        </>
      )}

      {/* Non-exec: Getting Started, action strips, Panel card, shortcuts, modules */}
      {!useExecutiveLayout && (
        <div className={cn("space-y-8", isMobile ? "px-4 py-6" : "px-6 py-8")}>
          {/* Access Denied Alert */}
          {showAccessAlert && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className={cn(isMobile && "text-sm")}>
                <strong>Acceso denegado:</strong> Tu rol {profile.role} no tiene permisos para acceder al módulo "{searchParams.get('module')}".
              </AlertDescription>
            </Alert>
          )}
      {showGettingStarted && (
        <GettingStartedCard
          userName={profile.nombre}
          userRole={profile.role}
        />
      )}

      {/* User Info Header - Mobile Optimized */}
      <Card className={cn(isMobile && "shadow-sm")} id="dashboard-header">
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
                {showAuthLimit && (
                  <div className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-sm text-center" : "text-sm"
                  )}>
                    Límite de Autorización
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <RestartOnboardingButton />
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
              </div>
              {showAuthLimit && (
                <div className={cn(
                  "font-bold text-green-600",
                  isMobile ? "text-xl" : "text-2xl"
                )}>
                  ${authorizationLimit.toLocaleString()}
                </div>
              )}
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

      {/* Modules Grid - Mobile Optimized */}
      <div>
        <h2 className={cn(
          "font-bold mb-4",
          isMobile ? "text-xl" : "text-2xl"
        )}>
          Módulos del Sistema
        </h2>
        <div 
        data-tour="dashboard"
        className={cn(
          "grid gap-4",
          isMobile 
            ? "grid-cols-2 gap-3" // 2 columns on mobile for better accessibility
            : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
        )}>
          {moduleCards.filter((card) => ui.shouldShowInNavigation(card.module)).map((card) => {
            const hasAccess = true
            const Icon = card.icon

            return (
              <Card
                key={card.href}
                data-tour={card.module === 'checklists' ? 'checklists' : card.module === 'assets' ? 'assets' : undefined}
                className={cn(
                  "relative overflow-hidden transition-all cursor-pointer hover:shadow-md",
                  isMobile
                    ? "min-h-[140px] active:scale-95 transition-transform"
                    : "hover:scale-[1.02]",
                )}
                onClick={() => router.push(card.href)}
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

          {/* Compliance widget for non-exec roles */}
          {isComplianceSystemEnabled && <UserSanctionsWidget maxItems={3} showOnlyActive={true} />}
        </div>
      )}
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
