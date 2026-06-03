"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, FileText, AlertTriangle, Clock, RefreshCw, Search, Filter, Wrench, Settings, X, MapPin, Users, Gauge, Calendar, History } from "lucide-react"
import { Asset } from "@/types"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase"
import {
  computeCyclicIntervalResults,
  cyclicResultsToListFlags,
  filterRelevantCyclicResults,
  parseMaintenanceUnitString,
} from "@/lib/utils/cyclic-maintenance"
import { getCurrentValue } from "@/lib/utils/maintenance-units"

interface AssetsListProps {
  assets: Asset[] | null
  loading?: boolean
  error?: Error | null
}

interface MaintenanceData {
  [assetId: string]: {
    nextMaintenances: any[]
    hasOverdue: boolean
    hasUpcoming: boolean
    lastMaintenanceValue: number
    maintenanceUnit: "hours" | "kilometers"
  }
}

export function AssetsList({ assets, loading = false, error }: AssetsListProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [maintenanceData, setMaintenanceData] = useState<MaintenanceData>({})
  const [maintenanceLoading, setMaintenanceLoading] = useState(true)

  // Fetch maintenance data for all assets
  useEffect(() => {
    const fetchMaintenanceData = async () => {
      if (!assets || assets.length === 0) return
      
      try {
        setMaintenanceLoading(true)
        const supabase = createClient()
        
        // Get maintenance intervals for each asset
        const assetsWithModels = assets.filter(asset => asset.model_id)
        const modelIds = [...new Set(assetsWithModels.map(asset => asset.model_id!))]
        
        if (modelIds.length === 0) {
          setMaintenanceData({})
          setMaintenanceLoading(false)
          return
        }
        
        // Fetch maintenance intervals for all models
        const { data: intervals, error: intervalsError } = await supabase
          .from('maintenance_intervals')
          .select('*')
          .in('model_id', modelIds)
        
        if (intervalsError) throw intervalsError
        
        // Fetch maintenance history for all assets
        const assetIds = assets.map(asset => asset.id)
        const { data: history, error: historyError } = await supabase
          .from('maintenance_history')
          .select('asset_id, maintenance_plan_id, hours, kilometers, date')
          .in('asset_id', assetIds)
          .order('date', { ascending: false })
        
        if (historyError) throw historyError
        
        // Process data for each asset using CYCLIC maintenance logic
        const data: MaintenanceData = {}
        
        for (const asset of assets) {
          const assetIntervals =
            intervals?.filter((interval) => interval.model_id === asset.model_id) || []

          const assetHistory = history?.filter((h) => h.asset_id === asset.id) || []

          const maintenanceUnit = parseMaintenanceUnitString(
            (asset as { equipment_models?: { maintenance_unit?: string } }).equipment_models
              ?.maintenance_unit
          )
          const currentValue = getCurrentValue(asset, maintenanceUnit)

          const intervalResults =
            assetIntervals.length > 0
              ? computeCyclicIntervalResults({
                  intervals: assetIntervals,
                  history: assetHistory,
                  currentValue,
                  unit: maintenanceUnit,
                  options: { applyEarliestUnpaid: true },
                })
              : []

          const flags = cyclicResultsToListFlags(intervalResults, assetHistory, maintenanceUnit)
          const relevant = filterRelevantCyclicResults(intervalResults)

          data[asset.id] = {
            nextMaintenances: relevant.map((r) => ({
              id: r.intervalId,
              name: r.interval.name || r.interval.description,
              intervalValue: r.interval.interval_value,
              currentValue: r.currentValue,
              valueRemaining: r.valueRemaining,
              status: r.status,
              urgency: r.urgency,
              unit: maintenanceUnit,
              wasPerformed: r.wasPerformed,
              nextDueHour: r.nextDueValue,
              nextDueValue: r.nextDueValue,
            })),
            hasOverdue: flags.hasOverdue,
            hasUpcoming: flags.hasUpcoming,
            lastMaintenanceValue: flags.lastMaintenanceValue,
            maintenanceUnit,
          }
        }
        
        setMaintenanceData(data)
      } catch (error) {
        console.error('Error fetching maintenance data:', error)
        setMaintenanceData({})
      } finally {
        setMaintenanceLoading(false)
      }
    }
    
    fetchMaintenanceData()
  }, [assets])

  // Get unique locations for filter
  const locations = useMemo(() => {
    if (!assets) return []
    // Use plant names and fallback to location
    const uniqueLocations = Array.from(new Set(
      assets.map(asset => {
        // If asset has plant information, use plant name, otherwise fall back to location
        const assetWithPlant = asset as any
        if (assetWithPlant.plants?.name) {
          return assetWithPlant.plants.name
        }
        return asset.location
      }).filter((location): location is string => Boolean(location))
    ))
    return uniqueLocations.sort()
  }, [assets])

  // Filter and search logic
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    
    return assets.filter(asset => {
      const assetWithPlant = asset as any
      const matchesSearch = searchTerm === '' || 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assetWithPlant.plants?.name && assetWithPlant.plants.name.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesLocation = locationFilter === 'all' || 
        (assetWithPlant.plants?.name === locationFilter) ||
        asset.location === locationFilter

      const matchesStatus = statusFilter === 'all' || asset.status === statusFilter

      return matchesSearch && matchesLocation && matchesStatus
    })
  }, [assets, searchTerm, locationFilter, statusFilter])

  // Función para mostrar el estado con un color adecuado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-500">Operativo</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-500">En Mantenimiento</Badge>
      case "repair":
        return <Badge className="bg-red-500">En Reparación</Badge>
      case "inactive":
        return <Badge variant="outline">Inactivo</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  }

  // Enhanced maintenance status with real data
  const getMaintenanceStatus = (asset: Asset) => {
    const data = maintenanceData[asset.id]
    
    if (!data || maintenanceLoading) {
      return {
        status: "Cargando...",
        color: "text-gray-500",
        urgent: false
      }
    }
    
    if (data.hasOverdue) {
      return {
        status: "Vencido",
        color: "text-red-600",
        urgent: true
      }
    }
    
    if (data.hasUpcoming) {
      return {
        status: "Próximo",
        color: "text-amber-600",
        urgent: true
      }
    }
    
    return {
      status: "Al día",
      color: "text-green-600",
      urgent: false
    }
  }

  // Enhanced alerts logic with real data
  const getAssetAlerts = (asset: Asset) => {
    const alerts = []
    const data = maintenanceData[asset.id]
    
    if (data && !maintenanceLoading) {
      if (data.hasOverdue) {
        alerts.push({
          text: "Mantenimiento vencido",
          variant: "destructive" as const
        })
      } else if (data.hasUpcoming) {
        alerts.push({
          text: "Mantenimiento próximo",
          variant: "default" as const
        })
      }
    }
    
    if (asset.status === "repair") {
      alerts.push({
        text: "En reparación",
        variant: "destructive" as const
      })
    } else if (asset.status === "maintenance") {
      alerts.push({
        text: "En mantenimiento",
        variant: "default" as const
      })
    }
    
    return alerts
  }

  const clearFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setLocationFilter("all")
  }

  const hasActiveFilters = searchTerm !== "" || statusFilter !== "all" || locationFilter !== "all"

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Cargando activos...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, nombre, ubicación, departamento..."
                aria-label="Buscar por ID, nombre, ubicación o departamento"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters - full width stacked on mobile to avoid overflow */}
            <div className={cn("flex gap-2", isMobile && "flex-col w-full")}>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[140px]")}>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="operational">Operativo</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="repair">Reparación</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[140px]")}>
                  <SelectValue placeholder="Ubicación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ubicaciones</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
          
          {/* Results counter */}
          <div className="mt-2 text-sm text-muted-foreground">
            {filteredAssets.length} de {assets?.length || 0} activos
            {hasActiveFilters && " (filtrado)"}
          </div>
        </CardContent>
      </Card>

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No se encontraron activos</h3>
            <p className="text-muted-foreground mb-4">
              {hasActiveFilters 
                ? "No hay activos que coincidan con los filtros seleccionados."
                : "No hay activos registrados en el sistema."
              }
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const maintenanceStatus = getMaintenanceStatus(asset)
            const alerts = getAssetAlerts(asset)
            
            return (
              <Card
                key={asset.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none"
                onClick={() => router.push(`/activos/${asset.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    router.push(`/activos/${asset.id}`)
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight font-mono tabular-nums">{asset.asset_id}</CardTitle>
                      <CardDescription className="mt-1 truncate">{asset.name}</CardDescription>
                    </div>
                    <Badge 
                      variant={
                        asset.status === "operational" ? "default" :
                        asset.status === "maintenance" ? "secondary" :
                        asset.status === "repair" ? "destructive" : "outline"
                      }
                      className="ml-2 shrink-0"
                    >
                      {asset.status === "operational" ? "Operativo" :
                       asset.status === "maintenance" ? "Mantenimiento" :
                       asset.status === "repair" ? "Reparación" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Asset Details */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">
                        {(asset as any).departments?.name || asset.department || "Sin dep."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{asset.current_hours || 0}h</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="text-green-700 font-medium truncate">
                        {(asset as any).plants?.name || asset.location || "Sin ubicación"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Maintenance Status */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className={`text-sm font-medium ${maintenanceStatus.color}`}>
                      {maintenanceStatus.status}
                    </span>
                    {maintenanceStatus.urgent && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  
                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {alerts.map((alert, index) => (
                        <Badge key={index} variant={alert.variant} className="text-xs">
                          {alert.text}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1 touch-target min-h-[44px]" asChild>
                      <Link href={`/activos/${asset.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild aria-label="Ver mantenimiento" className="touch-target shrink-0">
                      <Link href={`/activos/${asset.id}/mantenimiento`}>
                        <Wrench className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild aria-label="Ver historial" className="touch-target shrink-0">
                      <Link href={`/activos/${asset.id}/historial`}>
                        <History className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

