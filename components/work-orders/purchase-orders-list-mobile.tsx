"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Check, CheckCircle, Edit, Eye, FileCheck, Search, 
  AlertTriangle, Wrench, ShoppingCart, Package, 
  Clock, DollarSign, TrendingUp, Store, Building2, Receipt, ExternalLink, Trash2, MoreVertical,
  X, Info, Shield, AlertCircle, Zap, MessageSquare, Filter
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { 
  PurchaseOrderStatus, 
  Profile
} from "@/types"
import { PurchaseOrderType, EnhancedPOStatus } from "@/types/purchase-orders"
import { TypeBadge } from "@/components/purchase-orders/shared/TypeBadge"
import { useIsMobile } from "@/hooks/use-mobile"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { cn } from "@/lib/utils"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { formatCurrency } from "@/lib/utils"
import { useComprasData, type PurchaseOrderWithWorkOrder } from "@/components/compras/useComprasData"
import { getWorkOrder, isEnhancedPurchaseOrder, getUrgencyConfig } from "@/components/compras/po-row-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"

import type { ApprovalContextItem } from "@/types/purchase-orders"

// Helper function to preview items
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
    case PurchaseOrderStatus.PendingApproval:
      return "outline"
    case PurchaseOrderStatus.Approved:
      return "secondary"
    case PurchaseOrderStatus.Received:
      return "default"
    case PurchaseOrderStatus.Validated:
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

