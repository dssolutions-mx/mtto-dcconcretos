'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Calendar,
  MapPin,
  Users,
  Truck,
  Play,
  History,
  ClipboardCheck,
  Eye,
  Plus,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { OfflineStatus } from '@/components/checklists/offline-status'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { WifiOff } from 'lucide-react'
import { offlineChecklistService } from '@/lib/services/offline-checklist-service'

interface Asset {
  id: string
  name: string
  asset_id: string
  location: string | null
  department: string | null
  status: string
  current_hours: number | null
}

interface ChecklistSchedule {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  checklists: {
    id: string
    name: string
    frequency: string
    description: string | null
  } | null
  profiles: {
    nombre: string | null
    apellido: string | null
  } | null
}

interface CompletedItem {
  id: string
  item_id: string
  status: 'pass' | 'flag' | 'fail'
  notes?: string
  photo_url?: string
}

interface CompletedChecklist {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  updated_at: string
  completion_date?: string
  technician?: string
  completed_items?: CompletedItem[]
  checklists: {
    id: string
    name: string
    frequency: string
  } | null
  profiles: {
    nombre: string | null
    apellido: string | null
  } | null
}

export default function AssetChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const assetId = resolvedParams.id
  const router = useRouter()
  
  const [asset, setAsset] = useState<Asset | null>(null)
  const [pendingSchedules, setPendingSchedules] = useState<ChecklistSchedule[]>([])
  const [completedChecklists, setCompletedChecklists] = useState<CompletedChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Offline functionality
  const { isOnline, sync } = useOfflineSync()

  useEffect(() => {
    fetchAssetData()
  }, [assetId])

  const handleSyncComplete = () => {
    // Refrescar datos después de sincronizar
    fetchAssetData()
  }

  const fetchAssetData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Try to get all asset data using optimized consolidated API
      try {
        const response = await fetch(`/api/assets/${assetId}/dashboard`)
        if (response.ok) {
          const result = await response.json()
          const { asset, pending_schedules, completed_checklists } = result.data
          
          // Set data immediately for fast UI update
          setAsset(asset)
          setPendingSchedules(pending_schedules.all || [])
          setCompletedChecklists(completed_checklists || [])
          
          // Cache asset data for offline use (non-blocking)
          try {
            await offlineChecklistService.cacheAssetData(assetId, asset)
          } catch (cacheError) {
            console.warn('📦 Asset caching failed (non-fatal):', cacheError)
          }
          
        } else if (!navigator.onLine) {
          throw new Error('Offline mode')
        } else {
          throw new Error(`API error: ${response.status}`)
        }
        
      } catch (fetchError) {
        if (!navigator.onLine) {
          console.log('📱 Switching to offline mode for asset detail')
          
          // Try to get cached asset data
          try {
            const cachedAsset = await offlineChecklistService.getCachedAssetData(assetId)
            if (cachedAsset) {
              setAsset(cachedAsset)
              
              // Try to get cached schedules
              const cachedSchedules = await offlineChecklistService.getCachedChecklistSchedules('pendiente')
              const assetSchedules = (cachedSchedules || []).filter((s: any) => s.asset_id === assetId)
              setPendingSchedules(assetSchedules)
              
              // Simple offline mode - limited functionality
              setCompletedChecklists([])
              
              toast.success('Modo offline activado - funcionalidad limitada')
            } else {
              throw new Error('No hay datos en caché para este activo')
            }
          } catch (cacheError) {
            throw new Error('No se pudieron cargar los datos offline')
          }
          
        } else {
          throw fetchError
        }
      }

    } catch (error: any) {
      console.error('Error fetching asset checklist data:', error)
      setError(error.message)
      toast.error('Error al cargar los datos del activo')
    } finally {
      setLoading(false)
    }
  }

  const categorizeSchedules = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const weekFromNow = new Date(today)
    weekFromNow.setDate(weekFromNow.getDate() + 7)

    return {
      overdue: pendingSchedules.filter(schedule => 
        new Date(schedule.scheduled_date) < today
      ).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()),
      
      today: pendingSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.scheduled_date)
        scheduleDate.setHours(0, 0, 0, 0)
        return scheduleDate.getTime() === today.getTime()
      }),
      
      upcoming: pendingSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.scheduled_date)
        return scheduleDate > today && scheduleDate <= weekFromNow
      }).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()),
      
      future: pendingSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.scheduled_date)
        return scheduleDate > weekFromNow
      }).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Mañana'
    if (diffDays === -1) return 'Ayer'
    if (diffDays < 0) return `Hace ${Math.abs(diffDays)} días`
    if (diffDays <= 7) return `En ${diffDays} días`
    return formatDate(dateString)
  }

  const getStatusBadge = (status: string, scheduleDate: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = new Date(scheduleDate)
    date.setHours(0, 0, 0, 0)
    
    if (date < today) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Atrasado
        </Badge>
      )
    } else if (date.getTime() === today.getTime()) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Hoy
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Programado
        </Badge>
      )
    }
  }

  const getCompletedChecklistSummary = (checklist: CompletedChecklist) => {
    if (!checklist.completed_items) {
      return { total: 0, passed: 0, flagged: 0, failed: 0 }
    }
    
    const items = checklist.completed_items
    return {
      total: items.length,
      passed: items.filter(item => item.status === 'pass').length,
      flagged: items.filter(item => item.status === 'flag').length,
      failed: items.filter(item => item.status === 'fail').length
    }
  }

  const getCompletedChecklistBadge = (checklist: CompletedChecklist) => {
    const summary = getCompletedChecklistSummary(checklist)
    
    // Si no hay datos de items, mostrar solo completado
    if (summary.total === 0) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Completado
        </Badge>
      )
    }
    
    if (summary.failed > 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          {summary.failed} Fallidos
        </Badge>
      )
    } else if (summary.flagged > 0) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {summary.flagged} Con Atención
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Todo Correcto
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Cargando activo..."
          text="Obteniendo información de checklists"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardShell>
    )
  }

  if (error || !asset) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error"
          text="No se pudo cargar la información del activo"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Activo no encontrado"}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  const { overdue, today, upcoming, future } = categorizeSchedules()
  const totalPending = pendingSchedules.length
  const recentCompleted = completedChecklists.slice(0, 5)

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Checklists - ${asset.name}`}
        text={`Gestión de checklists para ${asset.asset_id} • ${asset.location || 'Sin ubicación'} • ${asset.department || 'Sin departamento'}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <Button asChild>
            <Link href={`/checklists/programar?asset=${assetId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Programar Checklist
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {/* Offline Notice */}
      {isOnline === false && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <WifiOff className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">Modo Offline Activo</p>
                <p className="text-sm text-orange-700">
                  Algunos checklists pueden no estar disponibles para ejecución sin conexión.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Information Card */}
      <Card className="border-2 border-blue-200 bg-blue-50/50 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            Información del Activo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{totalPending}</div>
              <div className="text-sm text-muted-foreground">Checklists Pendientes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{overdue.length}</div>
              <div className="text-sm text-muted-foreground">Atrasados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{today.length}</div>
              <div className="text-sm text-muted-foreground">Para Hoy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{recentCompleted.length}</div>
              <div className="text-sm text-muted-foreground">Completados Recientes</div>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">ID:</span>
              <span>{asset.asset_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Ubicación:</span>
              <span>{asset.location || 'Sin ubicación'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Departamento:</span>
              <span>{asset.department || 'Sin departamento'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {(overdue.length > 0 || today.length > 0) && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {overdue.length > 0 && (
                <p><strong>{overdue.length}</strong> checklist(s) atrasado(s) requieren atención inmediata</p>
              )}
              {today.length > 0 && (
                <p><strong>{today.length}</strong> checklist(s) programado(s) para hoy</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* OVERDUE CHECKLISTS */}
        {overdue.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Checklists Atrasados ({overdue.length})
              </CardTitle>
              <CardDescription>Requieren atención inmediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdue.map((schedule) => (
                  <div key={schedule.id} className="border-l-4 border-red-500 pl-4 py-3 bg-white rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-800">
                          {schedule.checklists?.name || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-red-600 font-medium">
                          {formatRelativeDate(schedule.scheduled_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.checklists?.frequency} • {formatDate(schedule.scheduled_date)}
                        </p>
                      </div>
                      {getStatusBadge(schedule.status, schedule.scheduled_date)}
                    </div>
                    
                    {schedule.profiles && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Asignado a: {schedule.profiles.nombre} {schedule.profiles.apellido}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-red-600 hover:bg-red-700" asChild>
                        <Link href={`/checklists/ejecutar/${schedule.id}`}>
                          <Play className="h-3 w-3 mr-1" />
                          Ejecutar Ahora
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/checklists/${schedule.template_id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Plantilla
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* TODAY'S CHECKLISTS */}
        {today.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="text-yellow-800 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Para Hoy ({today.length})
              </CardTitle>
              <CardDescription>Checklists programados para hoy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {today.map((schedule) => (
                  <div key={schedule.id} className="border-l-4 border-yellow-500 pl-4 py-3 bg-white rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-800">
                          {schedule.checklists?.name || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-yellow-600 font-medium">Programado para hoy</p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.checklists?.frequency}
                        </p>
                      </div>
                      {getStatusBadge(schedule.status, schedule.scheduled_date)}
                    </div>
                    
                    {schedule.profiles && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Asignado a: {schedule.profiles.nombre} {schedule.profiles.apellido}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" asChild>
                        <Link href={`/checklists/ejecutar/${schedule.id}`}>
                          <Play className="h-3 w-3 mr-1" />
                          Ejecutar
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/checklists/${schedule.template_id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Plantilla
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* UPCOMING CHECKLISTS */}
        {upcoming.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Próximos 7 Días ({upcoming.length})
              </CardTitle>
              <CardDescription>Checklists programados para la próxima semana</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((schedule) => (
                  <div key={schedule.id} className="border-l-4 border-blue-500 pl-4 py-3 bg-white rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-800">
                          {schedule.checklists?.name || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-blue-600 font-medium">
                          {formatRelativeDate(schedule.scheduled_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {schedule.checklists?.frequency} • {formatDate(schedule.scheduled_date)}
                        </p>
                      </div>
                      {getStatusBadge(schedule.status, schedule.scheduled_date)}
                    </div>
                    
                    {schedule.profiles && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Asignado a: {schedule.profiles.nombre} {schedule.profiles.apellido}
                      </p>
                    )}
                    
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
                        <Link href={`/checklists/ejecutar/${schedule.id}`}>
                          <Play className="h-3 w-3 mr-1" />
                          Ejecutar
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/checklists/${schedule.template_id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Plantilla
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {upcoming.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Y {upcoming.length - 5} más...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* COMPLETED CHECKLISTS */}
        {recentCompleted.length > 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Completados Recientes ({recentCompleted.length})
              </CardTitle>
              <CardDescription>Últimos checklists ejecutados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCompleted.map((checklist) => (
                  <div key={checklist.id} className="border-l-4 border-green-500 pl-4 py-3 bg-white rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-green-800">
                          {checklist.checklists?.name || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-green-600 font-medium">
                          Completado {formatRelativeDate(checklist.completion_date || checklist.updated_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Por: {checklist.technician || (checklist.profiles ? `${checklist.profiles.nombre} ${checklist.profiles.apellido}` : 'Usuario desconocido')}
                        </p>
                        {(() => {
                          const summary = getCompletedChecklistSummary(checklist)
                          if (summary.total > 0) {
                            return (
                              <div className="flex gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {summary.total} items: {summary.passed} ✓ 
                                  {summary.flagged > 0 && `, ${summary.flagged} ⚠️`}
                                  {summary.failed > 0 && `, ${summary.failed} ❌`}
                                </p>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                      {getCompletedChecklistBadge(checklist)}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/checklists/completado/${checklist.id}`}>
                          <Eye className="h-3 w-3 mr-1" />
                          Ver Detalles
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {completedChecklists.length > 5 && (
                  <div className="text-center pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/activos/${assetId}/historial-checklists`}>
                        <History className="h-3 w-3 mr-1" />
                        Ver Historial Completo ({completedChecklists.length})
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FUTURE CHECKLISTS */}
        {future.length > 0 && (
          <Card className="border-gray-200 bg-gray-50/50">
            <CardHeader>
              <CardTitle className="text-gray-800 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Futuro ({future.length})
              </CardTitle>
              <CardDescription>Checklists programados para más adelante</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {future.slice(0, 3).map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-2 bg-white rounded">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{schedule.checklists?.name || 'Sin nombre'}</h5>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(schedule.scheduled_date)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {schedule.checklists?.frequency}
                    </Badge>
                  </div>
                ))}
                {future.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Y {future.length - 3} más programados...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* No Checklists Message */}
      {totalPending === 0 && recentCompleted.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No hay checklists para este activo
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Este activo no tiene checklists programados ni historial de ejecución.
            </p>
            <Button asChild>
              <Link href={`/checklists/programar?asset=${assetId}`}>
                <Plus className="mr-2 h-4 w-4" />
                Programar Primer Checklist
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Offline Status */}
      <div className="mt-6">
        <OfflineStatus showDetails={true} onSyncComplete={handleSyncComplete} />
      </div>
    </DashboardShell>
  )
} 