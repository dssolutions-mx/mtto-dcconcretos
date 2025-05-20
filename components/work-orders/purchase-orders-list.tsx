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
  AlertTriangle, Wrench, CalendarDays, ShoppingCart, Package, FileCheck, X, PlusCircle
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { 
  PurchaseOrder, 
  PurchaseOrderStatus, 
  Profile,
  WorkOrder
} from "@/types"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"

interface PurchaseOrderWithWorkOrder extends PurchaseOrder {
  work_order?: WorkOrder;
  is_adjustment?: boolean;
  original_purchase_order_id?: string;
}

// Helper function to get badge variant based on status
function getStatusVariant(status: string | null) {
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

export function PurchaseOrdersList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [orders, setOrders] = useState<PurchaseOrderWithWorkOrder[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})

  useEffect(() => {
    async function loadOrders() {
      try {
        setIsLoading(true)
        const supabase = createClient()
        
        // Load technicians for names
        const { data: techData, error: techError } = await supabase
          .from("profiles")
          .select("*")
        
        if (techError) {
          console.error("Error al cargar técnicos:", techError)
        } else if (techData) {
          const techMap: Record<string, Profile> = {}
          techData.forEach(tech => {
            techMap[tech.id] = tech
          })
          setTechnicians(techMap)
        }
        
        // Load purchase orders with associated work order
        const { data, error } = await supabase
          .from("purchase_orders")
          .select(`
            *,
            work_order:work_orders (
              id,
              order_id,
              description,
              asset_id
            )
          `)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error al cargar órdenes de compra:", error)
          throw error
        }
        
        setOrders(data as PurchaseOrderWithWorkOrder[])

      } catch (error) {
        console.error("Error al cargar órdenes de compra:", error)
        setOrders([]) 
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  // Filter orders by status tab
  const filteredOrdersByTab = orders.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return order.status === PurchaseOrderStatus.Pending && !order.is_adjustment;
    if (activeTab === "approved") return order.status === PurchaseOrderStatus.Approved && !order.is_adjustment;
    if (activeTab === "ordered") return order.status === PurchaseOrderStatus.Ordered && !order.is_adjustment;
    if (activeTab === "received") return order.status === PurchaseOrderStatus.Received && !order.is_adjustment;
    if (activeTab === "adjustments") return order.is_adjustment === true;
    return true;
  });

  // Filter orders by search term
  const filteredOrders = filteredOrdersByTab.filter(
    (order) =>
      (order.order_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.supplier?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.work_order?.order_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (order.work_order?.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  )

  // Get technician name from ID
  const getTechnicianName = (techId: string | null) => {
    if (!techId) return 'No asignado';
    const tech = technicians[techId];
    if (!tech) return techId;
    return tech.nombre && tech.apellido 
      ? `${tech.nombre} ${tech.apellido}`
      : tech.nombre || techId;
  };

  // Format currency
  const formatCurrency = (amount: string | null) => {
    if (!amount) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por OC, proveedor..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-6">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="ordered">Pedidas</TabsTrigger>
            <TabsTrigger value="received">Recibidas</TabsTrigger>
            <TabsTrigger value="adjustments" className="relative">
              Ajustes
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                {orders.filter(o => o.is_adjustment).length}
              </span>
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "adjustments" && (
            <div className="mb-4 p-3 text-sm bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
              <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-blue-700">
                Los gastos adicionales generan automáticamente órdenes de compra de ajuste que se marcan directamente como recibidas, ya que representan costos ya incurridos que no requieren aprobación ni proceso de compra.
              </p>
            </div>
          )}
          
          <TabsContent value="all" className="mt-0"> 
             <RenderTable 
               orders={filteredOrders} 
               isLoading={isLoading} 
               getTechnicianName={getTechnicianName}
               formatCurrency={formatCurrency}
             />
          </TabsContent>
          <TabsContent value="pending" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
          <TabsContent value="approved" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
          <TabsContent value="ordered" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
          <TabsContent value="received" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
          <TabsContent value="adjustments" className="mt-0">
            <RenderTable 
              orders={filteredOrders} 
              isLoading={isLoading} 
              getTechnicianName={getTechnicianName}
              formatCurrency={formatCurrency}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Mostrando <strong>{filteredOrders.length}</strong> de <strong>{orders.length}</strong> órdenes de compra.
        </div>
      </CardFooter>
    </Card>
  )
}

interface RenderTableProps {
  orders: PurchaseOrderWithWorkOrder[];
  isLoading: boolean;
  getTechnicianName: (techId: string | null) => string;
  formatCurrency: (amount: string | null) => string;
}

function RenderTable({ orders, isLoading, getTechnicianName, formatCurrency }: RenderTableProps) {
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
        <p className="text-center text-muted-foreground">No se encontraron órdenes de compra para esta vista.</p>
        <p className="text-sm text-muted-foreground">Intenta ajustar los filtros o revisa más tarde.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">OC ID</TableHead>
            <TableHead>Proveedor</TableHead>
            <TableHead>OT Relacionada</TableHead>
            <TableHead>Solicitada Por</TableHead>
            <TableHead>Monto Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Entrega Esperada</TableHead>
            <TableHead className="text-right w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow 
              key={order.id}
              className={order.is_adjustment ? "bg-yellow-50/50" : ""}
            >
              <TableCell>
                <Link href={`/compras/${order.id}`} className="font-medium hover:underline">
                  {order.order_id}
                </Link>
                {order.is_adjustment && (
                  <Badge variant="secondary" className="ml-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800">Ajuste</Badge>
                )}
              </TableCell>
              <TableCell>{order.supplier || 'N/A'}</TableCell>
              <TableCell>
                {order.work_order ? (
                  <Link href={`/ordenes/${order.work_order.id}`} className="text-blue-600 hover:underline">
                    {order.work_order.order_id}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>{getTechnicianName(order.requested_by)}</TableCell> 
              <TableCell>{formatCurrency(order.total_amount)}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(order.status)} className="capitalize">
                  {order.status || 'Pendiente'}
                </Badge>
              </TableCell>
              <TableCell>
                {order.expected_delivery_date 
                  ? formatDate(order.expected_delivery_date) 
                  : 'No definida'}
              </TableCell>
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
                      <Link href={`/compras/${order.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        <span>Ver Detalles</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    {/* Only show approve options for pending orders and not adjustments */}
                    {order.status === PurchaseOrderStatus.Pending && !order.is_adjustment && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href={`/compras/${order.id}/aprobar`}>
                            <Check className="mr-2 h-4 w-4" />
                            <span>Aprobar</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/compras/${order.id}/rechazar`}>
                            <X className="mr-2 h-4 w-4" />
                            <span>Rechazar</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    {/* Show mark as ordered option for approved orders and not adjustments */}
                    {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
                      <DropdownMenuItem asChild>
                        <Link href={`/compras/${order.id}/pedido`}>
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          <span>Marcar como Pedida</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
                    {/* Show mark as received option for ordered orders and not adjustments */}
                    {order.status === PurchaseOrderStatus.Ordered && !order.is_adjustment && (
                      <DropdownMenuItem asChild>
                        <Link href={`/compras/${order.id}/recibido`}>
                          <Package className="mr-2 h-4 w-4" />
                          <span>Marcar como Recibida</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
                    {/* No edit option for adjustment orders */}
                    {!order.is_adjustment && (
                      <DropdownMenuItem asChild>
                        <Link href={`/compras/${order.id}/editar`}>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Editar</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    
                    {/* Register invoice option for non-adjustment orders */}
                    {!order.is_adjustment && (
                      <DropdownMenuItem>
                        <FileCheck className="mr-2 h-4 w-4" />
                        <span>Registrar Factura</span>
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    {/* No cancelation option for adjustment orders */}
                    {!order.is_adjustment && (
                      <DropdownMenuItem className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        <Trash className="mr-2 h-4 w-4" />
                        <span>Cancelar OC</span>
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