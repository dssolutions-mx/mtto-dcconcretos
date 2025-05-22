"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileText, MoreHorizontal, Search,  
  AlertTriangle, Wrench, CalendarDays, Filter, ClipboardCheck
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Esta interfaz debe coincidir con la estructura de las órdenes de servicio en la base de datos
interface ServiceOrder {
  id: string;
  order_id: string;
  asset_id: string;
  asset_name: string;
  type: string;
  priority: string;
  status: string;
  date: string;
  technician: string;
  description: string;
  total_cost?: string;
  work_order_id?: string;
  completion_date?: string;
  created_at?: string;
  updated_at?: string;
}

// Ampliamos la interfaz para incluir el nombre del activo para la visualización
interface ServiceOrderWithAssetDetails extends ServiceOrder {
  asset_name: string;
  assetData?: {
    name: string;
    asset_id: string;
  }
}

export function ServiceOrdersList() {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrderWithAssetDetails[]>([])
  const [filteredOrders, setFilteredOrders] = useState<ServiceOrderWithAssetDetails[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchServiceOrders() {
      setIsLoading(true)
      try {
        const supabase = createClient()
        
        // Obtenemos las órdenes de servicio con información básica del activo
        const { data, error } = await supabase
          .from("service_orders")
          .select(`
            *,
            asset:asset_id (name, asset_id)
          `)
          .order("created_at", { ascending: false })
        
        if (error) throw error
        
        // Transformamos los datos para incluir el nombre del activo para mostrar
        const formattedOrders: ServiceOrderWithAssetDetails[] = data.map((order: any) => ({
          ...order,
          asset_name: order.asset?.name || 'Activo no encontrado',
          assetData: order.asset
        }))
        
        setServiceOrders(formattedOrders)
        setFilteredOrders(formattedOrders)
      } catch (error: any) {
        console.error("Error al cargar las órdenes de servicio:", error.message)
        setError("No se pudieron cargar las órdenes de servicio. Por favor, intente de nuevo.")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchServiceOrders()
  }, [])

  // Aplicar filtros cuando cambian los criterios de búsqueda o filtros
  useEffect(() => {
    let result = [...serviceOrders]
    
    // Aplicar filtro de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(order => 
        order.order_id.toLowerCase().includes(query) ||
        order.asset_name.toLowerCase().includes(query) ||
        order.description.toLowerCase().includes(query) ||
        order.technician.toLowerCase().includes(query)
      )
    }
    
    // Aplicar filtro de estado
    if (statusFilter) {
      result = result.filter(order => order.status.toLowerCase() === statusFilter.toLowerCase())
    }
    
    setFilteredOrders(result)
  }, [searchQuery, statusFilter, serviceOrders])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", label: string }> = {
      "pendiente": { variant: "outline", label: "Pendiente" },
      "en_proceso": { variant: "secondary", label: "En Proceso" },
      "completado": { variant: "default", label: "Completado" },
      "cancelado": { variant: "destructive", label: "Cancelado" }
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { variant: "default", label: status }
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    )
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter(null)
    setFilteredOrders(serviceOrders)
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A"
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: es })
    } catch (error) {
      return dateStr
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Órdenes de Servicio</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por ID, activo, descripción..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1">
                    <Filter className="h-4 w-4" />
                    Estado
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("pendiente")}>
                    Pendiente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("en_proceso")}>
                    En Proceso
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("completado")}>
                    Completado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("cancelado")}>
                    Cancelado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No se encontraron órdenes de servicio que coincidan con los criterios de búsqueda.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_id}</TableCell>
                      <TableCell>{order.asset_name}</TableCell>
                      <TableCell>{order.type === 'corrective' ? 'Correctivo' : order.type === 'preventive' ? 'Preventivo' : order.type}</TableCell>
                      <TableCell>{order.technician}</TableCell>
                      <TableCell>{formatDate(order.date)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/servicios/${order.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Detalles
                              </Link>
                            </DropdownMenuItem>
                            {order.work_order_id && (
                              <DropdownMenuItem asChild>
                                <Link href={`/ordenes/${order.work_order_id}`}>
                                  <ClipboardCheck className="mr-2 h-4 w-4" />
                                  Ver Orden de Trabajo
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
  )
} 