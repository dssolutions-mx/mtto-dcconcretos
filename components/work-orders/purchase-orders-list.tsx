"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileText, Search, 
  AlertTriangle, Clock, DollarSign, TrendingUp, Package, ShoppingCart,
  Wrench, Building2, Store, Receipt, ExternalLink, Trash2
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { 
  PurchaseOrder, 
  PurchaseOrderStatus, 
  Profile
} from "@/types"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { useIsMobile } from "@/hooks/use-mobile"
import { PurchaseOrdersListMobile } from "./purchase-orders-list-mobile"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface PurchaseOrderWithWorkOrder extends Omit<PurchaseOrder, 'is_adjustment' | 'original_purchase_order_id'> {
  work_orders?: {
    id: string;
    order_id: string;
    description: string;
    asset_id: string | null;
  } | null;
  is_adjustment?: boolean | null;
  original_purchase_order_id?: string;
  po_type?: string;
  payment_method?: string;
  requires_quote?: boolean;
  store_location?: string;
  service_provider?: string;
  actual_amount?: number | null;
  purchased_at?: string;
}

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

function getWorkOrder(order: PurchaseOrderWithWorkOrder) {
  return order.work_orders;
}

function isEnhancedPurchaseOrder(order: PurchaseOrderWithWorkOrder): boolean {
  return !!(order.po_type);
}

function getEnhancedStatusConfig(status: string, poType?: string) {
  if (poType) {
    switch (status) {
      case "Pendiente": return "outline"
      case "Aprobado": return "secondary"
      case "Pedido": return "default"
      case "Recibido": return "default"
      case "Rechazado": return "destructive"
      default: return "outline"
    }
  }
  return getStatusVariant(status)
}

function getPurchaseOrderTypeIcon(poType: string | null) {
  switch (poType) {
    case PurchaseOrderType.DIRECT_SERVICE:
      return Wrench
    case PurchaseOrderType.DIRECT_PURCHASE:
      return ShoppingCart
    default:
      return Package
  }
}

export function PurchaseOrdersList() {
  // All hooks must be called before any conditional returns
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [orders, setOrders] = useState<PurchaseOrderWithWorkOrder[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrderWithWorkOrder | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRefresh = async () => {
    await loadOrders()
  }

  const handleDeleteOrder = (order: PurchaseOrderWithWorkOrder) => {
    setOrderToDelete(order)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!orderToDelete) return

    setIsDeleting(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", orderToDelete.id)

      if (error) throw error

      // Update local state to remove the deleted order
      setOrders(prevOrders => prevOrders.filter(o => o.id !== orderToDelete.id))
      
      toast({
        title: "Orden de compra eliminada",
        description: `La orden ${orderToDelete.order_id} ha sido eliminada exitosamente.`,
      })
    } catch (error) {
      console.error("Error al eliminar orden de compra:", error)
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar la orden de compra. Por favor, intente nuevamente.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setOrderToDelete(null)
    }
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

  useEffect(() => {
    loadOrders()
  }, [])

  // Use mobile-optimized component for mobile devices  
  if (isMobile) {
    return <PurchaseOrdersListMobile />
  }

  // Calculate summary metrics
  const summaryMetrics = {
    pending: orders.filter(o => o.status === PurchaseOrderStatus.Pending && !o.is_adjustment).length,
    approved: orders.filter(o => o.status === PurchaseOrderStatus.Approved && !o.is_adjustment).length,
    ordered: orders.filter(o => o.status === PurchaseOrderStatus.Ordered && !o.is_adjustment).length,
    adjustments: orders.filter(o => o.is_adjustment).length,
    totalPendingValue: orders
      .filter(o => o.status === PurchaseOrderStatus.Pending && !o.is_adjustment)
      .reduce((sum, o) => {
        const amount = typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : (o.total_amount || 0);
        return sum + amount;
      }, 0),
    totalMonthValue: orders
      .filter(o => {
        if (!o.created_at) return false;
        const orderDate = new Date(o.created_at);
        const now = new Date();
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => {
        const amount = typeof o.total_amount === 'string' ? parseFloat(o.total_amount) : (o.total_amount || 0);
        return sum + amount;
      }, 0)
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
  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return '$0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${numAmount.toFixed(2)}`;
  };

  // Format number to currency string
  const formatNumberToCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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
              Valor: {formatNumberToCurrency(summaryMetrics.totalPendingValue)}
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
              {formatNumberToCurrency(summaryMetrics.totalMonthValue)}
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
                    Valor total: {formatNumberToCurrency(summaryMetrics.totalPendingValue)}
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">Todas ({orders.length})</TabsTrigger>
              <TabsTrigger value="pending">Pendientes ({summaryMetrics.pending})</TabsTrigger>
              <TabsTrigger value="approved">Aprobadas ({summaryMetrics.approved})</TabsTrigger>
              <TabsTrigger value="ordered">Pedidas ({summaryMetrics.ordered})</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
              <TabsTrigger value="adjustments">Ajustes ({summaryMetrics.adjustments})</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">OC ID</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Solicitado por</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Cargando órdenes de compra...
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No se encontraron órdenes de compra
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center space-x-2">
                              <span>{order.order_id}</span>
                              {order.is_adjustment && (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                                  Ajuste
                                </Badge>
                              )}
                            </div>
                            {isEnhancedPurchaseOrder(order) && order.po_type && (
                              <div className="mt-1">
                                <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isEnhancedPurchaseOrder(order) && order.service_provider 
                              ? order.service_provider 
                              : order.supplier || "No especificado"}
                          </TableCell>
                          <TableCell>{getTechnicianName(order.requested_by)}</TableCell> 
                          <TableCell className="text-right">
                            {formatCurrency(order.total_amount || "0")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}>
                              {order.status || "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                >
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/compras/${order.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver detalles
                                  </Link>
                                </DropdownMenuItem>
                                
                                {/* Action items based on status */}
                                {order.status === PurchaseOrderStatus.Pending && !order.is_adjustment && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/compras/${order.id}/aprobar`}>
                                      <Check className="mr-2 h-4 w-4" />
                                      Aprobar orden
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                
                                {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/compras/${order.id}/pedido`}>
                                      <ShoppingCart className="mr-2 h-4 w-4" />
                                      Realizar pedido
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                
                                {order.status === PurchaseOrderStatus.Ordered && !order.is_adjustment && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/compras/${order.id}/recibido`}>
                                      <Package className="mr-2 h-4 w-4" />
                                      Marcar como recibido
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteOrder(order)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Eliminar OC
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro que desea eliminar esta orden de compra?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div>
                Esta acción eliminará permanentemente la orden de compra{' '}
                <span className="font-semibold">{orderToDelete?.order_id}</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ ADVERTENCIA: Esta acción también eliminará:
                </div>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>Gastos adicionales asociados a órdenes de ajuste</li>
                  <li>Comprobantes de compra cargados</li>
                  <li>Órdenes de ajuste que referencien a esta orden</li>
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar OC"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 