// Compact Mobile Purchase Order Card (Phase 4 design specs)
function PurchaseOrderCard({ 
  order, 
  getTechnicianName, 
  formatCurrency,
  onDeleteOrder,
  userAuthLimit,
  onQuickApproval,
  onRecordViability,
  approvalContext
}: { 
  order: PurchaseOrderWithWorkOrder
  getTechnicianName: (techId: string | null) => string
  formatCurrency: (amount: string | number | null) => string
  onDeleteOrder: (order: PurchaseOrderWithWorkOrder) => void
  userAuthLimit: number
  onQuickApproval: (order: PurchaseOrderWithWorkOrder, action: 'approve' | 'reject') => void
  onRecordViability?: (order: PurchaseOrderWithWorkOrder) => void
  approvalContext?: ApprovalContextItem | null
}) {
  const router = useRouter()
  const workOrder = getWorkOrder(order)
  const isEnhanced = isEnhancedPurchaseOrder(order)
  const TypeIcon = getPurchaseOrderTypeIcon(order.po_type || null)
  const supplierName = isEnhanced && order.service_provider 
    ? order.service_provider 
    : order.supplier || "No especificado"
  const locationLine = workOrder?.assets 
    ? `${workOrder.assets.asset_id || workOrder.assets.name || ""}${workOrder.assets.plants ? ` • ${workOrder.assets.plants.name}` : ""}`.trim()
    : ""
  const ctx = order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment ? approvalContext : null
  const urgencyConfig = getUrgencyConfig(workOrder?.priority, workOrder?.priority)
  const UrgencyIcon = urgencyConfig.icon

  return (
    <Card className="w-full h-fit rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/compras/${order.id}`)}
        onKeyDown={(e) => e.key === "Enter" && router.push(`/compras/${order.id}`)}
        className="block -m-4 p-4 pb-0"
      >
        {/* Row 1: PO ID | Amount (no status badge for pending—workflow context below replaces it) */}
        <div className="flex items-start justify-between gap-2 mb-2 pr-10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base font-bold text-slate-900 truncate">{order.order_id}</span>
            {order.is_adjustment && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs shrink-0">
                Ajuste
              </Badge>
            )}
            {/* Status badge only for non-pending; pending shows workflow stage instead */}
            {!(order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment) && (
              <Badge 
                variant={getEnhancedStatusConfig(order.status || "Pendiente", order.po_type)}
                className="shrink-0"
              >
                {order.status || "Pendiente"}
              </Badge>
            )}
          </div>
          <p className="text-lg font-semibold text-slate-900 shrink-0">
            {formatCurrency(order.total_amount?.toString() || "0")}
          </p>
        </div>

        {/* Row 2: Workflow stage badge + who's responsible when you cannot act */}
        {ctx ? (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 font-medium',
                ctx.workflowStage === 'Validación técnica' && 'bg-blue-50 text-blue-700 border-blue-200',
                ctx.workflowStage === 'Viabilidad administrativa' && 'bg-amber-50 text-amber-700 border-amber-200',
                ctx.workflowStage === 'Aprobación final' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                !ctx.workflowStage && 'bg-slate-100 text-slate-600 border-slate-200'
              )}
            >
              {ctx.workflowStage || 'Verificando...'}
            </Badge>
            {!(ctx.canApprove || ctx.canRecordViability) && ctx.responsibleRole && (
              <span className="text-xs text-muted-foreground">
                En espera de: {ctx.responsibleRole}
              </span>
            )}
          </div>
        ) : order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment && (
          <div className="mb-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
              Verificando...
            </Badge>
          </div>
        )}

        {/* Row 3: Supplier • Type (compact) */}
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-sm font-medium truncate flex-1 min-w-0">{supplierName}</p>
          {isEnhanced && order.po_type ? (
            <TypeBadge type={order.po_type as PurchaseOrderType} size="sm" className="shrink-0" />
          ) : (
            <div className="p-1 rounded-md bg-gray-100 shrink-0">
              <ShoppingCart className="h-3 w-3 text-gray-600" />
            </div>
          )}
        </div>

        {/* Row 4: Work order link + location */}
        {workOrder && (
          <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); router.push(`/ordenes/${workOrder.id}`); }}
              className="text-sm text-sky-700 hover:underline flex items-center gap-1 truncate min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left font-inherit"
            >
              <span className="truncate">{workOrder.order_id}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </button>
            {locationLine && (
              <span className="text-xs text-muted-foreground truncate">• {locationLine}</span>
            )}
            {workOrder?.priority && urgencyConfig.variant === 'destructive' && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-red-50 text-red-600 shrink-0">
                {urgencyConfig.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Approve / Reject / Record Viability actions - when user can act */}
      {ctx && (ctx.canApprove || ctx.canRecordViability) && (
        <div className="flex gap-2 mt-3 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
          {ctx.canApprove && (
            <>
              <Button
                size="sm"
                className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700"
                onClick={() => onQuickApproval(order, 'approve')}
              >
                <Check className="h-4 w-4 mr-1" />
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 min-h-[44px]"
                onClick={() => onQuickApproval(order, 'reject')}
              >
                <X className="h-4 w-4 mr-1" />
                Rechazar
              </Button>
            </>
          )}
          {ctx.canRecordViability && !ctx.canApprove && onRecordViability && (
            <Button
              size="sm"
              className="flex-1 min-h-[44px] bg-sky-600 hover:bg-sky-700"
              onClick={() => onRecordViability(order)}
            >
              <Shield className="h-4 w-4 mr-1" />
              Registrar viabilidad
            </Button>
          )}
        </div>
      )}

      {/* Menu - positioned top right, outside link area */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 p-0 min-h-[44px] min-w-[44px]" onClick={(e) => e.stopPropagation()}>
              <span className="sr-only">Abrir menú</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem asChild>
                <Link href={`/compras/${order.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </Link>
              </DropdownMenuItem>
              {order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment && ctx?.canApprove && (
                <DropdownMenuItem asChild>
                  <Link href={`/compras/${order.id}/aprobar`}>
                    <Check className="mr-2 h-4 w-4" />
                    Aprobar orden
                  </Link>
                </DropdownMenuItem>
              )}
              {order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment && ctx?.canRecordViability && !ctx?.canApprove && (
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); onRecordViability?.(order); }}>
                  <Shield className="mr-2 h-4 w-4" />
                  Registrar viabilidad
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
              {order.status === PurchaseOrderStatus.Validated && !order.is_adjustment && (
                <DropdownMenuItem asChild>
                  <Link href={`/compras/${order.id}/recibido`}>
                    <Package className="mr-2 h-4 w-4" />
                    Marcar como recibido
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={(e) => { e.preventDefault(); onDeleteOrder(order); }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar OC
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
    </Card>
  )
}

// Mobile View Component
function MobileView({ 
  orders, 
  isLoading, 
  getTechnicianName, 
  formatCurrency,
  onDeleteOrder,
  userAuthLimit,
  onQuickApproval,
  onRecordViability,
  approvalContext
}: { 
  orders: PurchaseOrderWithWorkOrder[]
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  formatCurrency: (amount: string | number | null) => string
  onDeleteOrder: (order: PurchaseOrderWithWorkOrder) => void
  userAuthLimit: number
  onQuickApproval: (order: PurchaseOrderWithWorkOrder, action: 'approve' | 'reject') => void
  onRecordViability?: (order: PurchaseOrderWithWorkOrder) => void
  approvalContext?: Record<string, ApprovalContextItem>
}) {
  if (isLoading) {
    return (
      <div className="space-y-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
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
    <div className="space-y-5">
      {orders.map((order) => (
        <PurchaseOrderCard 
          key={order.id} 
          order={order}
          getTechnicianName={getTechnicianName}
          formatCurrency={formatCurrency}
          onDeleteOrder={onDeleteOrder}
          userAuthLimit={userAuthLimit}
          onQuickApproval={onQuickApproval}
          onRecordViability={onRecordViability}
          approvalContext={approvalContext?.[order.id]}
        />
      ))}
    </div>
  )
}

// Main Component
interface PurchaseOrdersListMobileProps {
  effectiveAuthLimitFromParent?: number
  isLoadingAuthFromParent?: boolean
}

export function PurchaseOrdersListMobile({ effectiveAuthLimitFromParent, isLoadingAuthFromParent }: PurchaseOrdersListMobileProps = {}) {
  const { toast } = useToast()
  const { profile } = useAuthZustand()
  const { orders, setOrders, technicians, approvalContext, isLoading, loadOrders, loadApprovalContext } = useComprasData()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<string>("pending")
  const [userAuthLimit, setUserAuthLimit] = useState<number>(effectiveAuthLimitFromParent ?? 0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(isLoadingAuthFromParent ?? true)
  const isMobile = useIsMobile()
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
  const [filtersOpen, setFiltersOpen] = useState(false)

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

  // Handle quick approval
  const handleQuickApproval = (order: PurchaseOrderWithWorkOrder, action: 'approve' | 'reject') => {
    setOrderToApprove(order)
    setApprovalAction(action)
    setShowApprovalDialog(true)
  }

  // Handle record viability (Administration / GM for paths C, D)
  const handleRecordViability = async (order: PurchaseOrderWithWorkOrder) => {
    setIsApproving(true)
    setOrderToApprove(order)
    setApprovalAction('approve') // reuse state for loading, actual action is validated
    try {
      const res = await fetch(`/api/purchase-orders/advance-workflow/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: 'validated' })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Error al registrar viabilidad')
      }
      setOrders(prev => prev.map(o => 
        o.id === order.id 
          ? { ...o, viability_state: 'viable' as const }
          : o
      ))
      toast({
        title: 'Viabilidad registrada',
        description: `La orden ${order.order_id} tiene viabilidad administrativa registrada.`,
      })
      const pendingIds = orders
        .filter(o => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
        .map(o => o.id)
      await loadApprovalContext(pendingIds)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo registrar viabilidad',
        variant: 'destructive',
      })
    } finally {
      setIsApproving(false)
      setOrderToApprove(null)
    }
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
      const updatedOrders = orders.map(o => 
        o.id === orderToApprove.id 
          ? { ...o, status: newStatus === 'approved' ? PurchaseOrderStatus.Approved : PurchaseOrderStatus.Rejected }
          : o
      )
      setOrders(updatedOrders)
      const pendingIds = updatedOrders
        .filter(o => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
        .map(o => o.id)
      await loadApprovalContext(pendingIds)
      
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

  // Sync parent-provided auth limit; otherwise fetch ourselves
  useEffect(() => {
    if (effectiveAuthLimitFromParent != null) {
      setUserAuthLimit(effectiveAuthLimitFromParent)
      setIsLoadingAuth(isLoadingAuthFromParent ?? false)
      return
    }
  }, [effectiveAuthLimitFromParent, isLoadingAuthFromParent])

  useEffect(() => {
    if (effectiveAuthLimitFromParent != null || !profile?.id) return

    const loadUserAuthLimit = async () => {
      try {
        const response = await fetch(`/api/authorization/summary?user_id=${profile.id}`)
        const data = await response.json()
        if (!response.ok) {
          setUserAuthLimit(profile.can_authorize_up_to || 0)
        } else {
          const limit =
            data.user_summary?.effective_global_authorization != null
              ? parseFloat(data.user_summary.effective_global_authorization)
              : data.authorization_scopes?.find((s: { scope_type: string }) => s.scope_type === 'global')
                  ?.effective_authorization ?? 0
          setUserAuthLimit(limit > 0 || data.user_summary != null ? limit : profile.can_authorize_up_to || 0)
        }
      } catch {
        setUserAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    loadUserAuthLimit()
  }, [profile, effectiveAuthLimitFromParent])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Calculate summary metrics (En curso = approved + validated)
  const enCursoCount = orders.filter(o => (o.status === PurchaseOrderStatus.Approved || o.status === PurchaseOrderStatus.Validated) && !o.is_adjustment).length
  const summaryMetrics = {
    pending: orders.filter(o => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment).length,
    approved: orders.filter(o => o.status === PurchaseOrderStatus.Approved && !o.is_adjustment).length,
    validated: orders.filter(o => o.status === PurchaseOrderStatus.Validated && !o.is_adjustment).length,
    enCurso: enCursoCount,
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

  // Filter orders by status tab (En curso = approved + validated)
  const filteredOrdersByTab = orders.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") return order.status === PurchaseOrderStatus.PendingApproval && !order.is_adjustment;
    if (activeTab === "en_curso") return (order.status === PurchaseOrderStatus.Approved || order.status === PurchaseOrderStatus.Validated) && !order.is_adjustment;
    if (activeTab === "received") return order.status === PurchaseOrderStatus.Received && !order.is_adjustment;
    if (activeTab === "adjustments") return order.is_adjustment === true;
    return true;
  });

  // Asset options built from orders
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

  // Filter by selected asset
  const filteredByAsset = filteredOrdersByTab.filter(order => {
    if (!selectedAssetId) return true
    return order.work_orders?.asset_id === selectedAssetId
  })

  // Filter by creation date
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

  // Format number to currency string (for backwards compatibility)
  const formatNumberToCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const hasActiveFilters = selectedAssetId || fromDate || toDate

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4">
        {/* Search bar + Filtros button */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              inputMode="search"
              placeholder="Buscar por OC, proveedor..."
              className="pl-8 min-h-[44px] text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 min-h-[44px] min-w-[44px] cursor-pointer">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] text-white">
                    !
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Activo</label>
                  <Select value={selectedAssetId || "all"} onValueChange={(val) => setSelectedAssetId(val === "all" ? "" : val)}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Todos los activos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los activos</SelectItem>
                      {assetOptions.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start min-h-[44px]">
                        <Clock className="mr-2 h-4 w-4" />
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start min-h-[44px]">
                        <Clock className="mr-2 h-4 w-4" />
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
                  <Button variant="outline" className="w-full min-h-[44px]" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                    Limpiar fechas
                  </Button>
                )}
                <Button className="w-full min-h-[44px] bg-sky-700 hover:bg-sky-800" onClick={() => setFiltersOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Wrap tabs - no horizontal scroll */}
        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap gap-2 h-auto p-0 bg-transparent border-0">
              <TabsTrigger value="all" className="rounded-full px-4 py-2 min-h-[44px] data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Todas {orders.length}
              </TabsTrigger>
              <TabsTrigger value="pending" className="rounded-full px-4 py-2 min-h-[44px] relative data-[state=active]:bg-yellow-600 data-[state=active]:text-white">
                Pendientes {summaryMetrics.pending}
                {summaryMetrics.pending > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] text-white">
                    {summaryMetrics.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="en_curso" className="rounded-full px-4 py-2 min-h-[44px] data-[state=active]:bg-green-600 data-[state=active]:text-white">
                En Curso {summaryMetrics.enCurso}
              </TabsTrigger>
              <TabsTrigger value="received" className="rounded-full px-4 py-2 min-h-[44px] data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Recibidas
              </TabsTrigger>
              <TabsTrigger value="adjustments" className="rounded-full px-4 py-2 min-h-[44px] relative data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                Ajustes {summaryMetrics.adjustments}
              </TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="all" className="mt-0">
                <MobileView
                  orders={filteredOrders}
                  isLoading={isLoading}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrency}
                  onDeleteOrder={handleDeleteOrder}
                  userAuthLimit={userAuthLimit}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  approvalContext={approvalContext}
                />
              </TabsContent>
              <TabsContent value="pending" className="mt-0">
                <MobileView
                  orders={filteredOrders}
                  isLoading={isLoading}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrency}
                  onDeleteOrder={handleDeleteOrder}
                  userAuthLimit={userAuthLimit}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  approvalContext={approvalContext}
                />
              </TabsContent>
              <TabsContent value="en_curso" className="mt-0">
                <MobileView
                  orders={filteredOrders}
                  isLoading={isLoading}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrency}
                  onDeleteOrder={handleDeleteOrder}
                  userAuthLimit={userAuthLimit}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  approvalContext={approvalContext}
                />
              </TabsContent>
              <TabsContent value="received" className="mt-0">
                <MobileView
                  orders={filteredOrders}
                  isLoading={isLoading}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrency}
                  onDeleteOrder={handleDeleteOrder}
                  userAuthLimit={userAuthLimit}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  approvalContext={approvalContext}
                />
              </TabsContent>
              <TabsContent value="adjustments" className="mt-0">
                <MobileView
                  orders={filteredOrders}
                  isLoading={isLoading}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrency}
                  onDeleteOrder={handleDeleteOrder}
                  userAuthLimit={userAuthLimit}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  approvalContext={approvalContext}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="text-xs text-muted-foreground pt-2 pb-4">
          Mostrando <strong>{filteredOrders.length}</strong> de <strong>{orders.length}</strong> órdenes.
        </div>
      </div>
      
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
                    <div className="grid grid-cols-1 gap-2 text-sm">
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
                    
                    <div className="text-sm">
                      <span className="font-medium">Items:</span> {orderToApprove.items_preview}
                    </div>
                  </div>
                  
                  {approvalAction === 'approve' ? (
                    <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-lg">
                      <Check className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        ¿Confirmas que quieres aprobar esta orden de compra?
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg">
                      <X className="h-4 w-4" />
                      <span className="font-medium text-sm">
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
    </PullToRefresh>
  )
} 