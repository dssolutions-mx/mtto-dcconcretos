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
  AlertTriangle, Wrench, CalendarDays, ShoppingCart, Package, FileCheck, X, PlusCircle,
  Clock, DollarSign, TrendingUp
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { 
  PurchaseOrder, 
  PurchaseOrderStatus, 
  Profile,
  WorkOrder
} from "@/types"
import { PurchaseOrderType, EnhancedPOStatus } from "@/types/purchase-orders"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"

interface PurchaseOrderWithWorkOrder extends PurchaseOrder {
  work_orders?: {
    id: string;
    order_id: string;
    description: string;
    asset_id: string | null;
  } | null;
  is_adjustment?: boolean | null;
  original_purchase_order_id?: string;
  // Enhanced purchase order fields
  po_type?: string;
  payment_method?: string;
  requires_quote?: boolean;
  store_location?: string;
  service_provider?: string;
  actual_amount?: number | null;
  purchased_at?: string;
  // receipt_url?: string; // Deprecated - now using purchase_order_receipts table
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

// Helper function to get work order from purchase order
function getWorkOrder(order: PurchaseOrderWithWorkOrder) {
  return order.work_orders;
}

// Helper function to determine if this is an enhanced purchase order
function isEnhancedPurchaseOrder(order: PurchaseOrderWithWorkOrder): boolean {
  return Boolean(order.po_type)
}

// Helper function to get enhanced status info
function getEnhancedStatusConfig(status: string, poType?: string) {
  const isEnhanced = Boolean(poType)
  
  if (!isEnhanced) {
    // Legacy status handling
    return getStatusVariant(status)
  }

  // Enhanced status handling
  switch (status) {
    case EnhancedPOStatus.DRAFT:
      return "outline"
    case EnhancedPOStatus.PENDING_APPROVAL:
      return "default"
    case EnhancedPOStatus.APPROVED:
      return "secondary"
    case EnhancedPOStatus.PURCHASED:
      return "default"
    case EnhancedPOStatus.RECEIPT_UPLOADED:
      return "secondary"
    case EnhancedPOStatus.VALIDATED:
      return "secondary"
    case EnhancedPOStatus.QUOTED:
      return "outline"
    case EnhancedPOStatus.ORDERED:
      return "default"
    case EnhancedPOStatus.RECEIVED:
      return "default"
    case EnhancedPOStatus.INVOICED:
      return "secondary"
    case EnhancedPOStatus.REJECTED:
      return "destructive"
    default:
      return "outline"
  }
}

// Helper function to get action buttons for enhanced orders
function getEnhancedActionButtons(order: PurchaseOrderWithWorkOrder) {
  if (!order.po_type) return null

  const actions = []

  // Common actions for all enhanced orders
  actions.push(
    <Button key="view" variant="outline" size="sm" asChild className="flex-1">
      <Link href={`/compras/${order.id}`}>
        <Eye className="h-4 w-4 mr-1" />
        Ver
      </Link>
    </Button>
  )

  // Status-specific actions for enhanced orders
  switch (order.status) {
    case EnhancedPOStatus.DRAFT:
      actions.push(
        <Button key="edit" variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/compras/${order.id}`}>
            <Edit className="h-4 w-4 mr-1" />
            Completar
          </Link>
        </Button>
      )
      break

    case EnhancedPOStatus.PENDING_APPROVAL:
      actions.push(
        <Button key="approve" variant="default" size="sm" asChild className="flex-1">
          <Link href={`/compras/${order.id}#workflow-actions`}>
            <Check className="h-4 w-4 mr-1" />
            Aprobar
          </Link>
        </Button>
      )
      break

    case EnhancedPOStatus.APPROVED:
      const actionLabel = order.po_type === PurchaseOrderType.DIRECT_PURCHASE ? "Comprar" :
                          order.po_type === PurchaseOrderType.DIRECT_SERVICE ? "Contratar" : 
                          "Pedir"
      actions.push(
        <Button key="purchase" variant="default" size="sm" asChild className="flex-1">
          <Link href={`/compras/${order.id}#workflow-actions`}>
            <ShoppingCart className="h-4 w-4 mr-1" />
            {actionLabel}
          </Link>
        </Button>
      )
      break

    case EnhancedPOStatus.PURCHASED:
    case EnhancedPOStatus.ORDERED:
    case EnhancedPOStatus.RECEIVED:
      actions.push(
        <Button key="receipt" variant="default" size="sm" asChild className="flex-1">
          <Link href={`/compras/${order.id}#receipt-section`}>
            <FileCheck className="h-4 w-4 mr-1" />
            Subir Comprobante
          </Link>
        </Button>
      )
      break

    case EnhancedPOStatus.RECEIPT_UPLOADED:
      actions.push(
        <Button key="validate" variant="default" size="sm" asChild className="flex-1">
          <Link href={`/compras/${order.id}#workflow-actions`}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Validar
          </Link>
        </Button>
      )
      break
  }

  return actions
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
        
        // Load purchase orders first
        const { data: purchaseOrdersData, error } = await supabase
          .from("purchase_orders")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error al cargar órdenes de compra:", error)
          throw error
        }
        
