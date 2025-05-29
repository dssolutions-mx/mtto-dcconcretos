"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, FileText, AlertTriangle, Clock, RefreshCw, Search, Filter, Wrench, Settings, X, MapPin, Users, Gauge, Calendar, History } from "lucide-react"
import { Asset } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase"

interface AssetsListProps {
  assets?: Asset[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

interface MaintenanceData {
  [assetId: string]: {
    nextMaintenances: any[]
    hasOverdue: boolean
    hasUpcoming: boolean
    lastMaintenanceHours: number
  }
}

export function AssetsList({ assets, isLoading = false, onRefresh }: AssetsListProps) {
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
        
        // Process data for each asset
        const data: MaintenanceData = {}
        
        for (const asset of assets) {
          const assetIntervals = intervals?.filter(interval => 
            interval.model_id === asset.model_id
          ) || []
          
          const assetHistory = history?.filter(h => h.asset_id === asset.id) || []
          
          // Find the last maintenance hours for this asset
          const allMaintenanceHours = assetHistory
            .map(m => Number(m.hours) || 0)
            .filter(h => h > 0)
            .sort((a, b) => b - a)
          
          const lastMaintenanceHours = allMaintenanceHours.length > 0 ? allMaintenanceHours[0] : 0
          
          const currentHours = asset.current_hours || 0
          const maintenanceUnit = (asset as any).equipment_models?.maintenance_unit || 'hours'
          
          const nextMaintenances = []
          let hasOverdue = false
          let hasUpcoming = false
          
          for (const interval of assetIntervals) {
            // Check if this specific maintenance type was already performed
            const lastMaintenanceOfType = assetHistory.find(m => 
              m.maintenance_plan_id === interval.id
            )
            
            if (lastMaintenanceOfType) {
              // This maintenance was already performed, skip it
              continue
            }
            
            const intervalValue = interval.interval_value || 0
            
            let status = 'scheduled'
            let urgency = 'low'
            
            if (maintenanceUnit === 'hours') {
              // Check if covered by later maintenance
              if (intervalValue <= lastMaintenanceHours) {
                status = 'covered'
              } else if (currentHours >= intervalValue) {
                // Overdue
                status = 'overdue'
                hasOverdue = true
                const hoursOverdue = currentHours - intervalValue
                urgency = hoursOverdue > intervalValue * 0.3 ? 'high' : 'medium'
              } else {
                // Check proximity
                const hoursRemaining = intervalValue - currentHours
                if (hoursRemaining <= 50) {
                  status = 'upcoming'
                  hasUpcoming = true
                  urgency = hoursRemaining <= 25 ? 'high' : 'medium'
                } else {
                  status = 'scheduled'
                  urgency = 'low'
                }
              }
            }
            
            nextMaintenances.push({
              id: interval.id,
              name: interval.name || interval.description,
              intervalValue,
              currentValue: currentHours,
              status,
              urgency,
              unit: maintenanceUnit
            })
          }
          
          data[asset.id] = {
            nextMaintenances,
            hasOverdue,
            hasUpcoming,
            lastMaintenanceHours
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
    const uniqueLocations = Array.from(new Set(assets.map(asset => asset.location).filter((location): location is string => Boolean(location))))
    return uniqueLocations.sort()
  }, [assets])

  // Filter and search logic
  const filteredAssets = useMemo(() => {
    if (!assets) return []
    
    return assets.filter(asset => {
      // Search filter
      const searchFields = [
        asset.asset_id,
        asset.name,
        asset.location,
        asset.department,
        (asset as any).equipment_models?.name,
        (asset as any).equipment_models?.manufacturer
      ]
      
      const matchesSearch = searchTerm === "" || 
        searchFields.some(field => 
          field?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      
      // Status filter
      const matchesStatus = statusFilter === "all" || asset.status === statusFilter
      
      // Location filter
      const matchesLocation = locationFilter === "all" || (asset.location && asset.location === locationFilter)
      
      return matchesSearch && matchesStatus && matchesLocation
    })
  }, [assets, searchTerm, statusFilter, locationFilter])

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

  if (isLoading) {
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filters */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[140px]">
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
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-tight">{asset.name}</CardTitle>
                      <CardDescription className="mt-1">{asset.asset_id}</CardDescription>
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
                      <span className="truncate">{asset.department || "Sin dep."}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{asset.current_hours || 0}h</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{asset.location || "Sin ubicación"}</span>
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
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" asChild>
                      <Link href={`/activos/${asset.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/activos/${asset.id}/mantenimiento`}>
                        <Wrench className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
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

