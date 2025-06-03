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

// Enhanced interface to match the comprehensive service order structure
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
  technician_id: string | null;
  description: string;
  findings: string | null;
  actions: string | null;
  notes: string | null;
  parts: any[] | null;
  labor_hours: number | null;
  labor_cost: string | null;
  parts_cost: string | null;
  total_cost: string | null;
  work_order_id?: string;
  checklist_id?: string | null;
  documents?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

// Enhanced interface with asset details
interface ServiceOrderWithAssetDetails extends ServiceOrder {
  asset_name: string;
  assetData?: {
    name: string;
    asset_id: string;
    location: string | null;
    equipment_model?: {
      name: string;
      manufacturer: string;
    } | null;
  }
}

export function ServiceOrdersList() {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrderWithAssetDetails[]>([])
  const [filteredOrders, setFilteredOrders] = useState<ServiceOrderWithAssetDetails[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchServiceOrders() {
      setIsLoading(true)
      try {
        const supabase = createClient()
        
        // Get service orders with comprehensive asset information
        const { data, error } = await supabase
          .from("service_orders")
          .select(`
            *,
            asset:asset_id (
              name, 
              asset_id, 
              location,
              equipment_model:model_id (
                name,
                manufacturer
              )
            )
          `)
          .order("date", { ascending: false })
        
        if (error) throw error
        
        // Transform data to include asset details
        const formattedOrders: ServiceOrderWithAssetDetails[] = data.map((order: any) => ({
          ...order,
          asset_name: order.asset?.name || order.asset_name || 'Activo no encontrado',
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

  // Apply filters when search criteria or filters change
  useEffect(() => {
    let result = [...serviceOrders]
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(order => 
        order.order_id.toLowerCase().includes(query) ||
        order.asset_name.toLowerCase().includes(query) ||
        order.description.toLowerCase().includes(query) ||
        order.technician.toLowerCase().includes(query) ||
        (order.assetData?.asset_id && order.assetData.asset_id.toLowerCase().includes(query))
      )
    }
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(order => order.status.toLowerCase() === statusFilter.toLowerCase())
    }
    
    // Apply type filter
    if (typeFilter) {
      result = result.filter(order => order.type.toLowerCase() === typeFilter.toLowerCase())
    }
    
    setFilteredOrders(result)
  }, [searchQuery, statusFilter, typeFilter, serviceOrders])

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", label: string, color: string }> = {
      "pendiente": { variant: "outline", label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
      "en_proceso": { variant: "secondary", label: "En Proceso", color: "bg-blue-100 text-blue-800" },
      "completado": { variant: "default", label: "Completado", color: "bg-green-100 text-green-800" },
      "cancelado": { variant: "destructive", label: "Cancelado", color: "bg-red-100 text-red-800" }
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { variant: "default", label: status, color: "bg-gray-100 text-gray-800" }
    
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const priorityMap: Record<string, { variant: "default" | "outline" | "secondary" | "destructive", color: string }> = {
      "baja": { variant: "outline", color: "bg-green-100 text-green-800" },
      "media": { variant: "secondary", color: "bg-blue-100 text-blue-800" },
      "alta": { variant: "default", color: "bg-orange-100 text-orange-800" },
      "crítica": { variant: "destructive", color: "bg-red-100 text-red-800" }
    }
    
    const priorityInfo = priorityMap[priority.toLowerCase()] || { variant: "secondary", color: "bg-blue-100 text-blue-800" }
    
    return (
      <Badge variant={priorityInfo.variant} className={priorityInfo.color}>
        {priority}
      </Badge>
    )
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter(null)
    setTypeFilter(null)
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

  const formatCurrency = (amount: string | null | undefined) => {
    if (!amount) return "N/A"
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
      }).format(parseFloat(amount))
    } catch (error) {
      return amount
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
          <div className="flex flex-col gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por ID, activo, descripción, técnico..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1 w-full sm:w-auto">
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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-1 w-full sm:w-auto">
                    <Wrench className="h-4 w-4" />
                    Tipo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTypeFilter(null)}>
                    Todos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("preventive")}>
                    Preventivo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter("corrective")}>
                    Correctivo
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
            <>
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{order.order_id}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(order.total_cost)}</div>
                          {order.labor_hours && (
                            <div className="text-sm text-muted-foreground">{order.labor_hours}h</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Activo:</span> {order.asset_name}
                          {order.assetData?.asset_id && (
                            <div className="text-xs text-muted-foreground">ID: {order.assetData.asset_id}</div>
                          )}
                          {order.assetData?.location && (
                            <div className="text-xs text-muted-foreground">📍 {order.assetData.location}</div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Tipo:</span>
                          {order.type === 'corrective' ? (
                            <>
                              <Wrench className="h-4 w-4 text-red-500" />
                              <span>Correctivo</span>
                            </>
                          ) : order.type === 'preventive' ? (
                            <>
                              <CalendarDays className="h-4 w-4 text-blue-500" />
                              <span>Preventivo</span>
                            </>
                          ) : (
                            <span>{order.type}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">Técnico:</span> {order.technician}
                          </div>
                          {order.priority && getPriorityBadge(order.priority)}
                        </div>
                        
                        <div>
                          <span className="font-medium">Fecha:</span> {formatDate(order.date)}
                        </div>
                        
                        {order.description && (
                          <div>
                            <span className="font-medium">Descripción:</span>
                            <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{order.description}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" asChild className="flex-1">
                          <Link href={`/servicios/${order.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Link>
                        </Button>
                        
                                                  {order.work_order_id && (
                            <Button variant="outline" size="sm" asChild className="flex-1">
                              <Link href={`/ordenes/${order.work_order_id}`}>
                                <ClipboardCheck className="h-4 w-4 mr-1" />
                                OT
                              </Link>
                            </Button>
                          )}
                          
                          {order.asset_id && (
                            <Button variant="outline" size="sm" asChild className="flex-1">
                              <Link href={`/activos/${order.asset_id}`}>
                                <FileText className="h-4 w-4 mr-1" />
                                Activo
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Activo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Costo Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.asset_name}</p>
                              <p className="text-xs text-muted-foreground">{order.assetData?.asset_id}</p>
                              {order.assetData?.location && (
                                <p className="text-xs text-muted-foreground">{order.assetData.location}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {order.type === 'corrective' ? (
                                <>
                                  <Wrench className="h-4 w-4 text-red-500" />
                                  <span>Correctivo</span>
                                </>
                              ) : order.type === 'preventive' ? (
                                <>
                                  <CalendarDays className="h-4 w-4 text-blue-500" />
                                  <span>Preventivo</span>
                                </>
                              ) : (
                                <span>{order.type}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{order.technician}</p>
                              {order.priority && (
                                <div className="mt-1">
                                  {getPriorityBadge(order.priority)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(order.date)}</TableCell>
                          <TableCell>
                            {order.labor_hours ? `${order.labor_hours}h` : 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(order.total_cost)}
                          </TableCell>
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
                                {order.asset_id && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/activos/${order.asset_id}`}>
                                      <FileText className="mr-2 h-4 w-4" />
                                      Ver Activo
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }