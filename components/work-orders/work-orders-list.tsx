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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileText, MoreHorizontal, Search, Trash, User, 
  AlertTriangle, Wrench, CalendarDays, ListChecks, Plus, ShoppingCart, Filter
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { WorkOrder, WorkOrderWithAsset, WorkOrderStatus, MaintenanceType, ServiceOrderPriority, Asset, Profile, PurchaseOrderStatus } from "@/types"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

// Dummy example data (can be removed if confident in fetching)
const workOrdersExampleData: WorkOrderWithAsset[] = [
  {
    id: "OT-0001", // This should be the work_order.id (UUID)
    order_id: "OT-0001", // This is the human-readable ID
    asset_id: "asset-uuid-1",
    description: "Mantenimiento preventivo del Generador #1",
    type: MaintenanceType.Preventive,
    requested_by: "user-uuid-requester",
    assigned_to: "user-uuid-technician",
    planned_date: "2024-07-15T09:00:00Z",
    estimated_duration: 4,
    priority: ServiceOrderPriority.Medium,
    status: WorkOrderStatus.Pending,
    required_parts: null,
    estimated_cost: "150.00",
    checklist_id: "chk-uuid-preventive-gen1",
    maintenance_plan_id: "plan-uuid-gen1-preventive",
    issue_items: null,
    purchase_order_id: null,
    approval_status: null,
    approved_by: null,
    approval_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    asset: { 
      id: "asset-uuid-1",
      asset_id: "GEN-001",
      name: "Generador Principal #1",
      model_id: "model-uuid-xyz",
      serial_number: "SN12345",
      location: "Sala de Máquinas",
      department: "Operaciones",
      purchase_date: "2020-01-15T00:00:00Z",
      installation_date: "2020-02-01T00:00:00Z",
      initial_hours: 0,
      current_hours: 1250,
      initial_kilometers: 0,
      current_kilometers: 0,
      status: "operational",
      notes: "Funciona correctamente.",
      warranty_expiration: "2025-01-15T00:00:00Z",
      is_new: false,
      purchase_cost: "25000.00",
      registration_info: "REG-GEN-001",
      insurance_policy: "POL-INS-001",
      insurance_start_date: "2024-01-01T00:00:00Z",
      insurance_end_date: "2025-01-01T00:00:00Z",
      photos: [],
      insurance_documents: [],
      last_maintenance_date: "2024-06-01T00:00:00Z",
      created_by: "user-uuid-admin",
      created_at: new Date().toISOString(), // Added missing fields for Asset type
      updated_at: new Date().toISOString(), // Added missing fields for Asset type
    } as Asset // Type assertion for the nested asset
  },
];

function getPriorityVariant(priority: string | null) {
  switch (priority) {
    case ServiceOrderPriority.Critical:
      return "destructive"
    case ServiceOrderPriority.High:
      return "secondary" 
    default:
      return "outline"
  }
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case WorkOrderStatus.Completed:
      return "default" 
    case WorkOrderStatus.InProgress:
      return "secondary" 
    case WorkOrderStatus.Pending:
    case WorkOrderStatus.Quoted:
    case WorkOrderStatus.Approved:
      return "outline" 
    default:
      return "outline"
  }
}

function getTypeVariant(type: string | null) {
  switch (type) {
    case MaintenanceType.Preventive:
      return "outline"
    case MaintenanceType.Corrective:
      return "destructive"
    default:
      return "secondary"
  }
}

// Función para obtener la variante del badge para estados de OC
function getPurchaseOrderStatusVariant(status: string | null) {
  switch (status) {
    case PurchaseOrderStatus.Pending:
      return "outline"
    case PurchaseOrderStatus.Approved:
      return "secondary"
    case PurchaseOrderStatus.Ordered:
      return "default"
    case PurchaseOrderStatus.Received:
      return "default"
    case PurchaseOrderStatus.Rejected:
      return "destructive"
    default:
      return "outline"
  }
}

// Función para obtener el color personalizado para estados de OC
function getPurchaseOrderStatusClass(status: string | null) {
  switch (status) {
    case PurchaseOrderStatus.Pending:
      return "bg-yellow-50 text-yellow-800"
    case PurchaseOrderStatus.Approved:
      return "bg-blue-50 text-blue-800"
    case PurchaseOrderStatus.Ordered:
      return "bg-indigo-50 text-indigo-800"
    case PurchaseOrderStatus.Received:
      return "bg-green-100 text-green-800"
    case PurchaseOrderStatus.Rejected:
      return "bg-red-50 text-red-800"
    default:
      return ""
  }
}

export function WorkOrdersList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [workOrders, setWorkOrders] = useState<WorkOrderWithAsset[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const [purchaseOrderStatuses, setPurchaseOrderStatuses] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadWorkOrders() {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        // First, load all technicians to get their names
        const { data: techData, error: techError } = await supabase
          .from("profiles")
          .select("*")
        
        if (techError) {
          console.error("Error al cargar técnicos:", techError)
        } else if (techData) {
          // Create a map of technician IDs to technician data
          const techMap: Record<string, Profile> = {}
          techData.forEach(tech => {
            techMap[tech.id] = tech
          })
          setTechnicians(techMap)
        }
        
        const { data, error } = await supabase
          .from("work_orders")
          .select(`
            *,
            asset:assets (
              id,
              name,
              asset_id
            )
          `)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error al cargar órdenes de trabajo:", error)
          throw error
        }

        // Supabase data should already match WorkOrderWithAsset if select is correct
        setWorkOrders(data as WorkOrderWithAsset[]); 

        // Get all purchase orders statuses for the work orders that have purchase_order_id
        // Create a list of purchase order IDs
        const poIds = [] as string[];
        
        // Only add non-null purchase order IDs
        for (const order of data) {
          if (typeof order.purchase_order_id === 'string') {
            poIds.push(order.purchase_order_id);
          }
        }
        
        // If we have any purchase order IDs, fetch their statuses
        if (poIds.length > 0) {
          const { data: poData, error: poError } = await supabase
            .from("purchase_orders")
            .select("id, status")
            .in("id", poIds)
            
          if (poError) {
            console.error("Error al cargar estados de órdenes de compra:", poError)
          } else if (poData) {
            const statusMap: Record<string, string> = {}
            poData.forEach(po => {
              statusMap[po.id] = po.status
            })
            setPurchaseOrderStatuses(statusMap)
          }
        }

      } catch (error) {
        console.error("Error al cargar órdenes de trabajo:", error)
        setWorkOrders([]) 
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkOrders()
  }, [])

  const filteredOrdersByTab = workOrders.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return order.status === WorkOrderStatus.Pending || order.status === WorkOrderStatus.Quoted;
    if (activeTab === "approved") return order.status === WorkOrderStatus.Approved;
    if (activeTab === "inprogress") return order.status === WorkOrderStatus.InProgress;
    if (activeTab === "completed") return order.status === WorkOrderStatus.Completed;
    return true;
  }).filter(order => {
    // Type filtering
    if (typeFilter === "all") return true;
    if (typeFilter === "preventive") return order.type === MaintenanceType.Preventive;
    if (typeFilter === "corrective") return order.type === MaintenanceType.Corrective;
    return true;
  });

  const filteredOrders = filteredOrdersByTab.filter(
    (order) =>
      (order.asset?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.order_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
      (order.assigned_to && technicians[order.assigned_to]?.nombre?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  // Function to get technician name
  const getTechnicianName = (techId: string | null) => {
    if (!techId) return 'No asignado';
    const tech = technicians[techId];
    if (!tech) return techId;
    return tech.nombre && tech.apellido 
      ? `${tech.nombre} ${tech.apellido}`
      : tech.nombre || techId;
  };

  // Function to get purchase order status
  const getPurchaseOrderStatus = (poId: string | null) => {
    if (!poId) return null;
    return purchaseOrderStatuses[poId] || null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Órdenes de Trabajo</CardTitle>
          <div className="flex flex-col md:flex-row items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
                placeholder="Buscar OT, activo, asignado..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="preventive">Preventivos</SelectItem>
                <SelectItem value="corrective">Correctivos</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/ordenes/crear">
                <Plus className="mr-2 h-4 w-4" /> Nueva OT
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="inprogress">En Progreso</TabsTrigger>
            <TabsTrigger value="completed">Completadas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-0"> 
             <RenderTable 
               orders={filteredOrders} 
               isLoading={isLoading} 
               getTechnicianName={getTechnicianName}
               getPurchaseOrderStatus={getPurchaseOrderStatus}
             />
          </TabsContent>
          <TabsContent value="pending" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              getPurchaseOrderStatus={getPurchaseOrderStatus}
            />
          </TabsContent>
          <TabsContent value="approved" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              getPurchaseOrderStatus={getPurchaseOrderStatus}
            />
          </TabsContent>
          <TabsContent value="inprogress" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              getPurchaseOrderStatus={getPurchaseOrderStatus}
            />
          </TabsContent>
          <TabsContent value="completed" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              getPurchaseOrderStatus={getPurchaseOrderStatus}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{filteredOrders.length}</strong> de <strong>{workOrders.length}</strong> órdenes de trabajo.
        </div>
      </CardFooter>
    </Card>
  )
}

interface RenderTableProps {
  orders: WorkOrderWithAsset[];
  isLoading: boolean;
  getTechnicianName: (techId: string | null) => string;
  getPurchaseOrderStatus: (poId: string | null) => string | null;
}

function RenderTable({ orders, isLoading, getTechnicianName, getPurchaseOrderStatus }: RenderTableProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Cargando órdenes...</span>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">No se encontraron órdenes de trabajo para esta vista.</p>
        <p className="text-sm text-muted-foreground">Intenta ajustar los filtros o revisa más tarde.</p>
      </div>
    );
  }
  return (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
            <TableHead className="w-[100px]">OT ID</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
            <TableHead>OC</TableHead>
            <TableHead>Fecha Planificada</TableHead>
            <TableHead>Asignado A</TableHead>
            <TableHead className="text-right w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">{order.order_id}</TableCell>
              <TableCell>
                {order.asset?.name || 'N/A'} 
                {order.asset?.asset_id && <span className="text-xs text-muted-foreground ml-1">({order.asset.asset_id})</span>}
                        </TableCell>
                        <TableCell>
                <Badge variant={getTypeVariant(order.type)} className="capitalize">
                  {order.type || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                <Badge variant={getPriorityVariant(order.priority)} className="capitalize">
                  {order.priority || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                <Badge variant={getStatusVariant(order.status)} className="capitalize">
                  {order.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                {order.purchase_order_id ? (
                  <Badge 
                    variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))} 
                    className={getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id))}
                  >
                    {getPurchaseOrderStatus(order.purchase_order_id) || 'OC Generada'}
                  </Badge>
                ) : (
                  order.type === MaintenanceType.Preventive && order.required_parts ? (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800">Pendiente</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )
                )}
                        </TableCell>
              <TableCell>{order.planned_date ? formatDate(order.planned_date) : 'No planificada'}</TableCell>
              <TableCell>{getTechnicianName(order.assigned_to)}</TableCell> 
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Abrir menú</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/ordenes/${order.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                        <span>Ver Detalles</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                       <Link href={`/ordenes/${order.id}/editar`}> 
                        <Edit className="mr-2 h-4 w-4" />
                        <span>Editar OT</span>
                      </Link>
                    </DropdownMenuItem>
                    {!order.purchase_order_id && order.required_parts && (
                      <DropdownMenuItem asChild>
                        <Link href={`/ordenes/${order.id}/generar-oc`}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          <span>Generar OC</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {order.purchase_order_id && (
                      <DropdownMenuItem asChild>
                        <Link href={`/compras/${order.purchase_order_id}`}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          <span>Ver OC</span>
                                </Link>
                              </DropdownMenuItem>
                    )}
                              <DropdownMenuItem>
                      <ListChecks className="mr-2 h-4 w-4" />
                      <span>Ver Checklist</span> 
                    </DropdownMenuItem>
                    {order.status !== WorkOrderStatus.Completed && (
                      <DropdownMenuItem asChild>
                        <Link href={`/ordenes/${order.id}/completar`}>
                          <Wrench className="mr-2 h-4 w-4" />
                          <span>Registrar Mantenimiento</span>
                        </Link>
                              </DropdownMenuItem>
                    )}
                              <DropdownMenuItem>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      <span>Re-Programar</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                      <span>Cambiar Estado</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 hover:bg-red-50 hover:text-red-700">
                                <Trash className="mr-2 h-4 w-4" />
                      <span>Cancelar OT</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
  )
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A"
  try {
  const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return dateString; 
    }
    return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch (error) {
    console.warn("Error formatting date:", dateString, error);
    return dateString; 
  }
}
