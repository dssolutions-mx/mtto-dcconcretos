"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  PenToolIcon as Tool,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react"
import { format, isToday, isSameDay, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"

interface UpcomingMaintenance {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  intervalId: string
  intervalName: string
  intervalType: string
  targetValue: number
  currentValue: number
  valueRemaining: number
  unit: string
  estimatedDate: string
  status: 'overdue' | 'upcoming' | 'covered' | 'scheduled'
  urgency: 'low' | 'medium' | 'high'
  lastMaintenance?: {
    date: string
    value: number
  }
}

interface MaintenanceSummary {
  overdue: number
  upcoming: number
  covered: number
  highUrgency: number
  mediumUrgency: number
}

export function MaintenanceSchedule() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [selectedMaintenance, setSelectedMaintenance] = useState<UpcomingMaintenance | null>(null)
  const [upcomingMaintenances, setUpcomingMaintenances] = useState<UpcomingMaintenance[]>([])
  const [summary, setSummary] = useState<MaintenanceSummary>({ 
    overdue: 0, 
    upcoming: 0, 
    covered: 0, 
    highUrgency: 0, 
    mediumUrgency: 0 
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 15
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('default')

  useEffect(() => {
    fetchUpcomingMaintenances()
  }, [page, statusFilter, sortBy])

  const fetchUpcomingMaintenances = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Construir URL con todos los parámetros
      let url = `/api/calendar/upcoming-maintenance?page=${page}&limit=${itemsPerPage}`
      if (statusFilter) {
        url += `&status=${statusFilter}`
      }
      if (sortBy && sortBy !== 'default') {
        url += `&sortBy=${sortBy}`
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Error al cargar los mantenimientos')
      }
      
      const data = await response.json()
      setUpcomingMaintenances(data.upcomingMaintenances || [])
      setSummary(data.summary || { overdue: 0, upcoming: 0, covered: 0, highUrgency: 0, mediumUrgency: 0 })
      setTotalCount(data.totalCount || 0)
      setTotalPages(Math.ceil((data.totalCount || 0) / itemsPerPage))
    } catch (err) {
      console.error('Error fetching maintenance data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  // Agrupar mantenimientos por fecha estimada
  const maintenancesByDate = upcomingMaintenances.reduce((acc, maintenance) => {
    const dateKey = maintenance.estimatedDate.split('T')[0]
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(maintenance)
    return acc
  }, {} as Record<string, UpcomingMaintenance[]>)

  // Función para manejar el clic en un día
  const handleDayClick = (day: Date | undefined) => {
    if (!day) return

    const dateKey = format(day, 'yyyy-MM-dd')
    const maintenancesOnDay = maintenancesByDate[dateKey] || []

    if (maintenancesOnDay.length > 0) {
      setSelectedMaintenance(maintenancesOnDay[0])
    } else {
      setSelectedMaintenance(null)
    }
  }

  const getStatusBadge = (status: string, urgency: string) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {urgency === 'high' ? 'Muy Vencido' : 'Vencido'}
        </Badge>
      case 'upcoming':
        return <Badge variant="default" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Próximo
        </Badge>
      case 'covered':
        return <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-600">
          <Info className="h-3 w-3" />
          Cubierto
        </Badge>
      default:
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Programado
        </Badge>
    }
  }

  const getUrgencyBadge = (urgency: string, status: string) => {
    if (status === 'overdue') {
      return getStatusBadge(status, urgency)
    }
    
    switch (urgency) {
      case 'high':
        return <Badge variant="default" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Alta
        </Badge>
      case 'medium':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Media
        </Badge>
      default:
        return <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Baja
        </Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es })
  }

  const getDaysUntilDue = (dateString: string, status: string) => {
    if (status === 'covered') {
      return 'Cubierto por mantenimientos posteriores'
    }
    
    const dueDate = new Date(dateString)
    const today = new Date()
    const days = differenceInDays(dueDate, today)
    
    if (days < 0) {
      return `${Math.abs(days)} días vencido`
    } else if (days === 0) {
      return 'Hoy'
    } else {
      return `En ${days} días`
    }
  }

  const getProgressBarColor = (status: string, urgency: string) => {
    if (status === 'overdue') {
      return urgency === 'high' ? 'bg-red-600' : 'bg-orange-500'
    }
    if (status === 'upcoming') {
      return 'bg-amber-500'
    }
    if (status === 'covered') {
      return 'bg-blue-400'
    }
    return 'bg-gray-400'
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-5">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-7">
      <Card className="md:col-span-5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendario de Mantenimientos Proyectados</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchUpcomingMaintenances}>
                <Clock className="mr-2 h-4 w-4" />
                Actualizar
              </Button>
              <div className="flex">
                <Button variant="outline" size="icon" className="rounded-r-none">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-l-none">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <CardDescription>
            Mantenimientos calculados según la misma lógica de la página individual de cada activo. Incluye mantenimientos vencidos, próximos y cubiertos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              onDayClick={handleDayClick}
              className="rounded-md border"
            />
            
            {/* Legend for calendar dots */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="h-2 w-2 rounded-full p-0" />
                <span>Vencidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="h-2 w-2 rounded-full p-0" />
                <span>Urgentes</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-2 w-2 rounded-full p-0 bg-blue-100" />
                <span>Cubiertos</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-2 w-2 rounded-full p-0" />
                <span>Próximos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.overdue}</div>
              <div className="text-xs text-muted-foreground">Vencidos</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{summary.upcoming}</div>
              <div className="text-xs text-muted-foreground">Próximos</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.covered}</div>
              <div className="text-xs text-muted-foreground">Cubiertos</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{summary.highUrgency}</div>
              <div className="text-xs text-muted-foreground">Urgentes</div>
            </div>
          </div>

          {selectedMaintenance && (
            <div className="mt-6 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm mb-2">Mantenimiento Seleccionado</h3>
              <div className="space-y-2">
                <div>
                  <div className="font-medium">{selectedMaintenance.assetName}</div>
                  <div className="text-sm text-muted-foreground">{selectedMaintenance.assetCode}</div>
                </div>
                <div>
                  <Badge 
                    variant={
                      selectedMaintenance.status === 'overdue' && selectedMaintenance.urgency === 'high' ? "destructive" :
                      selectedMaintenance.status === 'overdue' ? "default" :
                      selectedMaintenance.status === 'upcoming' ? "default" : 
                      selectedMaintenance.status === 'covered' ? "secondary" : "outline"
                    }
                    className="whitespace-nowrap"
                  >
                    {selectedMaintenance.intervalType}
                    {selectedMaintenance.unit === 'hours' && ` ${selectedMaintenance.targetValue}h`}
                    {selectedMaintenance.unit === 'kilometers' && ` ${selectedMaintenance.targetValue}km`}
                  </Badge>
                  <div className="text-sm font-medium mt-1">{selectedMaintenance.intervalName}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Intervalo:</span>
                  <span className="text-sm font-medium">
                    Cada {selectedMaintenance.targetValue} {selectedMaintenance.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado:</span>
                  {getStatusBadge(selectedMaintenance.status, selectedMaintenance.urgency)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Progreso:</span>
                  <span className="text-sm font-medium">
                    {selectedMaintenance.currentValue}/{selectedMaintenance.targetValue} {selectedMaintenance.unit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                  <div 
                    className={`h-2.5 rounded-full ${
                      selectedMaintenance.status === 'overdue' && selectedMaintenance.urgency === 'high' ? 'bg-red-600' :
                      selectedMaintenance.status === 'overdue' ? 'bg-orange-500' :
                      selectedMaintenance.status === 'upcoming' ? 'bg-amber-500' : 
                      selectedMaintenance.status === 'covered' ? 'bg-blue-400' : 'bg-gray-400'
                    }`}
                    style={{ width: `${Math.min(Math.round((selectedMaintenance.currentValue / selectedMaintenance.targetValue) * 100), 100)}%` }}
                  ></div>
                </div>
                {selectedMaintenance.status === 'covered' && (
                  <div className="text-xs text-blue-600">
                    📋 No realizado, pero cubierto por mantenimiento posterior
                  </div>
                )}
                <div>
                  {selectedMaintenance.valueRemaining > 0 && (
                    <div className="text-xs text-green-600">
                      Faltan: {selectedMaintenance.valueRemaining} {selectedMaintenance.unit === 'hours' ? 'horas' : 'km'}
                    </div>
                  )}
                  {selectedMaintenance.valueRemaining <= 0 && selectedMaintenance.status !== 'covered' && (
                    <div className="text-xs text-red-600 font-medium">
                      ¡{Math.abs(selectedMaintenance.valueRemaining)} {selectedMaintenance.unit === 'hours' ? 'horas' : 'km'} vencido!
                    </div>
                  )}
                  {!selectedMaintenance.lastMaintenance && selectedMaintenance.status !== 'covered' && (
                    <div className="text-xs text-orange-600">
                      ⚠️ Nunca realizado
                    </div>
                  )}
                </div>
                <Button 
                  variant={selectedMaintenance.status === 'covered' ? "outline" : "default"} 
                  size="sm" 
                  className="w-full mt-2" 
                  asChild
                  disabled={selectedMaintenance.status === 'covered'}
                >
                  <Link href={`/activos/${selectedMaintenance.assetId}/mantenimiento/nuevo?planId=${selectedMaintenance.intervalId}`}>
                    <Wrench className="mr-2 h-4 w-4" />
                    {selectedMaintenance.status === 'covered' ? 'Cubierto' : 
                     selectedMaintenance.status === 'overdue' && selectedMaintenance.urgency === 'high' ? "¡Urgente!" :
                     selectedMaintenance.status === 'overdue' ? "Registrar" : 
                     selectedMaintenance.status === 'upcoming' ? "Programar" : "Registrar"}
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-7">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mantenimientos que Requieren Atención</CardTitle>
            <div className="flex items-center gap-2">
              <select 
                className="border rounded px-2 py-1 text-sm"
                value={statusFilter || ''}
                onChange={(e) => {
                  setStatusFilter(e.target.value || null)
                  setPage(1) // Reiniciar paginación al cambiar filtro
                }}
              >
                <option value="">Todos los estados</option>
                <option value="overdue">Vencidos</option>
                <option value="upcoming">Próximos</option>
                <option value="covered">Cubiertos</option>
              </select>
              
              <select 
                className="border rounded px-2 py-1 text-sm"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  setPage(1) // Reiniciar paginación al cambiar filtro
                }}
              >
                <option value="default">Ordenar por prioridad</option>
                <option value="urgency">Ordenar por urgencia</option>
                <option value="date">Ordenar por fecha estimada</option>
                <option value="asset">Ordenar por activo</option>
              </select>
            </div>
          </div>
          <CardDescription>
            Lista de mantenimientos vencidos, próximos a vencer y cubiertos por mantenimientos posteriores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingMaintenances.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-2" />
              {statusFilter ? (
                <>
                  <h3 className="text-lg font-medium">No hay mantenimientos {
                    statusFilter === 'overdue' ? 'vencidos' : 
                    statusFilter === 'upcoming' ? 'próximos' : 
                    'cubiertos'
                  }</h3>
                  <p className="text-muted-foreground">Prueba con un filtro diferente o verifica otro activo</p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium">¡Todos los mantenimientos al día!</h3>
                  <p className="text-muted-foreground">No hay mantenimientos que requieran atención inmediata</p>
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Checkpoint</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Intervalo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Próximo a las</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingMaintenances.slice(0, 20).map((maintenance) => (
                  <TableRow key={maintenance.id} className={
                    maintenance.status === 'overdue' && maintenance.urgency === 'high' ? "bg-red-50" : 
                    maintenance.status === 'overdue' ? "bg-orange-50" :
                    maintenance.status === 'upcoming' ? "bg-amber-50" : 
                    maintenance.status === 'covered' ? "bg-blue-50" : ""
                  }>
                    <TableCell>
                      <div>
                        <div className="font-medium">{maintenance.assetName}</div>
                        <div className="text-sm text-muted-foreground">{maintenance.assetCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          maintenance.status === 'overdue' && maintenance.urgency === 'high' ? "destructive" :
                          maintenance.status === 'overdue' ? "default" :
                          maintenance.status === 'upcoming' ? "default" : 
                          maintenance.status === 'covered' ? "secondary" : "outline"
                        }
                        className="whitespace-nowrap"
                      >
                        {maintenance.intervalType}
                        {maintenance.unit === 'hours' && ` ${maintenance.targetValue}h`}
                        {maintenance.unit === 'kilometers' && ` ${maintenance.targetValue}km`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{maintenance.intervalName}</div>
                      {maintenance.lastMaintenance && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Último: {format(new Date(maintenance.lastMaintenance.date), "dd 'de' MMMM 'de' yyyy", { locale: es })} a las {maintenance.lastMaintenance.value} {maintenance.unit}
                        </div>
                      )}
                      {!maintenance.lastMaintenance && maintenance.status === 'covered' && (
                        <div className="text-xs text-blue-600 mt-1">
                          📋 No realizado, pero cubierto por mantenimiento posterior
                        </div>
                      )}
                      {!maintenance.lastMaintenance && maintenance.status !== 'covered' && (
                        <div className="text-xs text-orange-600 mt-1">
                          ⚠️ Nunca realizado
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        Cada {maintenance.targetValue} {maintenance.unit}
                      </div>
                      {maintenance.lastMaintenance ? (
                        <div className="text-xs text-muted-foreground">
                          Desde las {maintenance.lastMaintenance.value}{maintenance.unit} hasta las {maintenance.targetValue}{maintenance.unit}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {maintenance.status === 'covered' 
                            ? `Cubierto por mantenimientos posteriores`
                            : `Desde 0${maintenance.unit} hasta las ${maintenance.targetValue}${maintenance.unit}`
                          }
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                        <div 
                          className={`h-2.5 rounded-full ${
                            maintenance.status === 'overdue' && maintenance.urgency === 'high' ? 'bg-red-600' :
                            maintenance.status === 'overdue' ? 'bg-orange-500' :
                            maintenance.status === 'upcoming' ? 'bg-amber-500' : 
                            maintenance.status === 'covered' ? 'bg-blue-400' : 'bg-gray-400'
                          }`}
                          style={{ width: `${Math.min(Math.round((maintenance.currentValue / maintenance.targetValue) * 100), 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs">
                        {maintenance.status === 'covered' ? 'Cubierto' : `${Math.round((maintenance.currentValue / maintenance.targetValue) * 100)}% completado`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {maintenance.unit === 'hours' ? 'Horas actuales: ' : 'Kilómetros actuales: '}{maintenance.currentValue}{maintenance.unit === 'hours' ? 'h' : 'km'}
                      </div>
                      {maintenance.status === 'overdue' && (
                        <div className="text-xs text-red-600 font-medium mt-1">
                          {maintenance.urgency === 'high' ? '🚨 Muy vencido' : '⚠️ Vencido'}
                        </div>
                      )}
                      {maintenance.status === 'covered' && (
                        <div className="text-xs text-blue-600 font-medium mt-1">
                          ℹ️ Cubierto por mantenimiento posterior
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {maintenance.targetValue} {maintenance.unit === 'hours' ? 'horas' : 'km'}
                        </div>
                        {maintenance.valueRemaining > 0 && (
                          <div className="text-xs text-green-600">
                            Faltan: {maintenance.valueRemaining} {maintenance.unit === 'hours' ? 'horas' : 'km'}
                          </div>
                        )}
                        {maintenance.valueRemaining <= 0 && maintenance.status !== 'covered' && (
                          <div className="text-xs text-red-600 font-medium">
                            ¡{Math.abs(maintenance.valueRemaining)} {maintenance.unit === 'hours' ? 'horas' : 'km'} vencido!
                          </div>
                        )}
                        {maintenance.status === 'covered' && (
                          <div className="text-xs text-blue-600">
                            Cubierto por mantenimiento posterior
                          </div>
                        )}
                        {!maintenance.lastMaintenance && maintenance.status !== 'covered' && (
                          <div className="text-xs text-orange-600">
                            Nunca realizado
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {maintenance.status === 'covered' ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled
                          className="opacity-50"
                        >
                          Cubierto
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant={
                            maintenance.status === 'overdue' && maintenance.urgency === 'high' ? "destructive" :
                            maintenance.status === 'overdue' || maintenance.status === 'upcoming' ? "default" : "outline"
                          }
                          asChild
                        >
                          <Link href={`/activos/${maintenance.assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                            <Wrench className="h-4 w-4 mr-2" />
                            {maintenance.status === 'overdue' && maintenance.urgency === 'high' ? "¡Urgente!" :
                            maintenance.status === 'overdue' ? "Registrar" : 
                            maintenance.status === 'upcoming' ? "Programar" : "Registrar"}
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Mostrando página {page} de {totalPages} ({totalCount} mantenimientos)
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leyenda explicativa */}
      <Card className="md:col-span-7">
        <CardHeader>
          <CardTitle className="text-lg">Explicación de Estados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Vencido
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Mantenimientos que ya deberían haberse realizado según las horas actuales del equipo.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Próximo
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Mantenimientos que están cerca de su fecha programada (dentro de 30 días estimados).
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-600">
                  <Info className="h-3 w-3" />
                  Cubierto
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Mantenimientos que nunca se realizaron individualmente, pero fueron cubiertos por un mantenimiento posterior de mayor intervalo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