        // Get work order IDs from purchase orders
        const workOrderIds = purchaseOrdersData
          ?.filter(po => po.work_order_id)
          .map(po => po.work_order_id)
          .filter((id): id is string => id !== null) || []
        
        // Load work orders if there are any to load
        let workOrdersMap: Record<string, any> = {}
        if (workOrderIds.length > 0) {
          const { data: workOrdersData, error: workOrdersError } = await supabase
            .from("work_orders")
            .select(`
              id,
              order_id,
              description,
              asset_id
            `)
            .in("id", workOrderIds)
            
          if (workOrdersError) {
            console.error("Error al cargar órdenes de trabajo:", workOrdersError)
          } else if (workOrdersData) {
            workOrdersData.forEach(wo => {
              workOrdersMap[wo.id] = wo
            })
          }
        }
        
        // Merge the data
        const ordersWithWorkOrders = purchaseOrdersData.map(po => ({
          ...po,
          work_orders: po.work_order_id ? workOrdersMap[po.work_order_id] : null
        }))
        
        setOrders(ordersWithWorkOrders as PurchaseOrderWithWorkOrder[])

      } catch (error) {
        console.error("Error al cargar órdenes de compra:", error)
        setOrders([]) 
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  // Calculate summary metrics
  const summaryMetrics = {
    pending: orders.filter(o => o.status === PurchaseOrderStatus.Pending && !o.is_adjustment).length,
    approved: orders.filter(o => o.status === PurchaseOrderStatus.Approved && !o.is_adjustment).length,
    ordered: orders.filter(o => o.status === PurchaseOrderStatus.Ordered && !o.is_adjustment).length,
    adjustments: orders.filter(o => o.is_adjustment).length,
    totalPendingValue: orders
      .filter(o => o.status === PurchaseOrderStatus.Pending && !o.is_adjustment)
      .reduce((sum, o) => sum + (parseFloat(o.total_amount || '0')), 0),
    totalMonthValue: orders
      .filter(o => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        const now = new Date();
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + (parseFloat(o.total_amount || '0')), 0)
  }

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
    (order) => {
      const workOrder = getWorkOrder(order);
      return (
        (order.order_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (order.supplier?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (workOrder?.order_id?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (workOrder?.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
      );
    }
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={summaryMetrics.pending > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pendientes Aprobación
            </CardTitle>
            <Clock className={`h-4 w-4 ${summaryMetrics.pending > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryMetrics.pending}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor: {formatCurrency(summaryMetrics.totalPendingValue.toString())}
            </p>
            {summaryMetrics.pending > 0 && (
              <div className="mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setActiveTab("pending")}
                  className="text-yellow-700 hover:text-yellow-800"
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Revisar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Listas para Pedido
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryMetrics.approved}
            </div>
            <p className="text-xs text-muted-foreground">
              Aprobadas y esperando pedido
            </p>
            {summaryMetrics.approved > 0 && (
              <div className="mt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setActiveTab("approved")}
                  className="text-green-700 hover:text-green-800"
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  Ver
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              En Proceso
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryMetrics.ordered}
            </div>
            <p className="text-xs text-muted-foreground">
              Pedidas, esperando recepción
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor del Mes
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summaryMetrics.totalMonthValue.toString())}
            </div>
            <p className="text-xs text-muted-foreground">
              Total órdenes este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {summaryMetrics.pending > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-800">
                    Hay {summaryMetrics.pending} orden{summaryMetrics.pending !== 1 ? 'es' : ''} pendiente{summaryMetrics.pending !== 1 ? 's' : ''} de aprobación
                  </p>
                  <p className="text-sm text-orange-700">
                    Valor total: {formatCurrency(summaryMetrics.totalPendingValue.toString())}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setActiveTab("pending")}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Clock className="h-4 w-4 mr-2" />
                Aprobar Órdenes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table */}
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
              <TabsTrigger value="pending" className="relative">
                Pendientes
                {summaryMetrics.pending > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white">
                    {summaryMetrics.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="relative">
                Aprobadas
                {summaryMetrics.approved > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    {summaryMetrics.approved}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="ordered">Pedidas</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
              <TabsTrigger value="adjustments" className="relative">
                Ajustes
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                  {summaryMetrics.adjustments}
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
      </Card>
    </div>
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

  // Mobile Card Component
  const PurchaseOrderCard = ({ order }: { order: PurchaseOrderWithWorkOrder }) => {
    const workOrder = getWorkOrder(order);
    const isEnhanced = isEnhancedPurchaseOrder(order)
    const enhancedActions = isEnhanced ? getEnhancedActionButtons(order) : null

    return (
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-lg">{order.order_id}</CardTitle>
              {isEnhanced && order.po_type && (
                <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
              )}
            </div>
            <Badge variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}>
              {order.status || "Pendiente"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Proveedor</p>
            <p className="text-sm">{order.supplier || "No especificado"}</p>
          </div>
          
          {isEnhanced && order.store_location && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tienda</p>
              <p className="text-sm">{order.store_location}</p>
            </div>
          )}
          
          {isEnhanced && order.service_provider && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Proveedor de Servicio</p>
              <p className="text-sm">{order.service_provider}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground">Monto</p>
            <p className="text-sm font-bold">{formatCurrency(order.total_amount?.toString() || "0")}</p>
            {isEnhanced && order.actual_amount && (
              <p className="text-xs text-green-600">
                Real: {formatCurrency(order.actual_amount.toString())}
              </p>
            )}
          </div>

          {workOrder && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Orden de Trabajo</p>
              <p className="text-sm text-blue-600 hover:underline">
                <Link href={`/ordenes/${workOrder.id}`}>
                  {workOrder.order_id}
                </Link>
              </p>
            </div>
          )}

          {isEnhanced && order.payment_method && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Forma de Pago</p>
              <p className="text-sm capitalize">{order.payment_method}</p>
            </div>
          )}

          {isEnhanced && order.requires_quote !== undefined && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Requiere Cotización</p>
              <Badge variant={order.requires_quote ? "default" : "secondary"} className="text-xs">
                {order.requires_quote ? "Sí" : "No"}
              </Badge>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="pt-3">
          <div className="flex gap-2 w-full">
            {isEnhanced && enhancedActions ? (
              enhancedActions
            ) : (
              // Legacy action buttons
              <>
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={`/compras/${order.id}`}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Link>
                </Button>
                
                {/* Legacy quick actions based on status */}
                {order.status === PurchaseOrderStatus.Pending && !order.is_adjustment && (
                  <Button variant="default" size="sm" asChild className="flex-1">
                    <Link href={`/compras/${order.id}/aprobar`}>
                      <Check className="h-4 w-4 mr-1" />
                      Aprobar
                    </Link>
                  </Button>
                )}
                
                {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
                  <Button variant="default" size="sm" asChild className="flex-1">
                    <Link href={`/compras/${order.id}/pedido`}>
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Pedir
                    </Link>
                  </Button>
                )}
                
                {order.status === PurchaseOrderStatus.Ordered && !order.is_adjustment && (
                  <Button variant="default" size="sm" asChild className="flex-1">
                    <Link href={`/compras/${order.id}/recibido`}>
                      <Package className="h-4 w-4 mr-1" />
                      Recibir
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    )
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {orders.map((order) => (
          <PurchaseOrderCard key={order.id} order={order} />
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block rounded-md border">
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
                  {order.work_orders && order.work_orders.order_id ? (
                    <Link href={`/ordenes/${order.work_orders.id}`} className="text-blue-600 hover:underline">
                      {order.work_orders.order_id}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </TableCell>
                <TableCell>{getTechnicianName(order.requested_by)}</TableCell> 
                <TableCell>{formatCurrency(order.total_amount?.toString() || null)}</TableCell>
                <TableCell>
                  <Badge variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}>
                    {order.status || "Pendiente"}
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
                      
                      {/* Enhanced order workflow actions */}
                      {isEnhancedPurchaseOrder(order) ? (
                        <>
                          {order.status === EnhancedPOStatus.PENDING_APPROVAL && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}#workflow-actions`}>
                                <Check className="mr-2 h-4 w-4" />
                                <span>Aprobar</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                          
                          {order.status === EnhancedPOStatus.APPROVED && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}#workflow-actions`}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                <span>
                                  {order.po_type === PurchaseOrderType.DIRECT_PURCHASE ? "Marcar como Comprada" :
                                   order.po_type === PurchaseOrderType.DIRECT_SERVICE ? "Marcar como Contratada" :
                                   "Marcar como Pedida"}
                                </span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                          
                          {(order.status === EnhancedPOStatus.PURCHASED || 
                            order.status === EnhancedPOStatus.ORDERED || 
                            order.status === EnhancedPOStatus.RECEIVED) && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}#receipt-section`}>
                                <FileCheck className="mr-2 h-4 w-4" />
                                <span>Registrar Comprobante</span>
                              </Link>
                            </DropdownMenuItem>
                          )}

                          {order.status === EnhancedPOStatus.RECEIPT_UPLOADED && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}#workflow-actions`}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                <span>Validar</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </>
                      ) : (
                        // Legacy order actions
                        <>
                          {order.status === PurchaseOrderStatus.Pending && !order.is_adjustment && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}/aprobar`}>
                                <Check className="mr-2 h-4 w-4" />
                                <span>Aprobar</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                          
                          {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}/pedido`}>
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                <span>Marcar como Pedida</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                          
                          {order.status === PurchaseOrderStatus.Ordered && !order.is_adjustment && (
                            <DropdownMenuItem asChild>
                              <Link href={`/compras/${order.id}/recibido`}>
                                <Package className="mr-2 h-4 w-4" />
                                <span>Marcar como Recibida</span>
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                      
                      {/* Edit option */}
                      {!order.is_adjustment && (
                        <DropdownMenuItem asChild>
                          <Link href={`/compras/${order.id}/editar`}>
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Editar</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      
                      {/* Register invoice option - works for both enhanced and legacy orders */}
                      {!order.is_adjustment && (
                        <DropdownMenuItem asChild>
                          <Link href={`/compras/${order.id}#receipt-section`}>
                            <FileCheck className="mr-2 h-4 w-4" />
                            <span>Registrar Factura</span>
                          </Link>
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
    </>
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