"use client"

import type { Metadata } from "next"
import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, FileDown, ClipboardCheck, Loader2, Check, WifiOff, ChevronDown, Truck, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { DailyChecklistList } from "@/components/checklists/daily-checklist-list"
import { WeeklyChecklistList } from "@/components/checklists/weekly-checklist-list"
import { MonthlyChecklistList } from "@/components/checklists/monthly-checklist-list"
import { PreventiveChecklistList } from "@/components/checklists/preventive-checklist-list"
import { ModelTemplatesNavigator } from "@/components/checklists/model-templates-navigator"
import { OfflineStatus } from "@/components/checklists/offline-status"
import { OfflineChecklistList } from "@/components/checklists/offline-checklist-list"
import { useChecklistSchedules, useChecklistTemplates } from "@/hooks/useChecklists"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { RoleGuard, OperatorGuard, MaintenanceTeamGuard } from "@/components/auth/role-guard"
import { CacheCleanupButton } from "@/components/checklists/cache-cleanup-button"

// Importación dinámica del servicio offline
let offlineChecklistService: any = null

// Component for unresolved issues card with offline support
function UnresolvedIssuesCard() {
  const [unresolvedCount, setUnresolvedCount] = useState(0)
  
  useEffect(() => {
    const loadUnresolvedCount = async () => {
      try {
        if (offlineChecklistService) {
          const issues = await offlineChecklistService.getUnresolvedIssues()
          setUnresolvedCount(issues.length)
        } else {
          // Fallback to localStorage
          const stored = localStorage?.getItem('all-unresolved-issues')
          setUnresolvedCount(stored ? JSON.parse(stored).length : 0)
        }
      } catch {
        setUnresolvedCount(0)
      }
    }
    
    loadUnresolvedCount()
    
    // Listen for unresolved issues updates
    if (offlineChecklistService) {
      const handleStatsUpdate = () => loadUnresolvedCount()
      offlineChecklistService.on('stats-update', handleStatsUpdate)
      
      return () => {
        offlineChecklistService.off('stats-update', handleStatsUpdate)
      }
    }
  }, [])
  
  return (
    <Link href="/checklists/problemas-pendientes" className="block">
      <Card className="hover:bg-muted/50 transition-colors border-orange-200 bg-orange-50/30">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-orange-800">Problemas Pendientes</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-700">
            {unresolvedCount}
          </div>
          <p className="text-xs text-orange-600">
            Requieren órdenes de trabajo
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}

// Create a client component that uses useSearchParams
function ChecklistsContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const { profile, ui } = useAuthZustand()
  const { schedules, loading, error, fetchSchedules } = useChecklistSchedules()
  const { templates, fetchTemplates } = useChecklistTemplates()
  const [activeTab, setActiveTab] = useState('overview')
  const [preparingOffline, setPreparingOffline] = useState(false)
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined)
  const [showAllOverdue, setShowAllOverdue] = useState(false)
  const [stats, setStats] = useState({
    daily: { total: 0, pending: 0, overdue: 0 },
    weekly: { total: 0, pending: 0, overdue: 0 },
    monthly: { total: 0, pending: 0, overdue: 0 },
    templates: 0,
    preventive: { total: 0, pending: 0, overdue: 0 }
  })
  
  // Determinar si el usuario es un operador/dosificador
  const isOperator = profile?.role && ['OPERADOR', 'DOSIFICADOR'].includes(profile.role)
  const canCreateChecklists = ui?.canShowCreateButton('checklists') || false
  const canScheduleChecklists = ui?.canShowEditButton('checklists') || false

  // For operators, use the operator-specific API
  const [operatorChecklists, setOperatorChecklists] = useState<any[]>([])
  const [operatorLoading, setOperatorLoading] = useState(false)

  // Fetch operator-specific checklists
  useEffect(() => {
    if (isOperator) {
      const fetchOperatorChecklists = async () => {
        setOperatorLoading(true)
        try {
          const response = await fetch('/api/checklists/operator-assigned?status=pendiente')
          if (response.ok) {
            const result = await response.json()
            setOperatorChecklists(result.data || [])
          }
        } catch (error) {
          console.error('Error fetching operator checklists:', error)
        } finally {
          setOperatorLoading(false)
        }
      }
      fetchOperatorChecklists()
    }
  }, [isOperator])
  
  // Inicializar servicio offline
  useEffect(() => {
    if (typeof window !== 'undefined' && !offlineChecklistService) {
      import('@/lib/services/offline-checklist-service').then(module => {
        offlineChecklistService = module.offlineChecklistService
      })
    }
  }, [])

  // Detectar estado de conexión
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Set active tab from URL parameter if present
  useEffect(() => {
    if (tabParam && ['overview', 'daily', 'weekly', 'monthly', 'templates', 'preventive'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Fetch schedules on mount
  useEffect(() => {
    fetchSchedules('pendiente')
    fetchTemplates()
  }, [fetchSchedules, fetchTemplates])

  // Cache automático cuando se cargan los schedules
  useEffect(() => {
    if (schedules.length > 0 && offlineChecklistService && isOnline) {
      // Cache automático de schedules
      offlineChecklistService.cacheChecklistSchedules(schedules, 'pendiente')
      if (process.env.NODE_ENV === 'development') {
        console.log(`📋 Auto-cache: ${schedules.length} schedules guardados para uso offline`)
      }
    }
  }, [schedules, isOnline])

  // Cache automático cuando se cargan los templates
  useEffect(() => {
    if (templates.length > 0 && offlineChecklistService && isOnline) {
      // Cache automático de templates
      offlineChecklistService.cacheChecklistTemplates(templates)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Auto-cache: ${templates.length} templates guardados para uso offline`)
      }
    }
  }, [templates, isOnline])
  
  // Update stats when schedules and templates change
  useEffect(() => {
    if (schedules.length > 0 || templates.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      // Process the schedule data to get counts
      const dailyItems = schedules.filter(s => s.checklists?.frequency === 'diario')
      const weeklyItems = schedules.filter(s => s.checklists?.frequency === 'semanal')
      const monthlyItems = schedules.filter(s => s.checklists?.frequency === 'mensual')
      
      // Checklists de mantenimiento preventivo (con maintenance_plan_id)
      const preventiveItems = schedules.filter(s => s.maintenance_plan_id)
      
      // Checklists para HOY
      const todaysDaily = dailyItems.filter(s => {
        const date = new Date(s.scheduled_date)
        date.setHours(0, 0, 0, 0)
        return date >= today && date < tomorrow
      }).length
      
      const todaysWeekly = weeklyItems.filter(s => {
        const date = new Date(s.scheduled_date)
        date.setHours(0, 0, 0, 0)
        return date >= today && date < tomorrow
      }).length
      
      const todaysMonthly = monthlyItems.filter(s => {
        const date = new Date(s.scheduled_date)
        date.setHours(0, 0, 0, 0)
        return date >= today && date < tomorrow
      }).length
      
      // Calculate overdue items (scheduled_date is in the past)
      const overdueDaily = dailyItems.filter(s => new Date(s.scheduled_date) < today).length
      const overdueWeekly = weeklyItems.filter(s => new Date(s.scheduled_date) < today).length
      const overdueMonthly = monthlyItems.filter(s => new Date(s.scheduled_date) < today).length
      const overduePreventive = preventiveItems.filter(s => new Date(s.scheduled_date) < today).length
      
      const pendingPreventive = preventiveItems.filter(s => s.status === 'pendiente').length
      
      setStats({
        daily: { 
          total: todaysDaily, 
          pending: todaysDaily,
          overdue: overdueDaily
        },
        weekly: { 
          total: todaysWeekly, 
          pending: todaysWeekly, 
          overdue: overdueWeekly 
        },
        monthly: { 
          total: todaysMonthly, 
          pending: todaysMonthly, 
          overdue: overdueMonthly 
        },
        templates: templates.length,
        preventive: {
          total: preventiveItems.length,
          pending: pendingPreventive,
          overdue: overduePreventive
        }
      })
    }
  }, [schedules, templates])

  // Preparación masiva para uso offline
  const handlePrepareOffline = async () => {
    if (!offlineChecklistService) {
      toast.error("Servicio offline no disponible")
      return
    }

    setPreparingOffline(true)
    try {
      const cached = await offlineChecklistService.massiveCachePreparation()
      toast.success(`✅ Preparado para uso offline: ${cached} checklists descargados`)
    } catch (error: any) {
      console.error('Error preparing offline:', error)
      toast.error(`Error al preparar modo offline: ${error.message}`)
    } finally {
      setPreparingOffline(false)
    }
  }

  // Callback para actualizar datos después de sincronización
  const handleSyncComplete = () => {
    fetchSchedules('pendiente')
    fetchTemplates()
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={isOperator ? "Mis Checklists" : "Checklists de Mantenimiento"}
        text={isOperator ? "Ejecuta los checklists asignados a tus activos." : "Gestiona los checklists para diferentes frecuencias de mantenimiento."}
      >
        {isOperator && (
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Operador
            </Badge>
            <span className="text-sm text-muted-foreground">
              Solo puedes ver checklists de tus activos asignados
            </span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Estado offline compacto en header para móviles */}
          <div className="sm:hidden">
            <OfflineStatus showDetails={false} onSyncComplete={handleSyncComplete} />
          </div>
          
          <div className="flex gap-2">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/checklists/assets">
                <Truck className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Vista por Activos</span>
              </Link>
            </Button>
            
            {/* Opciones solo para roles con permisos de edición */}
            {canScheduleChecklists && (
              <Button variant="outline" asChild>
                <Link href="/checklists/programar">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Programar</span>
                </Link>
              </Button>
            )}
            
            {/* Opciones solo para roles con permisos de creación */}
            {canCreateChecklists && (
              <Button asChild>
                <Link href="/checklists/crear">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Nueva Plantilla</span>
                </Link>
              </Button>
            )}
            
            {/* Preparar offline - disponible para todos */}
            <Button 
              variant="outline" 
              onClick={handlePrepareOffline}
              disabled={preparingOffline || isOnline === false}
              className="hidden lg:flex"
            >
              {preparingOffline ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {preparingOffline ? 'Preparando...' : 'Preparar Offline'}
            </Button>
          </div>
        </div>
      </DashboardHeader>

      {/* Estado offline detallado para desktop */}
      <div className="hidden sm:block mb-6">
        <OfflineStatus onSyncComplete={handleSyncComplete} />
      </div>

      {/* Indicador de preparación offline */}
      {isOnline === false && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">Modo Offline Activo</p>
                <p className="text-sm text-orange-700">
                  Solo puedes acceder a checklists que hayas visitado previamente mientras tenías conexión.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="overview" className="text-xs sm:text-sm px-2">
            {isOnline === false ? 'Offline' : 'General'}
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-xs sm:text-sm px-2" disabled={isOnline === false}>
            Diarios
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs sm:text-sm px-2" disabled={isOnline === false}>
            Semanales
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs sm:text-sm px-2 hidden sm:flex" disabled={isOnline === false}>
            Mensuales
          </TabsTrigger>
          <TabsTrigger value="preventive" className="text-xs sm:text-sm px-2 hidden sm:flex" disabled={isOnline === false}>
            Preventivo
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs sm:text-sm px-2 hidden sm:flex" disabled={isOnline === false}>
            Plantillas
          </TabsTrigger>
        </TabsList>

        {/* Mobile-only secondary tabs for hidden tabs */}
        <div className="sm:hidden">
          {(activeTab === 'monthly' || activeTab === 'preventive' || activeTab === 'templates') && (
            <div className="flex gap-2 pb-4">
              <Button 
                variant={activeTab === 'monthly' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTab('monthly')}
                disabled={isOnline === false}
              >
                Mensuales
              </Button>
              <Button 
                variant={activeTab === 'preventive' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTab('preventive')}
                disabled={isOnline === false}
              >
                Preventivo
              </Button>
              <Button 
                variant={activeTab === 'templates' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => setActiveTab('templates')}
                disabled={isOnline === false}
              >
                Plantillas
              </Button>
            </div>
          )}
          
          {/* Show "More" option when on general tabs */}
          {['overview', 'daily', 'weekly'].includes(activeTab) && (
            <div className="flex justify-center pb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Más opciones
                    <ChevronDown className="ml-2 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setActiveTab('monthly')} disabled={isOnline === false}>
                    Mensuales
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('preventive')} disabled={isOnline === false}>
                    Preventivo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('templates')} disabled={isOnline === false}>
                    Plantillas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <TabsContent value="overview">
          {isOnline === false ? (
            <OfflineChecklistList />
          ) : loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando datos...</span>
            </div>
          ) : (
            <>
              {/* Nueva vista por activos */}
              <Card className="mb-6 border-2 border-blue-200 bg-blue-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Truck className="h-6 w-6 text-blue-600" />
                    🚀 Nueva Vista por Activos
                  </CardTitle>
                  <CardDescription>
                    Accede a los checklists organizados por activo para una gestión más clara y eficiente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center">
                    <div className="flex-1">
                      <div className="space-y-2">
                        <p className="text-sm">✅ <strong>Encuentra fácilmente</strong> qué checklists necesita cada activo</p>
                        <p className="text-sm">🎯 <strong>Identifica rápidamente</strong> activos con checklists atrasados</p>
                        <p className="text-sm">📅 <strong>Ve el estado</strong> de cada activo de un vistazo</p>
                        <p className="text-sm">🔍 <strong>Filtra y busca</strong> por ubicación, departamento o estado</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="lg" asChild className="bg-blue-600 hover:bg-blue-700">
                        <Link href="/checklists/assets">
                          <Truck className="mr-2 h-5 w-5" />
                          Probar Vista por Activos
                        </Link>
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">Más fácil para operadores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen ejecutivo */}
              {(() => {
                const totalToday = stats.daily.total + stats.weekly.total + stats.monthly.total
                const totalOverdue = stats.daily.overdue + stats.weekly.overdue + stats.monthly.overdue
                
                if (totalToday > 0 || totalOverdue > 0) {
                  return (
                    <Card className="mb-6 border-2 border-amber-200 bg-amber-50/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <ClipboardCheck className="h-6 w-6 text-amber-600" />
                          Resumen del Día
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                          {totalToday > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                                <span className="text-lg font-bold text-amber-700">{totalToday}</span>
                              </div>
                              <div>
                                <p className="font-medium">Checklists para hoy</p>
                                <p className="text-sm text-muted-foreground">
                                  {stats.daily.total > 0 && `${stats.daily.total} diarios`}
                                  {stats.weekly.total > 0 && `${stats.daily.total > 0 ? ', ' : ''}${stats.weekly.total} semanales`}
                                  {stats.monthly.total > 0 && `${(stats.daily.total > 0 || stats.weekly.total > 0) ? ', ' : ''}${stats.monthly.total} mensuales`}
                                </p>
                              </div>
                            </div>
                          )}
                          {totalOverdue > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                <span className="text-lg font-bold text-red-700">{totalOverdue}</span>
                              </div>
                              <div>
                                <p className="font-medium text-red-700">Checklists atrasados</p>
                                <p className="text-sm text-muted-foreground">
                                  Requieren atención inmediata
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                } else {
                  return (
                    <Card className="mb-6 border-2 border-green-200 bg-green-50/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-6 w-6 text-green-700" />
                          </div>
                          <div>
                            <p className="text-lg font-medium text-green-700">¡Todo al día!</p>
                            <p className="text-sm text-muted-foreground">No hay checklists pendientes para hoy</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }
              })(              )}

              {/* Sección de administración para supervisores y gerencia */}
              <MaintenanceTeamGuard fallback={null}>
                <Card className="mb-6 border-2 border-purple-200 bg-purple-50/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      ⚙️ Administración de Cache
                    </CardTitle>
                    <CardDescription>
                      Herramientas para gestionar el almacenamiento local y resolver problemas de sincronización
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CacheCleanupButton />
                  </CardContent>
                </Card>
              </MaintenanceTeamGuard>
              
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <Link href="/checklists/diarios" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Diarios</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.daily.total}</div>
                      <p className="text-xs text-muted-foreground">
                        Para hacer hoy
                        {stats.daily.overdue > 0 && (
                          <span className="text-red-600 font-medium"> • {stats.daily.overdue} atrasados</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists/semanales" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Semanales</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.weekly.total}</div>
                      <p className="text-xs text-muted-foreground">
                        Para hacer hoy
                        {stats.weekly.overdue > 0 && (
                          <span className="text-red-600 font-medium"> • {stats.weekly.overdue} atrasados</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists/mensuales" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Checklists Mensuales</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.monthly.total}</div>
                      <p className="text-xs text-muted-foreground">
                        Para hacer hoy
                        {stats.monthly.overdue > 0 && (
                          <span className="text-red-600 font-medium"> • {stats.monthly.overdue} atrasados</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <UnresolvedIssuesCard />

                <Link href="/checklists?tab=preventive" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Mantenimiento Preventivo</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.preventive.total}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.preventive.pending} pendientes
                        {stats.preventive.overdue > 0 && ` • ${stats.preventive.overdue} atrasados`}
                      </p>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/checklists?tab=templates" className="block">
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Plantillas</CardTitle>
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.templates}</div>
                      <p className="text-xs text-muted-foreground">Para diferentes equipos</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>

              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Checklists para Hoy</CardTitle>
                    <CardDescription>Checklists que deben completarse hoy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error ? (
                      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
                        <p className="font-medium">Error al cargar los checklists</p>
                        <p className="text-sm">{error}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          const tomorrow = new Date(today)
                          tomorrow.setDate(tomorrow.getDate() + 1)
                          
                          const todaysChecklists = schedules.filter(checklist => {
                            const scheduledDate = new Date(checklist.scheduled_date)
                            scheduledDate.setHours(0, 0, 0, 0)
                            return scheduledDate >= today && scheduledDate < tomorrow
                          })
                          
                          if (todaysChecklists.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                                <p className="text-lg font-medium">No hay checklists programados para hoy</p>
                                <p className="text-sm mt-2">¡Todos los checklists del día han sido completados!</p>
                              </div>
                            )
                          }
                          
                          return todaysChecklists.map(checklist => (
                            <Link 
                              key={checklist.id} 
                              href={`/checklists/ejecutar/${checklist.id}`} 
                              className="block"
                            >
                              <Card className="hover:bg-muted/50 transition-colors border-blue-200">
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-lg">
                                          {checklist.checklists?.name || 'Checklist sin nombre'}
                                        </h4>
                                        <Badge variant="outline" className="text-xs">
                                          {checklist.checklists?.frequency || 'N/A'}
                                        </Badge>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-blue-700">
                                          🚛 {checklist.assets?.name || 'Sin activo asignado'}
                                        </p>
                                        {checklist.assets?.asset_id && (
                                          <p className="text-xs text-muted-foreground">
                                            ID: {checklist.assets.asset_id}
                                            {checklist.assets?.location && ` • 📍 ${checklist.assets.location}`}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <Button size="sm" className="ml-4">
                                      Ejecutar
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          ))
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Sección de checklists atrasados */}
                {(() => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  
                  const overdueChecklists = schedules.filter(checklist => {
                    const scheduledDate = new Date(checklist.scheduled_date)
                    return scheduledDate < today
                  })
                  
                  if (overdueChecklists.length > 0) {
                    return (
                      <Card className="mt-4 border-red-200">
                        <CardHeader className="bg-red-50">
                          <CardTitle className="text-red-800">⚠️ Checklists Atrasados</CardTitle>
                          <CardDescription>Estos checklists debieron completarse en días anteriores</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            {(showAllOverdue ? overdueChecklists : overdueChecklists.slice(0, 5)).map(checklist => (
                              <Link 
                                key={checklist.id} 
                                href={`/checklists/ejecutar/${checklist.id}`} 
                                className="block"
                              >
                                <Card className="hover:bg-red-50/50 transition-colors border-red-200">
                                  <CardContent className="p-3">
                                    <div className="flex justify-between items-center">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-sm font-semibold">
                                            {checklist.checklists?.name}
                                          </span>
                                          <Badge variant="destructive" className="text-xs">
                                            Atrasado
                                          </Badge>
                                        </div>
                                        <div className="space-y-1">
                                          <p className="text-sm font-medium text-red-700">
                                            🚛 {checklist.assets?.name || 'Sin activo asignado'}
                                          </p>
                                          {checklist.assets?.asset_id && (
                                            <p className="text-xs text-muted-foreground">
                                              ID: {checklist.assets.asset_id}
                                              {checklist.assets?.location && ` • 📍 ${checklist.assets.location}`}
                                              • Fecha: {new Date(checklist.scheduled_date).toLocaleDateString('es')}
                                            </p>
                                          )}
                                          {!checklist.assets?.asset_id && (
                                            <p className="text-xs text-muted-foreground">
                                              Fecha: {new Date(checklist.scheduled_date).toLocaleDateString('es')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <Button size="sm" variant="destructive">
                                        Ejecutar ahora
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              </Link>
                            ))}
                            {overdueChecklists.length > 5 && (
                              <div className="text-center pt-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setShowAllOverdue(!showAllOverdue)}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  {showAllOverdue 
                                    ? 'Mostrar menos' 
                                    : `Ver todos (${overdueChecklists.length - 5} más)`
                                  }
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  }
                  return null
                })()}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="daily">
          <DailyChecklistList />
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklyChecklistList />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyChecklistList />
        </TabsContent>

        <TabsContent value="preventive">
          <PreventiveChecklistList />
        </TabsContent>

        <TabsContent value="templates">
          <ModelTemplatesNavigator />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  )
}

// Main page component with Suspense boundary
export default function ChecklistsPage() {
  return (
    <Suspense fallback={
      <DashboardShell>
        <DashboardHeader
          heading="Checklists de Mantenimiento"
          text="Cargando..."
        />
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando datos...</span>
        </div>
      </DashboardShell>
    }>
      <ChecklistsContent />
    </Suspense>
  )
}
