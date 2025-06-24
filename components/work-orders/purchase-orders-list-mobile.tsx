"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileCheck, Search, 
  AlertTriangle, Wrench, ShoppingCart, Package, 
  Clock, DollarSign, TrendingUp, Store, Building2, Receipt, ExternalLink
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { 
  PurchaseOrder, 
  PurchaseOrderStatus, 
  Profile
} from "@/types"
import { PurchaseOrderType, EnhancedPOStatus } from "@/types/purchase-orders"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { useIsMobile } from "@/hooks/use-mobile"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { cn } from "@/lib/utils"

interface PurchaseOrderWithWorkOrder extends Omit<PurchaseOrder, 'is_adjustment'> {
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
}

// Helper function to get purchase order type icon
function getPurchaseOrderTypeIcon(poType: string | null) {
  switch (poType) {
    case PurchaseOrderType.DIRECT_PURCHASE:
      return Store
    case PurchaseOrderType.DIRECT_SERVICE:
      return Wrench
    case PurchaseOrderType.SPECIAL_ORDER:
      return Building2
    default:
      return ShoppingCart
  }
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

// Helper function to get enhanced status info
function getEnhancedStatusConfig(status: string, poType?: string) {
  const isEnhanced = Boolean(poType)
  
  if (!isEnhanced) {
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
    case EnhancedPOStatus.REJECTED:
      return "destructive"
    default:
      return "outline"
  }
}

// Helper function to determine if this is an enhanced purchase order
function isEnhancedPurchaseOrder(order: PurchaseOrderWithWorkOrder): boolean {
  return Boolean(order.po_type)
}

// Helper function to get work order from purchase order
function getWorkOrder(order: PurchaseOrderWithWorkOrder) {
  return order.work_orders;
}

// Mobile-Optimized Purchase Order Card Component
function PurchaseOrderCard({ 
  order, 
  getTechnicianName, 
  formatCurrency 
}: { 
  order: PurchaseOrderWithWorkOrder
  getTechnicianName: (techId: string | null) => string
  formatCurrency: (amount: string | null) => string
}) {
  const workOrder = getWorkOrder(order);
  const isEnhanced = isEnhancedPurchaseOrder(order)
  const TypeIcon = getPurchaseOrderTypeIcon(order.po_type)

  return (
    <Card className="w-full h-fit hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg font-bold truncate">{order.order_id}</CardTitle>
              {order.is_adjustment && (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                  Ajuste
                </Badge>
              )}
            </div>
            
            {/* Type Badge and Icon */}
            <div className="flex items-center space-x-2">
              {isEnhanced && order.po_type ? (
                <>
                  <div className="p-1 rounded-md bg-blue-100">
                    <TypeIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
                </>
              ) : (
                <div className="p-1 rounded-md bg-gray-100">
                  <ShoppingCart className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          </div>
          
          <Badge 
            variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}
            className="ml-2 shrink-0"
          >
            {order.status || "Pendiente"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Supplier/Provider */}
        <div>
          <div className="flex items-center space-x-1 mb-1">
            <Building2 className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              {isEnhanced && order.po_type === PurchaseOrderType.DIRECT_SERVICE 
                ? "Proveedor de Servicio" 
                : "Proveedor"}
            </p>
          </div>
          <p className="text-sm font-medium truncate">
            {isEnhanced && order.service_provider 
              ? order.service_provider 
              : order.supplier || "No especificado"}
          </p>
        </div>

        {/* Store Location for Direct Purchase */}
        {isEnhanced && order.store_location && (
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Store className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Tienda</p>
            </div>
            <p className="text-sm truncate">{order.store_location}</p>
          </div>
        )}

        {/* Amount */}
        <div>
          <div className="flex items-center space-x-1 mb-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">Monto</p>
          </div>
          <div className="flex items-baseline space-x-2">
            <p className="text-lg font-bold text-primary">
              {formatCurrency(order.total_amount?.toString() || "0")}
            </p>
            {isEnhanced && order.actual_amount && (
              <p className="text-xs text-green-600 font-medium">
                Real: {formatCurrency(order.actual_amount.toString())}
              </p>
            )}
          </div>
        </div>

        {/* Work Order Link */}
        {workOrder && (
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Wrench className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Orden de Trabajo</p>
            </div>
            <Link 
              href={`/ordenes/${workOrder.id}`}
              className="text-sm text-blue-600 hover:underline flex items-center space-x-1"
            >
              <span>{workOrder.order_id}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Payment Method for Enhanced Orders */}
        {isEnhanced && order.payment_method && (
          <div>
            <div className="flex items-center space-x-1 mb-1">
              <Receipt className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Forma de Pago</p>
            </div>
            <p className="text-sm capitalize">{order.payment_method}</p>
          </div>
        )}

        {/* Quote Requirements */}
        {isEnhanced && order.requires_quote !== undefined && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Requiere Cotización</p>
            <Badge 
              variant={order.requires_quote ? "default" : "secondary"} 
              className="text-xs"
            >
              {order.requires_quote ? "Sí" : "No"}
            </Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-3">
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={`/compras/${order.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Ver
            </Link>
          </Button>
          
          {/* Contextual action button based on status */}
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
        </div>
      </CardFooter>
    </Card>
  )
}

// Mobile View Component
function MobileView({ 
  orders, 
  isLoading, 
  getTechnicianName, 
  formatCurrency 
}: { 
  orders: PurchaseOrderWithWorkOrder[]
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  formatCurrency: (amount: string | null) => string
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-48 animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay órdenes de compra</h3>
          <p className="text-muted-foreground">
            Las órdenes de compra aparecerán aquí una vez que se generen.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <PurchaseOrderCard 
          key={order.id} 
          order={order}
          getTechnicianName={getTechnicianName}
          formatCurrency={formatCurrency}
        />
      ))}
    </div>
  )
}

// Main Component
export function PurchaseOrdersListMobile() {
  const [searchTerm, setSearchTerm] = useState("")
  const [orders, setOrders] = useState<PurchaseOrderWithWorkOrder[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const isMobile = useIsMobile()

  const handleRefresh = async () => {
    await loadOrders()
  }

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
      
      // Load work orders if any exist
      const workOrdersMap: Record<string, any> = {}
      if (workOrderIds && workOrderIds.length > 0) {
        const { data: workOrdersData, error: workOrderError } = await supabase
          .from("work_orders")
          .select("id, order_id, description, asset_id")
          .in("id", workOrderIds)
        
        if (workOrderError) {
          console.error("Error al cargar órdenes de trabajo:", workOrderError)
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

  useEffect(() => {
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
    <PullToRefresh onRefresh={handleRefresh}>
      <Card>
        <CardHeader className={cn(isMobile && "px-4")}>
          <div className="flex flex-col space-y-4">
            {/* Summary Metrics - Mobile Optimized */}
            {isMobile ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-2xl font-bold text-yellow-700">{summaryMetrics.pending}</p>
                  <p className="text-xs text-yellow-600">Pendientes</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-700">{summaryMetrics.approved}</p>
                  <p className="text-xs text-green-600">Aprobadas</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-2xl font-bold text-blue-700">{summaryMetrics.ordered}</p>
                  <p className="text-xs text-blue-600">En Proceso</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-lg font-bold text-purple-700">{formatCurrency(summaryMetrics.totalMonthValue.toString())}</p>
                  <p className="text-xs text-purple-600">Total Mes</p>
                </div>
              </div>
            ) : (
              // Desktop metrics layout
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className={summaryMetrics.pending > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                    <Clock className={`h-4 w-4 ${summaryMetrics.pending > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summaryMetrics.pending}</div>
                    <p className="text-xs text-muted-foreground">
                      Valor: {formatCurrency(summaryMetrics.totalPendingValue.toString())}
                    </p>
                  </CardContent>
                </Card>
                {/* Add other desktop metric cards here */}
              </div>
            )}

            {/* Search Bar */}
            <div className="relative">
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
        </CardHeader>

        <CardContent className={cn(isMobile && "px-4")}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Mobile-Optimized Tabs */}
            {isMobile ? (
              <div className="space-y-2 mb-4">
                {/* Primary Tabs - 2x2 grid */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={activeTab === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("all")}
                    className="relative h-12"
                  >
                    <div className="text-center">
                      <div className="font-medium">Todas</div>
                      <div className="text-xs opacity-75">{orders.length}</div>
                    </div>
                  </Button>
                  <Button
                    variant={activeTab === "pending" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("pending")}
                    className="relative h-12"
                  >
                    <div className="text-center">
                      <div className="font-medium">Pendientes</div>
                      <div className="text-xs opacity-75">{summaryMetrics.pending}</div>
                    </div>
                    {summaryMetrics.pending > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white">
                        {summaryMetrics.pending}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeTab === "approved" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("approved")}
                    className="relative h-12"
                  >
                    <div className="text-center">
                      <div className="font-medium">Aprobadas</div>
                      <div className="text-xs opacity-75">{summaryMetrics.approved}</div>
                    </div>
                    {summaryMetrics.approved > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        {summaryMetrics.approved}
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeTab === "ordered" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("ordered")}
                    className="relative h-12"
                  >
                    <div className="text-center">
                      <div className="font-medium">En Proceso</div>
                      <div className="text-xs opacity-75">{summaryMetrics.ordered}</div>
                    </div>
                  </Button>
                </div>
                
                {/* Secondary Tabs - Row */}
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === "received" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("received")}
                    className="flex-1"
                  >
                    Recibidas
                  </Button>
                  <Button
                    variant={activeTab === "adjustments" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveTab("adjustments")}
                    className="flex-1 relative"
                  >
                    Ajustes
                    {summaryMetrics.adjustments > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                        {summaryMetrics.adjustments}
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Desktop Tabs */
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
            )}
            
            {/* Tab Content */}
            <TabsContent value="all" className="mt-0"> 
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            
            <TabsContent value="pending" className="mt-0">
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            
            <TabsContent value="approved" className="mt-0">
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            
            <TabsContent value="ordered" className="mt-0">
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            
            <TabsContent value="received" className="mt-0">
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
            
            <TabsContent value="adjustments" className="mt-0">
              <MobileView 
                orders={filteredOrders} 
                isLoading={isLoading} 
                getTechnicianName={getTechnicianName}
                formatCurrency={formatCurrency}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className={cn(isMobile && "px-4")}>
          <div className="text-xs text-muted-foreground">
            Mostrando <strong>{filteredOrders.length}</strong> de <strong>{orders.length}</strong> órdenes de compra.
          </div>
        </CardFooter>
      </Card>
    </PullToRefresh>
  )
} 