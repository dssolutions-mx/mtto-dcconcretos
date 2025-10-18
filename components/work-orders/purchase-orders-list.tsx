"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileText, Search, 
  AlertTriangle, Clock, DollarSign, TrendingUp, Package, ShoppingCart,
  Wrench, Building2, Store, Receipt, ExternalLink, Trash2, X, Info, 
  Shield, AlertCircle, Zap, FileCheck, MessageSquare, Calendar as CalendarIcon
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
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { formatCurrency } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"

// Enhanced interface with additional data for authorization decisions
interface PurchaseOrderWithWorkOrder extends Omit<PurchaseOrder, 'is_adjustment' | 'original_purchase_order_id'> {
  work_orders?: {
    id: string;
    order_id: string;
    description: string;
    asset_id: string | null;
    priority: string;
    assets?: {
      id: string;
      name: string;
      asset_id: string;
      plants?: {
        name: string;
      };
    } | null;
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
  requester?: {
    id: string;
    nombre?: string;
    apellido?: string;
    business_units?: { name: string };
    plants?: { name: string };
  };
  items_preview?: string; // Preview of first few items
  urgency_level?: 'low' | 'medium' | 'high' | 'critical';
}

function getStatusVariant(status: string | null) {
  switch (status) {
    case PurchaseOrderStatus.PendingApproval:
      return "outline"
    case PurchaseOrderStatus.Approved:
      return "secondary"
    case PurchaseOrderStatus.Validated:
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

function getUrgencyConfig(urgency?: string, priority?: string) {
  // Determine urgency from work order priority or explicit urgency
  const urgencyLevel = urgency || priority || 'medium'
  
  switch (urgencyLevel.toLowerCase()) {
    case 'critical':
    case 'alta':
    case 'high':
      return { 
        variant: "destructive" as const, 
        icon: AlertCircle, 
        label: "Crítica",
        color: "text-red-600",
        bgColor: "bg-red-50"
      }
    case 'medium':
    case 'media':
      return { 
        variant: "default" as const, 
        icon: Clock, 
        label: "Media",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50"
      }
    case 'low':
    case 'baja':
      return { 
        variant: "secondary" as const, 
        icon: Info, 
        label: "Baja",
        color: "text-green-600",
        bgColor: "bg-green-50"
      }
    default:
      return { 
        variant: "outline" as const, 
        icon: Clock, 
        label: "Normal",
        color: "text-gray-600",
        bgColor: "bg-gray-50"
      }
  }
}

function getItemsPreview(items: any): string {
  if (!items) return "Sin items especificados"
  
  try {
    const itemsArray = typeof items === 'string' ? JSON.parse(items) : items
    if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
      return "Sin items especificados"
    }
    
    const preview = itemsArray.slice(0, 2).map((item: any) => {
      if (typeof item === 'string') return item
      return item.description || item.name || item.item || 'Item'
    }).join(', ')
    
    const moreCount = itemsArray.length - 2
    return moreCount > 0 ? `${preview} y ${moreCount} más` : preview
  } catch {
    return "Items no válidos"
  }
}

export function PurchaseOrdersList() {
  // All hooks must be called before any conditional returns
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const { profile, hasCreateAccess } = useAuthZustand()
  const [searchTerm, setSearchTerm] = useState("")
  const [orders, setOrders] = useState<PurchaseOrderWithWorkOrder[]>([]) 
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const [userAuthLimit, setUserAuthLimit] = useState<number>(0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [selectedAssetId, setSelectedAssetId] = useState<string>("")
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  
  // Enhanced approval functionality state
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [orderToApprove, setOrderToApprove] = useState<PurchaseOrderWithWorkOrder | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve')
  
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrderWithWorkOrder | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load user authorization limit
  useEffect(() => {
    const loadUserAuthLimit = async () => {
      if (!profile?.id) return
      
      try {
        const response = await fetch('/api/authorization/summary')
        const data = await response.json()
        
        // Find user in organization summary
        let userFound = false
        if (data.organization_summary) {
          for (const businessUnit of data.organization_summary) {
            for (const plant of businessUnit.plants) {
              const user = plant.users.find((u: any) => u.user_id === profile.id)
              if (user) {
                const limit = parseFloat(user.effective_global_authorization || 0)
                setUserAuthLimit(limit)
                userFound = true
                break
              }
            }
            if (userFound) break
          }
        }
        
        if (!userFound) {
          setUserAuthLimit(profile.can_authorize_up_to || 0)
        }
      } catch (error) {
        console.error('Error loading user authorization limit:', error)
        setUserAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }

    loadUserAuthLimit()
  }, [profile])

  // Check if user can approve a specific order
  const canApproveOrder = (order: PurchaseOrderWithWorkOrder): boolean => {
    if (!profile || order.status !== PurchaseOrderStatus.PendingApproval || order.is_adjustment) {
      return false
    }
    
    const orderAmount = parseFloat(order.total_amount?.toString() || '0')
    return userAuthLimit > 0 && orderAmount <= userAuthLimit
  }

  // Get authorization status for display
  const getAuthorizationStatus = (order: PurchaseOrderWithWorkOrder) => {
    if (!profile) return { canApprove: false, reason: "No autenticado" }
    
    if (order.status !== PurchaseOrderStatus.PendingApproval) {
      return { canApprove: false, reason: "Ya procesada" }
    }
    
    if (order.is_adjustment) {
      return { canApprove: false, reason: "Es ajuste" }
    }
    
    if (isLoadingAuth) {
      return { canApprove: false, reason: "Cargando..." }
    }
    
    const orderAmount = parseFloat(order.total_amount?.toString() || '0')
    
    if (userAuthLimit === 0) {
      return { canApprove: false, reason: "Sin autorización" }
    }
    
    if (orderAmount > userAuthLimit) {
      return { 
        canApprove: false, 
        reason: `Excede límite (${formatCurrency(userAuthLimit)})` 
      }
    }
    
    return { canApprove: true, reason: "Puede aprobar" }
  }

  // Handle quick approval
  const handleQuickApproval = (order: PurchaseOrderWithWorkOrder, action: 'approve' | 'reject') => {
    setOrderToApprove(order)
    setApprovalAction(action)
    setShowApprovalDialog(true)
  }

  // Confirm approval/rejection
  const confirmApproval = async () => {
    if (!orderToApprove) return

    setIsApproving(true)

    try {
      const newStatus = approvalAction === 'approve' ? 'approved' : 'rejected'
      
      const response = await fetch(`/api/purchase-orders/advance-workflow/${orderToApprove.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_status: newStatus
        })
      })

      const responseData = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (responseData.details) {
          throw new Error(responseData.details)
        }
        throw new Error(responseData.error || responseData.message || 'Error en la aprobación')
      }

      // Update local state
      setOrders(prevOrders => 
        prevOrders.map(o => 
          o.id === orderToApprove.id 
            ? { ...o, status: newStatus === 'approved' ? PurchaseOrderStatus.Approved : PurchaseOrderStatus.Rejected }
            : o
        )
      )
      
      toast({
        title: approvalAction === 'approve' ? "Orden aprobada" : "Orden rechazada",
        description: `La orden ${orderToApprove.order_id} ha sido ${approvalAction === 'approve' ? 'aprobada' : 'rechazada'} exitosamente.`,
      })
      
      setShowApprovalDialog(false)
      setOrderToApprove(null)
    } catch (error) {
      console.error("Error en aprobación:", error)
      toast({
        title: "Error en la aprobación",
        description: error instanceof Error ? error.message : "No se pudo procesar la orden",
        variant: "destructive",
      })
    } finally {
      setIsApproving(false)
    }
  }

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
      
      // Close dialog with proper cleanup
      setIsDeleting(false)
      setShowDeleteDialog(false)
      
      // Reset order state after a brief delay to ensure dialog closes properly
      setTimeout(() => {
        setOrderToDelete(null)
        // Ensure focus returns to document body
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur()
        }
        document.body.focus()
      }, 100)
    } catch (error) {
      console.error("Error al eliminar orden de compra:", error)
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar la orden de compra. Por favor, intente nuevamente.",
        variant: "destructive",
      })
      setIsDeleting(false)
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
      
      // Load purchase orders with basic data first
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
        
      // Load work orders with asset information if there are any to load
      let workOrdersMap: Record<string, any> = {}
      if (workOrderIds.length > 0) {
        const { data: workOrdersData, error: workOrdersError } = await supabase
          .from("work_orders")
          .select(`
            id,
            order_id,
            description,
            asset_id,
            priority,
            assets (
              id,
              name,
              asset_id,
              plants (name)
            )
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
      
      // Merge the data and add preview information
      const ordersWithWorkOrders = purchaseOrdersData.map(po => ({
        ...po,
        work_orders: po.work_order_id ? workOrdersMap[po.work_order_id] : null,
        items_preview: getItemsPreview(po.items)
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

  // Build asset options from loaded orders (unique assets only)
  const assetOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {}
    orders.forEach(o => {
      const asset = o.work_orders?.assets
      if (o.work_orders?.asset_id && asset) {
        const id = o.work_orders.asset_id
        const labelBase = asset.asset_id || asset.name || "Activo"
        const plant = asset.plants?.name ? ` • ${asset.plants.name}` : ""
        map[id] = { id, label: `${labelBase}${plant}` }
      }
    })
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
  }, [orders])

  // Use mobile-optimized component for mobile devices
  if (isMobile) {
    return <PurchaseOrdersListMobile />
  }

  // Calculate summary metrics
  const summaryMetrics = {
    pending: orders.filter(o => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment).length,
    approved: orders.filter(o => o.status === PurchaseOrderStatus.Approved && !o.is_adjustment).length,
    validated: orders.filter(o => o.status === PurchaseOrderStatus.Validated && !o.is_adjustment).length,
    adjustments: orders.filter(o => o.is_adjustment).length,
    totalPendingValue: orders
      .filter(o => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
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
    if (activeTab === "pending") return order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment;
    if (activeTab === "approved") return order.status === PurchaseOrderStatus.Approved && !order.is_adjustment;
    if (activeTab === "validated") return order.status === PurchaseOrderStatus.Validated && !order.is_adjustment;
    if (activeTab === "received") return order.status === PurchaseOrderStatus.Received && !order.is_adjustment;
    if (activeTab === "adjustments") return order.is_adjustment === true;
    return true;
  });

  // Filter orders by asset (when selected)
  const filteredByAsset = filteredOrdersByTab.filter(order => {
    if (!selectedAssetId) return true
    return order.work_orders?.asset_id === selectedAssetId
  })

  // Filter orders by creation date range
  const filteredByDate = filteredByAsset.filter(order => {
    if (!fromDate && !toDate) return true
    if (!order.created_at) return false
    const created = new Date(order.created_at)
    if (Number.isNaN(created.getTime())) return false
    if (fromDate) {
      const start = new Date(fromDate)
      start.setHours(0, 0, 0, 0)
      if (created < start) return false
    }
    if (toDate) {
      const end = new Date(toDate)
      end.setHours(23, 59, 59, 999)
      if (created > end) return false
    }
    return true
  })

  // Filter orders by search term
  const filteredOrders = filteredByDate.filter(
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
              {summaryMetrics.validated}
            </div>
            <p className="text-xs text-muted-foreground">
              Validadas
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
            <div className="w-full md:w-72">
              <Select value={selectedAssetId || "all"} onValueChange={(val) => setSelectedAssetId(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por activo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los activos</SelectItem>
                  {assetOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[30rem] flex flex-col md:flex-row gap-2 md:items-center">
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? fromDate.toLocaleDateString() : "Desde"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? toDate.toLocaleDateString() : "Hasta"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {(fromDate || toDate) && (
                <Button variant="outline" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                  Limpiar
                </Button>
              )}
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">Todas ({orders.length})</TabsTrigger>
              <TabsTrigger value="pending">Pendientes ({summaryMetrics.pending})</TabsTrigger>
              <TabsTrigger value="approved">Aprobadas ({summaryMetrics.approved})</TabsTrigger>
              <TabsTrigger value="validated">Validadas ({summaryMetrics.validated})</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
              <TabsTrigger value="adjustments">Ajustes ({summaryMetrics.adjustments})</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <div className="rounded-md border">
                <TooltipProvider>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Orden</TableHead>
                        <TableHead className="min-w-[250px]">Descripción y Activo</TableHead>
                        <TableHead className="w-[180px]">Proveedor/Solicitante</TableHead>
                        <TableHead className="w-[120px] text-right">Monto</TableHead>
                        <TableHead className="w-[100px]">Urgencia</TableHead>
                        <TableHead className="w-[120px]">Estado</TableHead>
                        <TableHead className="w-[200px] text-center">Autorización</TableHead>
                        <TableHead className="w-[140px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            Cargando órdenes de compra...
                          </TableCell>
                        </TableRow>
                      ) : filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            No se encontraron órdenes de compra
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => {
                          const authStatus = getAuthorizationStatus(order)
                          const workOrder = getWorkOrder(order)
                          const urgencyConfig = getUrgencyConfig(
                            workOrder?.priority, 
                            workOrder?.priority
                          )
                          const UrgencyIcon = urgencyConfig.icon
                          
                          return (
                            <TableRow key={order.id} className="group hover:bg-muted/50">
                              {/* Order ID and Type */}
                              <TableCell className="font-medium">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-sm">{order.order_id}</span>
                                    {order.is_adjustment && (
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">
                                        Ajuste
                                      </Badge>
                                    )}
                                  </div>
                                  {isEnhancedPurchaseOrder(order) && order.po_type && (
                                    <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" />
                                  )}
                                  {workOrder && (
                                    <div className="text-xs text-muted-foreground">
                                      OT: {workOrder.order_id}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {/* Description and Asset */}
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">
                                    {workOrder ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                            {workOrder.description?.length > 50 
                                              ? `${workOrder.description.substring(0, 50)}...` 
                                              : workOrder.description || 'Sin descripción'}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="max-w-xs">{workOrder.description}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      "Orden directa"
                                    )}
                                  </div>
                                  
                                  {workOrder?.assets && (
                                    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                                      <Building2 className="h-3 w-3" />
                                      <span>{workOrder.assets.asset_id || workOrder.assets.name}</span>
                                      {workOrder.assets.plants && (
                                        <span className="text-xs">• {workOrder.assets.plants.name}</span>
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="text-xs text-muted-foreground">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help">
                                          📦 {order.items_preview}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Click "Ver detalles" para ver todos los items</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Provider/Requester */}
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium text-sm">
                                    {isEnhancedPurchaseOrder(order) && order.service_provider 
                                      ? order.service_provider 
                                      : order.supplier || "No especificado"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Solicitado por: {getTechnicianName(order.requested_by)}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Amount */}
                              <TableCell className="text-right">
                                <div className="space-y-1">
                                  <div className="font-semibold">
                                    {formatCurrency(order.total_amount || "0")}
                                  </div>
                                  {order.requires_quote && (
                                    <Badge variant="outline" className="text-xs">
                                      Cotización
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              {/* Urgency */}
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className={`flex items-center space-x-1 p-2 rounded-md ${urgencyConfig.bgColor}`}>
                                      <UrgencyIcon className={`h-3 w-3 ${urgencyConfig.color}`} />
                                      <span className={`text-xs font-medium ${urgencyConfig.color}`}>
                                        {urgencyConfig.label}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Prioridad: {workOrder?.priority || 'Normal'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>

                              {/* Status */}
                              <TableCell>
                                <Badge variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}>
                                  {order.status || "Pendiente"}
                                </Badge>
                              </TableCell>

                              {/* Authorization Column */}
                              <TableCell className="text-center">
                                <div className="space-y-2">
                                  {order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment ? (
                                    authStatus.canApprove ? (
                                      <div className="flex space-x-1">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="default"
                                              className="h-7 px-2 bg-green-600 hover:bg-green-700"
                                              onClick={() => handleQuickApproval(order, 'approve')}
                                            >
                                              <Check className="h-3 w-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Aprobar orden rápidamente</p>
                                          </TooltipContent>
                                        </Tooltip>
                                        
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              className="h-7 px-2"
                                              onClick={() => handleQuickApproval(order, 'reject')}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Rechazar orden</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
                                            <Shield className="h-3 w-3" />
                                            <span>No autorizado</span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{authStatus.reason}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    )
                                  ) : (
                                    <div className="text-xs text-muted-foreground">
                                      {order.status === PurchaseOrderStatus.Approved && "✓ Aprobada"}
                                      {order.status === PurchaseOrderStatus.Rejected && "✗ Rechazada"}
                                      {order.status === PurchaseOrderStatus.Validated && "📦 Validada"}
                                      {order.status === PurchaseOrderStatus.Received && "✅ Recibida"}
                                      {order.is_adjustment && "🔧 Ajuste"}
                                    </div>
                                  )}
                                  
                                  {/* Authorization limit indicator */}
                                  {!isLoadingAuth && userAuthLimit > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      Límite: {formatCurrency(userAuthLimit)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  <Button asChild size="sm" variant="outline">
                                    <Link href={`/compras/${order.id}`}>
                                      <Eye className="mr-1 h-3 w-3" />
                                      Detalles
                                    </Link>
                                  </Button>
                                  
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
                                          Ver detalles completos
                                        </Link>
                                      </DropdownMenuItem>
                                      
                                      {order.status === PurchaseOrderStatus.Approved && !order.is_adjustment && (
                                        <DropdownMenuItem asChild>
                                          <Link href={`/compras/${order.id}/pedido`}>
                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                            Realizar pedido
                                          </Link>
                                        </DropdownMenuItem>
                                      )}
                                      
                                      {order.status === PurchaseOrderStatus.Validated && !order.is_adjustment && (
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
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </TooltipProvider>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Approval Confirmation Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalAction === 'approve' ? 'Confirmar Aprobación' : 'Confirmar Rechazo'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {orderToApprove && (
                <div className="space-y-3 mt-4">
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Orden:</span> {orderToApprove.order_id}
                      </div>
                      <div>
                        <span className="font-medium">Monto:</span> {formatCurrency(orderToApprove.total_amount || "0")}
                      </div>
                      <div>
                        <span className="font-medium">Proveedor:</span> {orderToApprove.supplier || "No especificado"}
                      </div>
                      <div>
                        <span className="font-medium">Solicitado por:</span> {getTechnicianName(orderToApprove.requested_by)}
                      </div>
                    </div>
                    
                    {orderToApprove.work_orders && (
                      <Separator />
                    )}
                    
                    {orderToApprove.work_orders && (
                      <div className="space-y-1">
                        <div className="font-medium text-sm">Orden de Trabajo: {orderToApprove.work_orders.order_id}</div>
                        <div className="text-sm text-muted-foreground">{orderToApprove.work_orders.description}</div>
                        {orderToApprove.work_orders.assets && (
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span>{orderToApprove.work_orders.assets.asset_id || orderToApprove.work_orders.assets.name}</span>
                            {orderToApprove.work_orders.assets.plants && (
                              <span className="text-xs">• {orderToApprove.work_orders.assets.plants.name}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="text-sm">
                      <span className="font-medium">Items:</span> {orderToApprove.items_preview}
                    </div>
                  </div>
                  
                  {approvalAction === 'approve' ? (
                    <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-lg">
                      <Check className="h-4 w-4" />
                      <span className="font-medium">
                        ¿Confirmas que quieres aprobar esta orden de compra?
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg">
                      <X className="h-4 w-4" />
                      <span className="font-medium">
                        ¿Confirmas que quieres rechazar esta orden de compra?
                      </span>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Tu límite de autorización: {formatCurrency(userAuthLimit)}
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApproval}
              disabled={isApproving}
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isApproving ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {approvalAction === 'approve' ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Aprobar
                    </>
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Rechazar
                    </>
                  )}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro que desea eliminar esta orden de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la orden de compra{' '}
              <strong>{orderToDelete?.order_id}</strong>.
            </AlertDialogDescription>
            <div className="space-y-3 pt-2">
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
            </div>
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