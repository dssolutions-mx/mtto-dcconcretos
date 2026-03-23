"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Check,
  AlertTriangle,
  Clock,
  Package,
  ShoppingCart,
  Trash2,
  X,
  Warehouse,
  Building2,
  Layers,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { PurchaseOrderStatus } from "@/types"
import { PurchaseOrderType } from "@/types/purchase-orders"
import { useToast } from "@/hooks/use-toast"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { formatCurrency, cn } from "@/lib/utils"
import { splitPoLineTotalsByFulfillFrom } from "@/lib/purchase-orders/po-line-amounts"
import { Separator } from "@/components/ui/separator"
import { ComprasSummaryRibbon } from "./ComprasSummaryRibbon"
import { ComprasFilterBar } from "./ComprasFilterBar"
import { ComprasTable } from "./ComprasTable"
import { useComprasData, type PurchaseOrderWithWorkOrder } from "./useComprasData"
import { getWorkOrder, getPurchaseOrderPlantId } from "./po-row-utils"
import { useComprasPlantScope } from "./useComprasPlantScope"

export interface ComprasModuleProps {
  /** When provided by parent (compras page), skips duplicate auth API fetch */
  effectiveAuthLimitFromParent?: number
  isLoadingAuthFromParent?: boolean
}

export function ComprasModule({
  effectiveAuthLimitFromParent,
  isLoadingAuthFromParent,
}: ComprasModuleProps = {}) {
  const { toast } = useToast()
  const { profile } = useAuthZustand()
  const { orders, setOrders, technicians, approvalContext, isLoading, loadOrders, loadApprovalContext } =
    useComprasData()
  const { allowedPlantIds, resolving: scopeResolving } = useComprasPlantScope()
  const scopedOrders = useMemo(() => {
    if (scopeResolving) return []
    if (allowedPlantIds === null) return orders
    return orders.filter((o) => {
      const pid = getPurchaseOrderPlantId(o)
      return pid != null && allowedPlantIds.has(pid)
    })
  }, [orders, allowedPlantIds, scopeResolving])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<string>("all")
  const hasSetInitialTabRef = useRef(false)
  const [userAuthLimit, setUserAuthLimit] = useState<number>(effectiveAuthLimitFromParent ?? 0)
  const [isLoadingAuth, setIsLoadingAuth] = useState(isLoadingAuthFromParent ?? true)
  const [selectedAssetId, setSelectedAssetId] = useState("")
  const [selectedPlantId, setSelectedPlantId] = useState("")
  const [selectedOrderType, setSelectedOrderType] = useState("")
  const [selectedSupplier, setSelectedSupplier] = useState("")
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [orderToApprove, setOrderToApprove] = useState<PurchaseOrderWithWorkOrder | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrderWithWorkOrder | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (effectiveAuthLimitFromParent != null) {
      setUserAuthLimit(effectiveAuthLimitFromParent)
      setIsLoadingAuth(isLoadingAuthFromParent ?? false)
    }
  }, [effectiveAuthLimitFromParent, isLoadingAuthFromParent])

  useEffect(() => {
    const canApprove = !isLoadingAuth && (effectiveAuthLimitFromParent ?? userAuthLimit) > 0
    if (canApprove && !hasSetInitialTabRef.current) {
      setActiveTab("pending")
      hasSetInitialTabRef.current = true
    }
  }, [isLoadingAuth, effectiveAuthLimitFromParent, userAuthLimit])

  useEffect(() => {
    if (effectiveAuthLimitFromParent != null || !profile?.id) return
    const load = async () => {
      try {
        const res = await fetch(`/api/authorization/summary?user_id=${profile.id}`)
        const data = await res.json()
        if (!res.ok) {
          setUserAuthLimit(profile.can_authorize_up_to || 0)
          return
        }
        const limit =
          data.user_summary?.effective_global_authorization != null
            ? parseFloat(data.user_summary.effective_global_authorization)
            : data.authorization_scopes?.find((s: { scope_type: string }) => s.scope_type === "global")
                ?.effective_authorization ?? 0
        setUserAuthLimit(limit > 0 || data.user_summary != null ? limit : profile.can_authorize_up_to || 0)
      } catch {
        setUserAuthLimit(profile.can_authorize_up_to || 0)
      } finally {
        setIsLoadingAuth(false)
      }
    }
    load()
  }, [profile, effectiveAuthLimitFromParent])

  const handleQuickApproval = (order: PurchaseOrderWithWorkOrder, action: "approve" | "reject") => {
    setOrderToApprove(order)
    setApprovalAction(action)
    setShowApprovalDialog(true)
  }

  const handleRecordViability = async (order: PurchaseOrderWithWorkOrder) => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/purchase-orders/advance-workflow/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: "validated" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.details || "Error al registrar viabilidad")
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, viability_state: "viable" as const } : o))
      )
      const pendingIds = scopedOrders
        .filter((o) => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
        .map((o) => o.id)
      await loadApprovalContext(pendingIds)
      toast({ title: "Viabilidad registrada", description: `La orden ${order.order_id} tiene viabilidad administrativa registrada.` })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo registrar viabilidad", variant: "destructive" })
    } finally {
      setIsApproving(false)
    }
  }

  const confirmApproval = async () => {
    if (!orderToApprove) return
    setIsApproving(true)
    try {
      const newStatus = approvalAction === "approve" ? "approved" : "rejected"
      const res = await fetch(`/api/purchase-orders/advance-workflow/${orderToApprove.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.details || data.error || data.message || "Error en la aprobación")
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderToApprove.id
            ? { ...o, status: newStatus === "approved" ? PurchaseOrderStatus.Approved : PurchaseOrderStatus.Rejected }
            : o
        )
      )
      const stillPending = scopedOrders
        .filter((o) => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment && o.id !== orderToApprove.id)
        .map((o) => o.id)
      await loadApprovalContext(stillPending)
      toast({ title: approvalAction === "approve" ? "Orden aprobada" : "Orden rechazada", description: `La orden ${orderToApprove.order_id} ha sido ${approvalAction === "approve" ? "aprobada" : "rechazada"} exitosamente.` })
      setShowApprovalDialog(false)
      setOrderToApprove(null)
    } catch (err) {
      toast({ title: "Error en la aprobación", description: err instanceof Error ? err.message : "No se pudo procesar la orden", variant: "destructive" })
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeleteOrder = (order: PurchaseOrderWithWorkOrder) => {
    setOrderToDelete(order)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!orderToDelete) return
    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("purchase_orders").delete().eq("id", orderToDelete.id)
      if (error) throw error
      setOrders((prev) => prev.filter((o) => o.id !== orderToDelete.id))
      toast({ title: "Orden de compra eliminada", description: `La orden ${orderToDelete.order_id} ha sido eliminada exitosamente.` })
      setShowDeleteDialog(false)
      setTimeout(() => setOrderToDelete(null), 100)
    } catch {
      toast({ title: "Error al eliminar", description: "No se pudo eliminar la orden de compra. Por favor, intente nuevamente.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const assetOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {}
    scopedOrders.forEach((o) => {
      const asset = o.work_orders?.assets
      if (o.work_orders?.asset_id && asset) {
        const id = o.work_orders.asset_id
        const labelBase = asset.asset_id || asset.name || "Activo"
        const plant = asset.plants?.name ? ` • ${asset.plants.name}` : ""
        map[id] = { id, label: `${labelBase}${plant}` }
      }
    })
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
  }, [scopedOrders])

  const plantOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {}
    scopedOrders.forEach((o) => {
      const po = o as PurchaseOrderWithWorkOrder & { plants?: { id: string; name: string } | null }
      const plantId = getPurchaseOrderPlantId(po)
      const plantName = po.plants?.name || po.work_orders?.assets?.plants?.name
      if (plantId && plantName) map[plantId] = { id: plantId, label: plantName }
    })
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
  }, [scopedOrders])

  const orderTypeOptions = useMemo(
    () => [
      { id: PurchaseOrderType.DIRECT_PURCHASE, label: "Compra Directa" },
      { id: PurchaseOrderType.DIRECT_SERVICE, label: "Servicio Directo" },
      { id: PurchaseOrderType.SPECIAL_ORDER, label: "Pedido Especial" },
    ],
    []
  )

  const supplierOptions = useMemo(() => {
    const map: Record<string, string> = {}
    scopedOrders.forEach((o) => {
      const name = (o as PurchaseOrderWithWorkOrder).po_type && (o as PurchaseOrderWithWorkOrder).service_provider
        ? (o as PurchaseOrderWithWorkOrder).service_provider!
        : o.supplier || ""
      if (name?.trim()) map[name.trim()] = name.trim()
    })
    return Object.values(map).sort((a, b) => a.localeCompare(b))
  }, [scopedOrders])

  const summaryMetrics = useMemo(
    () => ({
      pending: scopedOrders.filter((o) => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment).length,
      approved: scopedOrders.filter((o) => o.status === PurchaseOrderStatus.Approved && !o.is_adjustment).length,
      validated: scopedOrders.filter((o) => o.status === PurchaseOrderStatus.Validated && !o.is_adjustment).length,
      adjustments: scopedOrders.filter((o) => o.is_adjustment).length,
      totalPendingValue: scopedOrders
        .filter((o) => o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment)
        .reduce((sum, o) => sum + (typeof o.total_amount === "string" ? parseFloat(o.total_amount) : o.total_amount || 0), 0),
      totalMonthValue: scopedOrders
        .filter((o) => {
          if (!o.created_at) return false
          const d = new Date(o.created_at)
          const n = new Date()
          return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
        })
        .reduce((sum, o) => sum + (typeof o.total_amount === "string" ? parseFloat(o.total_amount) : o.total_amount || 0), 0),
    }),
    [scopedOrders]
  )

  const filteredOrders = useMemo(() => {
    let list = scopedOrders.filter((o) => {
      if (activeTab === "all") return true
      if (activeTab === "pending") return o.status === PurchaseOrderStatus.PendingApproval && !o.is_adjustment
      if (activeTab === "approved") return o.status === PurchaseOrderStatus.Approved && !o.is_adjustment
      if (activeTab === "validated") return o.status === PurchaseOrderStatus.Validated && !o.is_adjustment
      if (activeTab === "received") return o.status === PurchaseOrderStatus.Received && !o.is_adjustment
      if (activeTab === "adjustments") return o.is_adjustment === true
      return true
    })
    if (selectedAssetId) list = list.filter((o) => o.work_orders?.asset_id === selectedAssetId)
    if (selectedPlantId) {
      list = list.filter((o) => getPurchaseOrderPlantId(o) === selectedPlantId)
    }
    if (selectedOrderType) list = list.filter((o) => o.po_type === selectedOrderType)
    if (selectedSupplier) {
      const s = selectedSupplier.trim().toLowerCase()
      list = list.filter((o) => {
        const name = ((o as PurchaseOrderWithWorkOrder).po_type && (o as PurchaseOrderWithWorkOrder).service_provider
          ? (o as PurchaseOrderWithWorkOrder).service_provider
          : o.supplier || ""
        ).trim()
        return name.toLowerCase() === s
      })
    }
    if (fromDate || toDate) {
      list = list.filter((o) => {
        if (!o.created_at) return false
        const created = new Date(o.created_at)
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
    }
    const term = searchTerm.toLowerCase()
    return list.filter((o) => {
      const wo = getWorkOrder(o)
      return (
        (o.order_id?.toLowerCase() || "").includes(term) ||
        (o.supplier?.toLowerCase() || "").includes(term) ||
        (wo?.order_id?.toLowerCase() || "").includes(term) ||
        (wo?.description?.toLowerCase() || "").includes(term)
      )
    })
  }, [scopedOrders, activeTab, selectedAssetId, selectedPlantId, selectedOrderType, selectedSupplier, fromDate, toDate, searchTerm])

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return "No asignado"
    const tech = technicians[techId]
    if (!tech) return techId
    return tech.nombre && tech.apellido ? `${tech.nombre} ${tech.apellido}` : tech.nombre || techId
  }

  const formatCurrencyLocal = (amount: string | number | null) => {
    if (!amount) return "$0.00"
    const n = typeof amount === "string" ? parseFloat(amount) : amount
    return `$${n.toFixed(2)}`
  }

  const formatNumberToCurrency = (amount: number) => `$${amount.toFixed(2)}`

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A"
    try {
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return "N/A"
      return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return "N/A"
    }
  }

  return (
    <div className="compras-module space-y-4 animate-in fade-in duration-300 motion-reduce:animate-none" data-animate>
      <ComprasSummaryRibbon
        metrics={summaryMetrics}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        formatCurrency={formatNumberToCurrency}
        hasPending={summaryMetrics.pending > 0}
      />

      {summaryMetrics.pending > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
            <p className="text-sm font-medium text-orange-800">
              {summaryMetrics.pending} orden{summaryMetrics.pending !== 1 ? "es" : ""} pendiente
              {summaryMetrics.pending !== 1 ? "s" : ""} de aprobación · {formatNumberToCurrency(summaryMetrics.totalPendingValue)}
            </p>
          </div>
          <Button size="sm" onClick={() => setActiveTab("pending")} className="bg-orange-600 hover:bg-orange-700 shrink-0 cursor-pointer">
            <Clock className="h-4 w-4 mr-2" />
            Aprobar Órdenes
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <ComprasFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedAssetId={selectedAssetId}
              onAssetChange={setSelectedAssetId}
              assetOptions={assetOptions}
              selectedPlantId={selectedPlantId}
              onPlantChange={setSelectedPlantId}
              plantOptions={plantOptions}
              selectedOrderType={selectedOrderType}
              onOrderTypeChange={setSelectedOrderType}
              orderTypeOptions={orderTypeOptions}
              selectedSupplier={selectedSupplier}
              onSupplierChange={setSelectedSupplier}
              supplierOptions={supplierOptions}
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">Todas ({scopedOrders.length})</TabsTrigger>
              <TabsTrigger value="pending">Pendientes ({summaryMetrics.pending})</TabsTrigger>
              <TabsTrigger value="approved">Aprobadas ({summaryMetrics.approved})</TabsTrigger>
              <TabsTrigger value="validated">Validadas ({summaryMetrics.validated})</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
              <TabsTrigger value="adjustments">Ajustes ({summaryMetrics.adjustments})</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              {isLoading || scopeResolving ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No se encontraron órdenes de compra</h3>
                  <p className="text-muted-foreground">Prueba ajustando los filtros o el término de búsqueda.</p>
                </div>
              ) : (
                <ComprasTable
                  orders={filteredOrders}
                  approvalContext={approvalContext}
                  expandedRows={expandedRows}
                  onToggleExpand={toggleRowExpansion}
                  getTechnicianName={getTechnicianName}
                  formatCurrency={formatCurrencyLocal}
                  formatDate={formatDate}
                  onQuickApproval={handleQuickApproval}
                  onRecordViability={handleRecordViability}
                  onDelete={handleDeleteOrder}
                  isApproving={isApproving}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{approvalAction === "approve" ? "Confirmar Aprobación" : "Confirmar Rechazo"}</AlertDialogTitle>
            <AlertDialogDescription>
              {approvalAction === "approve" ? "Revisa los detalles de la orden antes de aprobar." : "Revisa los detalles de la orden antes de rechazar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {orderToApprove && (
            <div className="space-y-3 mt-4">
              {approvalContext[orderToApprove.id]?.workflowStage && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium text-muted-foreground">Etapa:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      approvalContext[orderToApprove.id].workflowStage === "Validación técnica" && "bg-blue-50 text-blue-700 border-blue-200",
                      approvalContext[orderToApprove.id].workflowStage === "Viabilidad administrativa" && "bg-amber-50 text-amber-700 border-amber-200",
                      approvalContext[orderToApprove.id].workflowStage === "Aprobación final" && "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {approvalContext[orderToApprove.id].workflowStage}
                  </Badge>
                </div>
              )}
              {orderToApprove.po_purpose && (
                <div
                  className={cn(
                    "p-3 rounded-lg border-2",
                    orderToApprove.po_purpose === "work_order_inventory" && "border-sky-200 bg-sky-50",
                    orderToApprove.po_purpose === "inventory_restock" && "border-purple-500 bg-purple-50",
                    orderToApprove.po_purpose === "work_order_cash" && "border-orange-200 bg-orange-50",
                    orderToApprove.po_purpose === "mixed" && "border-amber-200 bg-amber-50"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {orderToApprove.po_purpose === "work_order_inventory" && (
                      <Badge variant="default" className="gap-1 rounded-full text-[10px] font-semibold border border-sky-200">
                        <Package className="h-3 w-3" /> Desde almacén
                      </Badge>
                    )}
                    {orderToApprove.po_purpose === "inventory_restock" && (
                      <Badge variant="secondary" className="gap-1 rounded-full text-[10px] font-semibold">
                        <Warehouse className="h-3 w-3" /> Reabastecimiento
                      </Badge>
                    )}
                    {orderToApprove.po_purpose === "work_order_cash" && (
                      <Badge variant="outline" className="gap-1 rounded-full text-[10px] font-semibold border-orange-200 bg-orange-50 text-orange-900">
                        <ShoppingCart className="h-3 w-3" /> Compra a proveedor
                      </Badge>
                    )}
                    {orderToApprove.po_purpose === "mixed" && (
                      <Badge variant="outline" className="gap-1 rounded-full text-[10px] font-semibold border-amber-200 bg-amber-50 text-amber-900">
                        <Layers className="h-3 w-3" /> Mixto: almacén y proveedor
                      </Badge>
                    )}
                  </div>
                  {(() => {
                    const split = splitPoLineTotalsByFulfillFrom(orderToApprove.items)
                    const headerTotal = Number(orderToApprove.total_amount) || 0
                    const sumLines = split.inventoryTotal + split.purchaseTotal
                    const sumMismatch =
                      split.inventoryLineCount + split.purchaseLineCount > 0 &&
                      Math.abs(sumLines - headerTotal) > 0.05

                    if (orderToApprove.po_purpose === "mixed") {
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                            <span className="text-muted-foreground shrink-0">Desde almacén (ref.)</span>
                            <span className="font-semibold tabular-num text-green-800 text-right">
                              {formatCurrencyLocal(split.inventoryTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 border-b border-border/40 pb-2">
                            <span className="text-muted-foreground shrink-0">Compra a proveedor</span>
                            <span className="font-semibold tabular-num text-orange-800 text-right">
                              {formatCurrencyLocal(split.purchaseTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 pt-0.5">
                            <span className="text-muted-foreground shrink-0">Total OC (cabecera)</span>
                            <span className="font-medium tabular-num text-right">
                              {formatCurrencyLocal(orderToApprove.total_amount || "0")}
                            </span>
                          </div>
                          {sumMismatch && (
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              La suma de líneas no coincide exactamente con el total de la orden; usa el total de
                              cabecera para autorización.
                            </p>
                          )}
                          <div className="pt-1 border-t border-border/40">
                            <span className="text-muted-foreground text-xs">Clasificación: </span>
                            <span className="font-medium text-xs">Mixto (almacén + proveedor)</span>
                          </div>
                        </div>
                      )
                    }

                    const purchaseFromLines =
                      split.purchaseLineCount > 0 ? split.purchaseTotal : headerTotal
                    const compraLabelMonto =
                      orderToApprove.po_purpose === "work_order_inventory"
                        ? "No aplica"
                        : formatCurrencyLocal(
                            orderToApprove.po_purpose === "work_order_cash"
                              ? String(purchaseFromLines || headerTotal)
                              : orderToApprove.total_amount || "0"
                          )

                    return (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Monto en compra a proveedor</span>
                          <div
                            className={cn(
                              "font-bold tabular-num",
                              orderToApprove.po_purpose === "work_order_inventory"
                                ? "text-green-700"
                                : "text-orange-700"
                            )}
                          >
                            {compraLabelMonto}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clasificación</span>
                          <div className="font-medium">
                            {orderToApprove.po_purpose === "work_order_inventory" && "Solo surtido interno"}
                            {orderToApprove.po_purpose === "inventory_restock" && "Inversión en stock"}
                            {orderToApprove.po_purpose === "work_order_cash" && "Compra operativa"}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Orden:</span> {orderToApprove.order_id}
                  </div>
                  <div>
                    <span className="font-medium">Monto:</span> {formatCurrencyLocal(orderToApprove.total_amount || "0")}
                  </div>
                  <div>
                    <span className="font-medium">Proveedor:</span> {orderToApprove.supplier || "No especificado"}
                  </div>
                  <div>
                    <span className="font-medium">Solicitado por:</span> {getTechnicianName(orderToApprove.requested_by)}
                  </div>
                </div>
                {orderToApprove.work_orders && (
                  <>
                    <Separator />
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
                  </>
                )}
                <Separator />
                <div className="text-sm">
                  <span className="font-medium">Items:</span> {orderToApprove.items_preview}
                </div>
              </div>
              {approvalAction === "approve" ? (
                <div className="flex items-center space-x-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">¿Confirmas que quieres aprobar esta orden de compra?</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-red-700 bg-red-50 p-3 rounded-lg">
                  <X className="h-4 w-4" />
                  <span className="font-medium">¿Confirmas que quieres rechazar esta orden de compra?</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">Tu límite de autorización: {formatCurrencyLocal(userAuthLimit)}</div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApproval}
              disabled={isApproving}
              className={approvalAction === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {isApproving ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  {approvalAction === "approve" ? (
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro que desea eliminar esta orden de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la orden de compra <strong>{orderToDelete?.order_id}</strong>.
            </AlertDialogDescription>
            <div className="space-y-3 pt-2">
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm text-red-800 font-medium mb-2">⚠️ ADVERTENCIA: Esta acción también eliminará:</div>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>Gastos adicionales asociados a órdenes de ajuste</li>
                  <li>Comprobantes de compra cargados</li>
                  <li>Órdenes de ajuste que referencien a esta orden</li>
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">Esta acción no se puede deshacer.</div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Eliminando..." : "Eliminar OC"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
