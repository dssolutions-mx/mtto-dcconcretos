'use client'

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CompletedChecklistEvidenceViewer } from "@/components/checklists/completed-checklist-evidence-viewer"
import { 
  ArrowLeft, 
  Camera, 
  Calendar, 
  User, 
  Search, 
  Filter,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { createBrowserClient } from '@supabase/ssr'

interface CompletedChecklist {
  id: string
  checklist_id: string
  asset_id: string
  technician: string
  completion_date: string
  notes: string | null
  status: string
  equipment_hours_reading: number | null
  equipment_kilometers_reading: number | null
  created_by: string | null
  checklists: {
    id: string
    name: string
    frequency: string
  } | null
  profiles: {
    id: string
    nombre: string | null
    apellido: string | null
  } | null
}

interface Asset {
  id: string
  name: string
  asset_id: string
}

export default function ChecklistHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const assetId = resolvedParams.id
  const router = useRouter()
  
  const [asset, setAsset] = useState<Asset | null>(null)
  const [checklists, setChecklists] = useState<CompletedChecklist[]>([])
  const [filteredChecklists, setFilteredChecklists] = useState<CompletedChecklist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [frequencyFilter, setFrequencyFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")

  // Cargar datos del activo y checklists
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Cargar información del activo
        const { data: assetData, error: assetError } = await supabase
          .from('assets')
          .select('id, name, asset_id')
          .eq('id', assetId)
          .single()

        if (assetError) throw assetError
        setAsset(assetData)

        // Cargar checklists completados
        const { data: checklistsData, error: checklistsError } = await supabase
          .from('completed_checklists')
          .select(`
            id,
            checklist_id,
            asset_id,
            technician,
            completion_date,
            notes,
            status,
            equipment_hours_reading,
            equipment_kilometers_reading,
            created_by,
            checklists (
              id,
              name,
              frequency
            ),
            created_by_profile:profiles!created_by (
              id,
              nombre,
              apellido
            )
          `)
          .eq('asset_id', assetId)
          .order('completion_date', { ascending: false })

        if (checklistsError) throw checklistsError
        
        // Transformar los datos para que coincidan con nuestro tipo
        const transformedData = (checklistsData || []).map((item: any) => ({
          ...item,
          checklists: Array.isArray(item.checklists) ? item.checklists[0] : item.checklists,
          profiles: Array.isArray(item.created_by_profile) ? item.created_by_profile[0] : item.created_by_profile
        }))
        
        setChecklists(transformedData)
        setFilteredChecklists(transformedData)
      } catch (err: any) {
        console.error('Error loading data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (assetId) {
      loadData()
    }
  }, [assetId])

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...checklists]

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(checklist =>
        checklist.checklists?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.technician?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (checklist.profiles?.nombre && checklist.profiles?.apellido && 
         `${checklist.profiles.nombre} ${checklist.profiles.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    // Filtro de estado
    if (statusFilter !== "all") {
      filtered = filtered.filter(checklist => 
        checklist.status?.toLowerCase() === statusFilter.toLowerCase()
      )
    }

    // Filtro de frecuencia
    if (frequencyFilter !== "all") {
      filtered = filtered.filter(checklist => 
        checklist.checklists?.frequency === frequencyFilter
      )
    }

    // Filtro de fecha
    if (dateFilter !== "all") {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateFilter) {
        case "week":
          filterDate.setDate(now.getDate() - 7)
          break
        case "month":
          filterDate.setMonth(now.getMonth() - 1)
          break
        case "quarter":
          filterDate.setMonth(now.getMonth() - 3)
          break
      }
      
      filtered = filtered.filter(checklist => 
        new Date(checklist.completion_date) >= filterDate
      )
    }

    setFilteredChecklists(filtered)
  }, [checklists, searchTerm, statusFilter, frequencyFilter, dateFilter])

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completado':
        return (
          <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completado
          </Badge>
        )
      case 'con problemas':
        return (
          <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Con Problemas
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            {status || 'Desconocido'}
          </Badge>
        )
    }
  }

  const getFrequencyBadge = (frequency: string) => {
    const colors = {
      'diario': 'bg-blue-100 text-blue-800',
      'semanal': 'bg-green-100 text-green-800',
      'mensual': 'bg-purple-100 text-purple-800',
      'trimestral': 'bg-orange-100 text-orange-800'
    }
    
    return (
      <Badge variant="outline" className={colors[frequency as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {frequency || 'N/A'}
      </Badge>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Historial de Checklists" text="Cargando..." />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell>
        <DashboardHeader heading="Historial de Checklists" text="" />
        <Alert variant="destructive">
          <AlertDescription>Error al cargar el historial: {error}</AlertDescription>
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Historial de Checklists - ${asset?.name || 'Activo'}`}
        text={`Historial completo de inspecciones realizadas en ${asset?.asset_id || 'este activo'}`}
      >
        <Button variant="outline" asChild>
          <Link href={`/activos/${assetId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Activo
          </Link>
        </Button>
      </DashboardHeader>

      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Filtra los checklists por diferentes criterios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Nombre, técnico..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="con problemas">Con Problemas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Frecuencia</label>
                <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las frecuencias</SelectItem>
                    <SelectItem value="diario">Diario</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el historial</SelectItem>
                    <SelectItem value="week">Última semana</SelectItem>
                    <SelectItem value="month">Último mes</SelectItem>
                    <SelectItem value="quarter">Últimos 3 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <ClipboardCheck className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{filteredChecklists.length}</p>
                  <p className="text-sm text-muted-foreground">Checklists Completados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {filteredChecklists.filter(c => c.status?.toLowerCase() === 'completado').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Sin Problemas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">
                    {filteredChecklists.filter(c => c.status?.toLowerCase() === 'con problemas').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Con Problemas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de checklists */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Checklists</CardTitle>
            <CardDescription>
              {filteredChecklists.length} de {checklists.length} checklists mostrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredChecklists.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium mb-2">No se encontraron checklists</p>
                <p className="text-sm text-muted-foreground">
                  {checklists.length === 0 
                    ? "Este activo no tiene checklists completados" 
                    : "Intenta ajustar los filtros para ver más resultados"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Frecuencia</TableHead>
                      <TableHead>Lecturas</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChecklists.map((checklist) => (
                      <TableRow key={checklist.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {format(new Date(checklist.completion_date), "dd/MM/yyyy", { locale: es })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(checklist.completion_date), "HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <p className="font-medium">{checklist.checklists?.name || 'Sin nombre'}</p>
                            {checklist.notes && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {checklist.notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {checklist.profiles ? 
                                `${checklist.profiles.nombre} ${checklist.profiles.apellido}` : 
                                checklist.technician || 'No especificado'}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {getStatusBadge(checklist.status)}
                        </TableCell>
                        
                        <TableCell>
                          {getFrequencyBadge(checklist.checklists?.frequency || '')}
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-xs space-y-1">
                            {checklist.equipment_hours_reading && (
                              <div>🕒 {checklist.equipment_hours_reading}h</div>
                            )}
                            {checklist.equipment_kilometers_reading && (
                              <div>🚗 {checklist.equipment_kilometers_reading}km</div>
                            )}
                            {!checklist.equipment_hours_reading && !checklist.equipment_kilometers_reading && (
                              <span className="text-muted-foreground">Sin lecturas</span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <CompletedChecklistEvidenceViewer
                              completedChecklistId={checklist.id}
                              checklistName={checklist.checklists?.name || 'Sin nombre'}
                              completionDate={checklist.completion_date}
                              technician={checklist.profiles ? 
                                `${checklist.profiles.nombre} ${checklist.profiles.apellido}` : 
                                checklist.technician || 'No especificado'}
                              assetName={asset?.name || 'Activo desconocido'}
                              trigger={
                                <Button variant="outline" size="sm">
                                  <Camera className="h-4 w-4 mr-2" />
                                  Evidencias
                                </Button>
                              }
                            />
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/checklists/completado/${checklist.id}`}>
                                Ver Detalles
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
} 