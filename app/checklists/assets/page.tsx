'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Filter,
  Grid3X3,
  List,
  Truck,
  MapPin,
  Users,
  ClipboardCheck,
  Play
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
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
  pending_checklists: number
  overdue_checklists: number
  last_checklist_date: string | null
  last_checklist_status: 'completed' | 'failed' | null
  next_checklist_date: string | null
  checklist_status: 'ok' | 'due_soon' | 'overdue' | 'no_schedule'
}

interface AssetChecklistSummary {
  asset: Asset
  pending_schedules: any[]
  completed_recent: any[]
}

export default function AssetChecklistDashboard() {
  const [assets, setAssets] = useState<AssetChecklistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [departments, setDepartments] = useState<string[]>([])
  
  // Offline functionality
  const { syncStats, isOnline } = useOfflineSync()
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  useEffect(() => {
    fetchAssetChecklistData()
  }, [])

    const fetchAssetChecklistData = async () => {
    try {
      setLoading(true)
      setIsOfflineMode(false)

      // Try to fetch data with offline fallback using new consolidated API
      try {
        const response = await fetch('/api/checklists/assets-dashboard')
        if (response.ok) {
          const result = await response.json()
          const { assets: assetSummaries, departments } = result.data
          
          // Set data immediately for fast UI update
          setAssets(assetSummaries)
          setDepartments(departments)
          
          // Cache data asynchronously for offline use (non-blocking)
          Promise.all([
            // Cache individual assets
            ...assetSummaries.map((summary: any) => 
              offlineChecklistService.cacheAssetData(summary.asset.id, summary.asset).catch((error: any) => 
                console.warn('📦 Asset caching failed for', summary.asset.id, ':', error)
              )
            ),
            // Cache schedules
            offlineChecklistService.cacheChecklistSchedules(
              assetSummaries.flatMap((s: any) => s.pending_schedules), 
              'pendiente'
            ).catch((error: any) => console.warn('📦 Pending schedules cache failed:', error)),
            
            offlineChecklistService.cacheChecklistSchedules(
              assetSummaries.flatMap((s: any) => s.completed_recent), 
              'completado'
            ).catch((error: any) => console.warn('📦 Completed schedules cache failed:', error))
          ]).catch(() => {
            // Ignore cache errors - they're non-critical
          })
          
        } else if (!navigator.onLine) {
          throw new Error('Offline mode')
        }
        
      } catch (fetchError) {
        console.error('Error fetching assets dashboard:', fetchError)
        
        // Check if this is a network/offline error
        const isOfflineError = 
          !navigator.onLine ||
          (fetchError instanceof Error && fetchError.message?.includes('fetch failed')) ||
          (typeof fetchError === 'object' && fetchError !== null && 
           'offline' in fetchError && fetchError.offline === true)
        
        if (isOfflineError) {
          console.log('📱 Switching to offline mode for assets dashboard')
          setIsOfflineMode(true)
          
          // Try to get cached data
          const cachedSchedules = await offlineChecklistService.getCachedChecklistSchedules('pendiente')
          const cachedCompleted = await offlineChecklistService.getCachedChecklistSchedules('completado')
          
          if ((!cachedSchedules || cachedSchedules.length === 0) && 
              (!cachedCompleted || cachedCompleted.length === 0)) {
            toast.error('Sin datos offline disponibles. Conéctate a internet para sincronizar.')
            return
          }
          
          // Build limited asset summaries from cached data
          const uniqueAssetIds = [...new Set([
            ...(cachedSchedules || []).map((s: any) => s.asset_id),
            ...(cachedCompleted || []).map((s: any) => s.asset_id)
          ])]
          
          const offlineAssetSummaries = []
          for (const assetId of uniqueAssetIds) {
            const cachedAsset = await offlineChecklistService.getCachedAssetData(assetId)
            if (cachedAsset) {
              const assetSchedules = (cachedSchedules || []).filter((s: any) => s.asset_id === assetId)
              const assetCompleted = (cachedCompleted || []).filter((s: any) => s.asset_id === assetId)
              
              offlineAssetSummaries.push({
                asset: {
                  ...cachedAsset,
                  pending_checklists: assetSchedules.length,
                  overdue_checklists: 0, // Simple fallback
                  checklist_status: assetSchedules.length > 0 ? 'due_soon' : 'ok'
                },
                pending_schedules: assetSchedules,
                completed_recent: assetCompleted.slice(0, 3)
              })
            }
          }
          
          setAssets(offlineAssetSummaries)
          setDepartments([]) // Limited offline functionality
          toast.success('Modo offline activado - datos limitados disponibles')
          
        } else {
          throw fetchError
        }
      }

    } catch (error: any) {
      console.error('Error fetching asset checklist data:', error)
      toast.error('Error al cargar los datos de checklists por activo')
    } finally {
      setLoading(false)
    }
  }

  const filteredAssets = useMemo(() => {
    return assets.filter(({ asset }) => {
             // Search filter
       if (searchQuery) {
         const searchLower = searchQuery.toLowerCase()
         const plantName = (asset as any).plants?.name || asset.location || ''
         if (!asset.name.toLowerCase().includes(searchLower) && 
             !asset.asset_id.toLowerCase().includes(searchLower) &&
             !plantName.toLowerCase().includes(searchLower)) {
           return false
         }
       }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter !== asset.checklist_status) {
          return false
        }
      }

      // Department filter
      if (departmentFilter !== 'all') {
        // Handle new organizational structure - use department name from related table
        const assetDepartment = (asset as any).departments?.name || asset.department || 'Sin departamento'
        if (assetDepartment !== departmentFilter) {
          return false
        }
      }

      return true
    })
  }, [assets, searchQuery, statusFilter, departmentFilter])

  const getStatusBadge = (status: Asset['checklist_status']) => {
    switch (status) {
      case 'overdue':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Atrasado
          </Badge>
        )
      case 'due_soon':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Próximo
          </Badge>
        )
      case 'ok':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Al día
          </Badge>
        )
      case 'no_schedule':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Sin programar
          </Badge>
        )
    }
  }

  const getStatusColor = (status: Asset['checklist_status']) => {
    switch (status) {
      case 'overdue':
        return 'border-red-300 bg-red-50'
      case 'due_soon':
        return 'border-yellow-300 bg-yellow-50'
      case 'ok':
        return 'border-green-300 bg-green-50'
      case 'no_schedule':
        return 'border-gray-300 bg-gray-50'
    }
  }

  const statusCounts = useMemo(() => {
    return filteredAssets.reduce((counts, { asset }) => {
      counts[asset.checklist_status] = (counts[asset.checklist_status] || 0) + 1
      return counts
    }, {} as Record<Asset['checklist_status'], number>)
  }, [filteredAssets])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('es', {
      day: 'numeric',
      month: 'short'
    })
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Checklists por Activo"
          text="Cargando información de checklists..."
        >
          <Button variant="outline" asChild>
            <Link href="/checklists">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </DashboardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-6 bg-muted rounded w-20"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Checklists por Activo"
        text="Vista centrada en activos para gestión de checklists. Identifica fácilmente qué activos necesitan atención."
      >
        <div className="flex gap-2 items-center">
          {/* Offline Status Indicator */}
          <div className="mr-2">
            <OfflineStatus showDetails={false} />
          </div>
          
          <Button variant="outline" asChild>
            <Link href="/checklists">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button asChild>
            <Link href="/checklists/programar">
              <Calendar className="mr-2 h-4 w-4" />
              Programar
            </Link>
          </Button>
        </div>
      </DashboardHeader>

      {/* Offline Mode Notice */}
      {isOfflineMode && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Modo Offline - Mostrando datos en caché limitados
              </span>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-red-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {statusCounts.overdue || 0}
            </div>
            <div className="text-sm text-muted-foreground">Atrasados</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {statusCounts.due_soon || 0}
            </div>
            <div className="text-sm text-muted-foreground">Próximos</div>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {statusCounts.ok || 0}
            </div>
            <div className="text-sm text-muted-foreground">Al día</div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">
              {statusCounts.no_schedule || 0}
            </div>
            <div className="text-sm text-muted-foreground">Sin programar</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, ID o ubicación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="overdue">Atrasados</SelectItem>
                  <SelectItem value="due_soon">Próximos</SelectItem>
                  <SelectItem value="ok">Al día</SelectItem>
                  <SelectItem value="no_schedule">Sin programar</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map(({ asset, pending_schedules }) => (
            <Link key={asset.id} href={`/checklists/assets/${asset.id}`}>
              <Card className={`hover:shadow-md transition-shadow cursor-pointer ${getStatusColor(asset.checklist_status)}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg truncate">{asset.name}</CardTitle>
                      <CardDescription className="font-medium text-primary">
                        {asset.asset_id}
                      </CardDescription>
                    </div>
                    {getStatusBadge(asset.checklist_status)}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                                                             <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{(asset as any).plants?.name || asset.location || 'Sin planta'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="truncate">{(asset as any).departments?.name || asset.department || 'Sin departamento'}</span>
                    </div>
                    
                    {asset.pending_checklists > 0 && (
                      <div className="flex items-center justify-between p-2 bg-white rounded border">
                        <span className="text-sm font-medium">
                          {asset.overdue_checklists > 0 ? 
                            `${asset.overdue_checklists} atrasados` : 
                            `${asset.pending_checklists} pendientes`}
                        </span>
                        <Button size="sm" className="h-7">
                          <Play className="h-3 w-3 mr-1" />
                          Ejecutar
                        </Button>
                      </div>
                    )}
                    
                    {asset.next_checklist_date && (
                      <div className="text-xs text-muted-foreground">
                        Próximo: {formatDate(asset.next_checklist_date)}
                      </div>
                    )}
                    
                    {asset.last_checklist_date && (
                      <div className="text-xs text-muted-foreground">
                        Último: {formatDate(asset.last_checklist_date)}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredAssets.map(({ asset, pending_schedules }) => (
                <Link 
                  key={asset.id} 
                  href={`/checklists/assets/${asset.id}`}
                  className="block hover:bg-muted/50 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <Truck className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{asset.name}</h3>
                            <span className="text-sm text-muted-foreground">({asset.asset_id})</span>
                          </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {(asset as any).plants?.name || asset.location || 'Sin planta'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {(asset as any).departments?.name || asset.department || 'Sin departamento'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {asset.pending_checklists > 0 && (
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {asset.overdue_checklists > 0 ? 
                                `${asset.overdue_checklists} atrasados` : 
                                `${asset.pending_checklists} pendientes`}
                            </div>
                            {asset.next_checklist_date && (
                              <div className="text-xs text-muted-foreground">
                                {formatDate(asset.next_checklist_date)}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {getStatusBadge(asset.checklist_status)}
                        
                        {asset.pending_checklists > 0 && (
                          <Button size="sm">
                            <Play className="h-4 w-4 mr-1" />
                            Ejecutar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAssets.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No se encontraron activos
            </h3>
            <p className="text-sm text-muted-foreground">
              Ajusta los filtros o verifica que los activos tengan checklists programados.
            </p>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  )
} 