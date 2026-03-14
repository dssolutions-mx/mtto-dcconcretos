"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, AlertTriangle, ShoppingCart, Calendar, Package, Repeat, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useIsMobile } from "@/hooks/use-mobile"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { WorkOrder, WorkOrderWithAsset, WorkOrderStatus, MaintenanceType, ServiceOrderPriority, Asset, Profile, PurchaseOrderStatus } from "@/types"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { useWorkOrderFilters, applyWorkOrderFilters } from "@/hooks/useWorkOrderFilters"
import { countByStatusSegment } from "@/lib/work-order-status-tabs"
import { WorkOrdersFilterBar } from "@/components/work-orders/WorkOrdersFilterBar"
import type { WorkOrderSummaryMetrics } from "@/components/work-orders/WorkOrdersSummaryRibbon"
import type { WorkOrderFilters, WorkOrderSortBy, WorkOrderSortDir } from "@/hooks/useWorkOrderFilters"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
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

function getPurchaseOrderStatusVariant(status: string) {
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

/** Origin badge: incident_id → "Desde incidente"; checklist_id (no incident) → "Desde checklist"; maintenance_plan_id + preventive → "Preventivo programado"; else "Manual / Ad-hoc" */
function getOriginBadge(order: WorkOrderWithAsset): { label: string; href?: string } {
  if (order.incident_id && order.asset_id) {
    return { label: "Desde incidente", href: `/incidentes/${order.incident_id}` }
  }
  if (order.checklist_id) {
    return { label: "Desde checklist" }
  }
  if (order.maintenance_plan_id && order.type === MaintenanceType.Preventive) {
    return { label: "Preventivo programado" }
  }
  return { label: "Manual / Ad-hoc" }
}

/** Brief summary of what the work order is about (description + tasks/parts count if available) */
function getWorkOrderScopeSummary(order: WorkOrderWithAsset): { text: string; tasksCount?: number; partsCount?: number } {
  const desc = order.description?.trim() || ""
  let tasksCount: number | undefined
  let partsCount: number | undefined
  if (order.required_tasks) {
    try {
      const tasks = typeof order.required_tasks === "string" ? JSON.parse(order.required_tasks) : order.required_tasks
      tasksCount = Array.isArray(tasks) ? tasks.length : 0
    } catch {
      tasksCount = undefined
    }
  }
  if (order.required_parts) {
    try {
      const parts = typeof order.required_parts === "string" ? JSON.parse(order.required_parts) : order.required_parts
      partsCount = Array.isArray(parts) ? parts.length : 0
    } catch {
      partsCount = undefined
    }
  }
  return { text: desc, tasksCount, partsCount }
}

/** Recurrence count when escalation_count > 0 or related_issues_count > 1; otherwise null */
function getRecurrenceCount(order: WorkOrderWithAsset): number | null {
  const esc = order.escalation_count ?? 0
  const related = order.related_issues_count ?? 1
  if (esc > 0 || related > 1) {
    return Math.max(esc, related)
  }
  return null
}

function getPurchaseOrderStatusClass(status: string) {
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

// Mobile-optimized WorkOrder Card Component
function WorkOrderCard({ 
  order, 
  getTechnicianName, 
  getPurchaseOrderStatus,
  onDeleteOrder
}: { 
  order: WorkOrderWithAsset
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
}) {
  return (
    <Card className="w-full h-fit hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {order.order_id}
            </CardTitle>
            {/* Asset: asset_id only — name is not shown */}
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              {order.asset_id ? (
                <Link
                  href={`/activos/${order.asset_id}`}
                  className="font-medium truncate hover:underline text-primary"
                >
                  {order.asset?.asset_id || "Activo"}
                </Link>
              ) : (
                <span className="font-medium truncate text-muted-foreground">N/A</span>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-slate-600">Qué se hará</p>
              <p className="text-sm text-foreground line-clamp-3">
                {order.description || "Sin descripción"}
              </p>
              {(() => {
                const { tasksCount, partsCount } = getWorkOrderScopeSummary(order)
                if (tasksCount ?? partsCount) {
                  const parts = []
                  if (tasksCount) parts.push(`${tasksCount} tarea${tasksCount !== 1 ? "s" : ""}`)
                  if (partsCount) parts.push(`${partsCount} repuesto${partsCount !== 1 ? "s" : ""}`)
                  return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>
                }
                return null
              })()}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={getStatusVariant(order.status)} className="shrink-0">
              {order.status || "Pendiente"}
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
              <Link href={`/ordenes/${order.id}`} title="Ver OT">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {order.purchase_order_id ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                <Link href={`/compras/${order.purchase_order_id}`} title="Ver OC">
                  <ShoppingCart className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Type, Priority, Origin, Recurrence */}
        <div className="flex gap-2 flex-wrap items-center">
          <Badge variant={getTypeVariant(order.type)} className="text-xs">
            {order.type || 'N/A'}
          </Badge>
          <Badge variant={getPriorityVariant(order.priority)} className="text-xs">
            {order.priority || 'Normal'}
          </Badge>
          {(() => {
            const origin = getOriginBadge(order)
            return origin.href ? (
              <Link href={origin.href} className={cn(badgeVariants({ variant: "outline" }), "text-xs cursor-pointer hover:underline")}>
                {origin.label}
              </Link>
            ) : (
              <Badge variant="outline" className="text-xs">
                {origin.label}
              </Badge>
            )
          })()}
          {(() => {
            const n = getRecurrenceCount(order)
            return n !== null ? (
              <Badge
                variant="secondary"
                className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100"
              >
                Recurrente ({n})
              </Badge>
            ) : null
          })()}
        </div>
        
        {/* Technician */}
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{getTechnicianName(order.assigned_to)}</span>
        </div>
        
        {/* Creation date + recurrence tooltip */}
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          {(() => {
            const created = order.created_at ? formatDate(order.created_at) : '—'
            const hasRecurrence = getRecurrenceCount(order) !== null
            const lastRecurrence = order.last_escalation_date ? formatDate(order.last_escalation_date) : null
            if (hasRecurrence && lastRecurrence) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild><span className="truncate cursor-help">{created}</span></TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Última recurrencia: {lastRecurrence}</TooltipContent>
                </Tooltip>
              )
            }
            return <span className="truncate">{created}</span>
          })()}
        </div>
        
        {/* Purchase Order Status */}
        {order.purchase_order_id && (
          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
            <Badge 
              variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))} 
              className={`text-xs ${getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id))}`}
            >
              OC: {getPurchaseOrderStatus(order.purchase_order_id)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Utility function to properly cleanup modal state and focus
const cleanupModalState = (callback: () => void, delay: number = 100) => {
  setTimeout(() => {
    callback()
    // Force any modal overlays to be removed
    const modalOverlays = document.querySelectorAll('[data-radix-focus-guard], [data-radix-scroll-lock-wrapper]')
    modalOverlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    })
    // Clear any stuck focus states
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur()
    }
    document.body.focus()
    // Remove any aria-hidden attributes from the body that might be stuck
    document.body.removeAttribute('aria-hidden')
    document.body.style.removeProperty('pointer-events')
  }, delay)
}

export function WorkOrdersList() {
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const {
    filters,
    setFilters,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useWorkOrderFilters()

  const [workOrders, setWorkOrders] = useState<WorkOrderWithAsset[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const [purchaseOrderStatuses, setPurchaseOrderStatuses] = useState<Record<string, string>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<WorkOrderWithAsset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load work orders — single API call (server does parallel fetches, minimal payload)
  const loadWorkOrders = async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/work-orders/list", { cache: "no-store" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const {
        workOrders: workOrdersData,
        technicians: techMap,
        purchaseOrderStatuses: statusMap,
        totalCount: total,
      } = await res.json()
      setWorkOrders((workOrdersData ?? []) as WorkOrderWithAsset[])
      setTechnicians((techMap ?? {}) as Record<string, Profile>)
      setPurchaseOrderStatuses((statusMap ?? {}) as Record<string, string>)
      setTotalCount(total ?? workOrdersData?.length ?? 0)
    } catch (error) {
      console.error("Error al cargar órdenes de trabajo:", error)
      setWorkOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWorkOrders()
  }, [])

  const assetOptions = useMemo(() => {
    const map: Record<string, { id: string; label: string }> = {}
    workOrders.forEach((o) => {
      if (o.asset_id && o.asset) {
        const id = o.asset_id
        const label = o.asset.asset_id || o.asset.name || "Activo"
        map[id] = { id, label }
      }
    })
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
  }, [workOrders])

  const technicianOptions = useMemo(() => {
    return Object.entries(technicians).map(([id, t]) => ({
      id,
      label: t.nombre && t.apellido ? `${t.nombre} ${t.apellido}` : t.nombre || id,
    }))
  }, [technicians])

  const filteredOrders = useMemo(() => {
    return applyWorkOrderFilters(workOrders, filters, technicians)
  }, [workOrders, filters, technicians])

  /** When groupByAsset: group filtered orders by asset_id for UI rendering (grouping is UI-only) */
  const groupedOrders = useMemo(() => {
    if (!filters.groupByAsset) return null
    const map = new Map<string | null, WorkOrderWithAsset[]>()
    for (const o of filteredOrders) {
      const key = o.asset_id ?? null
      const arr = map.get(key) ?? []
      arr.push(o)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .map(([assetId, orders]) => {
        const first = orders[0]
        const label =
          assetId && first?.asset
            ? (first.asset.asset_id || first.asset.name || "Activo")
            : "Sin activo"
        return { assetId, label, orders }
      })
      .sort((a, b) => {
        if (a.assetId == null && b.assetId != null) return 1
        if (a.assetId != null && b.assetId == null) return -1
        return a.label.localeCompare(b.label)
      })
  }, [filters.groupByAsset, filteredOrders])

  const ribbonMetrics = useMemo<WorkOrderSummaryMetrics>(() => {
    const pending = countByStatusSegment(workOrders, "pending")
    const completed = countByStatusSegment(workOrders, "completed")
    const recurrentes = workOrders.filter(
      (o) =>
        (o.escalation_count != null && o.escalation_count > 0) ||
        (o.related_issues_count != null && o.related_issues_count > 1)
    ).length
    return { pending, completed, recurrentes }
  }, [workOrders])

  const handleRecurrentesClick = () => {
    if (filters.recurrentesOnly) {
      setFilters({ recurrentesOnly: false })
    } else {
      setFilters({ recurrentesOnly: true, tab: "all" })
    }
  }

  // Helper functions
  const getTechnicianName = (techId: string | null) => {
    if (!techId) return 'No asignado'
    const tech = technicians[techId]
    if (!tech) return techId
    return tech.nombre && tech.apellido 
      ? `${tech.nombre} ${tech.apellido}`
      : tech.nombre || techId
  }

  const getPurchaseOrderStatus = (poId: string | null): string => {
    if (!poId) return 'N/A'
    return purchaseOrderStatuses[poId] || 'N/A'
  }

  // Pull to refresh handler
  const handlePullToRefresh = async () => {
    await loadWorkOrders()
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Delete work order function
  const handleDeleteWorkOrder = async (order: WorkOrderWithAsset) => {
    setOrderToDelete(order)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!orderToDelete) return

    setIsDeleting(true)
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from("work_orders")
        .delete()
        .eq("id", orderToDelete.id)

      if (error) {
        console.error("Error al eliminar orden de trabajo:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar la orden de trabajo. Por favor, intente nuevamente.",
          variant: "destructive",
        })
        setIsDeleting(false)
      } else {
        toast({
          title: "Orden eliminada",
          description: `La orden de trabajo ${orderToDelete.order_id} ha sido eliminada exitosamente.`,
        })
        
        // Remove the deleted order from the list
        setWorkOrders(prev => prev.filter(wo => wo.id !== orderToDelete.id))
        
        // Close dialog with proper cleanup
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        
        // Reset order state after a brief delay to ensure dialog closes properly
        cleanupModalState(() => {
          setOrderToDelete(null)
        }, 100)
      }
    } catch (error) {
      console.error("Error al eliminar orden de trabajo:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor, intente nuevamente.",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <PullToRefresh onRefresh={handlePullToRefresh} disabled={isLoading}>
        {/* Apple HIG: Content-first, deference, clarity. Single toolbar + unified segmented control. */}
        <div className="space-y-6">
          {/* Toolbar: Search + Filters. Progressive disclosure per HIG. */}
          <div className="flex flex-col gap-4">
            <WorkOrdersFilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onClearAll={clearAllFilters}
              assetOptions={assetOptions}
              technicianOptions={technicianOptions}
              hasActiveFilters={hasActiveFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>

          {/* Unified segmented control: replaces redundant ribbon + tabs. Apple-style. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div
              role="tablist"
              aria-label="Filtrar por estado"
              className="inline-flex rounded-[10px] bg-slate-100/80 p-1 border border-border/60"
            >
              {[
                { id: "all", label: "Todas", count: totalCount || workOrders.length },
                { id: "pending", label: "Pendientes", count: ribbonMetrics.pending },
                { id: "completed", label: "Completadas", count: ribbonMetrics.completed },
              ].map((opt) => {
                const isActive =
                  !filters.recurrentesOnly && filters.tab === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`${opt.label}: ${opt.count}`}
                    onClick={() => setFilters({ tab: opt.id })}
                    className={cn(
                      "min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg text-[15px] font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-white text-foreground shadow-sm border border-border/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="sm:hidden">{opt.label}</span>
                    <span className="hidden sm:inline">{opt.label} ({opt.count})</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={handleRecurrentesClick}
              aria-pressed={filters.recurrentesOnly}
              aria-label={`Solo recurrentes: ${ribbonMetrics.recurrentes}`}
              className={cn(
                "min-h-[44px] px-4 py-2.5 rounded-[10px] text-[15px] font-medium inline-flex items-center gap-2 transition-all duration-200 cursor-pointer",
                filters.recurrentesOnly
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
              )}
            >
              <Repeat className="h-4 w-4" />
              Recurrentes ({ribbonMetrics.recurrentes})
            </button>
          </div>

          {/* List content - single view, no duplicate tab content */}
          <Tabs value={filters.tab} onValueChange={(v) => setFilters({ tab: v })} className="w-full">
              
              {/* Content for each tab */}
              <TabsContent value="all" className="mt-0">
                {isMobile ? (
                  <MobileView 
                    orders={filteredOrders} 
                    groupedOrders={groupedOrders}
                    isLoading={isLoading} 
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                  />
                ) : (
                  <DesktopView
                    orders={filteredOrders}
                    groupedOrders={groupedOrders}
                    isLoading={isLoading}
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    filters={filters}
                    onSortChange={setFilters}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="pending" className="mt-0">
                {isMobile ? (
                  <MobileView 
                    orders={filteredOrders} 
                    groupedOrders={groupedOrders}
                    isLoading={isLoading} 
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                  />
                ) : (
                  <DesktopView 
                    orders={filteredOrders} 
                    groupedOrders={groupedOrders}
                    isLoading={isLoading} 
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    filters={filters}
                    onSortChange={setFilters}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="mt-0">
                {isMobile ? (
                  <MobileView 
                    orders={filteredOrders} 
                    groupedOrders={groupedOrders}
                    isLoading={isLoading} 
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                  />
                ) : (
                  <DesktopView 
                    orders={filteredOrders} 
                    groupedOrders={groupedOrders}
                    isLoading={isLoading} 
                    getTechnicianName={getTechnicianName}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={handleDeleteWorkOrder}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    filters={filters}
                    onSortChange={setFilters}
                  />
                )}
              </TabsContent>
          </Tabs>

          {/* Footer: Results count. Deference - subtle. */}
          <div className="text-[13px] text-muted-foreground pt-2">
            {filteredOrders.length} de {totalCount || workOrders.length} órdenes
          </div>
        </div>
      </PullToRefresh>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro de eliminar esta orden de trabajo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la orden de trabajo <strong>{orderToDelete?.order_id}</strong> y todos sus registros relacionados.
            </AlertDialogDescription>
            <div className="space-y-3 pt-2">
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Historial de mantenimiento</li>
                <li>Problemas de checklist asociados</li>
                <li>Órdenes de servicio relacionadas</li>
                <li>Gastos adicionales</li>
                <li>Órdenes de compra vinculadas</li>
              </ul>
              <div className="font-semibold text-destructive text-sm">Esta acción no se puede deshacer.</div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type GroupedOrdersItem = { assetId: string | null; label: string; orders: WorkOrderWithAsset[] }

// Mobile View Component
function MobileView({ 
  orders, 
  groupedOrders,
  isLoading, 
  getTechnicianName, 
  getPurchaseOrderStatus,
  onDeleteOrder,
  hasActiveFilters,
  onClearFilters,
}: {
  orders: WorkOrderWithAsset[]
  groupedOrders: GroupedOrdersItem[] | null
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Cargando órdenes...</span>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed p-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">
          {hasActiveFilters
            ? "No se encontraron órdenes con estos filtros."
            : "No se encontraron órdenes de trabajo."}
        </p>
        {hasActiveFilters && onClearFilters ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={onClearFilters}
          >
            Limpiar filtros
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">Intenta ajustar los filtros.</p>
        )}
      </div>
    )
  }

  if (groupedOrders && groupedOrders.length > 0) {
    return (
      <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {groupedOrders.map((group) => (
          <div key={group.assetId ?? "sin-activo"}>
            <div className="flex items-center gap-2 mb-3 px-1">
              {group.assetId ? (
                <Link
                  href={`/activos/${group.assetId}`}
                  className="font-semibold text-sm text-primary hover:underline"
                >
                  {group.label}
                </Link>
              ) : (
                <span className="font-semibold text-sm text-muted-foreground">{group.label}</span>
              )}
              <span className="text-xs text-muted-foreground">({group.orders.length})</span>
            </div>
            <div className="space-y-4">
              {group.orders.map((order) => (
                <WorkOrderCard
                  key={order.id}
                  order={order}
                  getTechnicianName={getTechnicianName}
                  getPurchaseOrderStatus={getPurchaseOrderStatus}
                  onDeleteOrder={onDeleteOrder}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="space-y-4">
      {orders.map((order) => (
        <WorkOrderCard 
          key={order.id}
          order={order}
          getTechnicianName={getTechnicianName}
          getPurchaseOrderStatus={getPurchaseOrderStatus}
          onDeleteOrder={onDeleteOrder}
        />
      ))}
    </div>
    </TooltipProvider>
  )
}

/** Sortable column header - click to cycle sort */
function SortableTableHead({
  label,
  sortKey,
  filters,
  onSortChange,
  className,
}: {
  label: string
  sortKey: WorkOrderSortBy
  filters: WorkOrderFilters
  onSortChange: (patch: Partial<WorkOrderFilters>) => void
  className?: string
}) {
  const isActive = filters.sortBy === sortKey
  const handleClick = () => {
    if (isActive) {
      onSortChange({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" })
    } else {
      const defaultDir: WorkOrderSortDir =
        sortKey === "created" || sortKey === "orderId" || sortKey === "priority" ? "desc" : "asc"
      onSortChange({ sortBy: sortKey, sortDir: defaultDir })
    }
  }
  const Icon = isActive
    ? filters.sortDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown
  return (
    <TableHead className={cn("py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0", className)}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleClick() }}
        className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", isActive && "text-foreground")} />
      </button>
    </TableHead>
  )
}

// Desktop View Component (existing table)
function DesktopView({ 
  orders, 
  groupedOrders,
  isLoading, 
  getTechnicianName, 
  getPurchaseOrderStatus,
  onDeleteOrder,
  hasActiveFilters,
  onClearFilters,
  filters,
  onSortChange,
}: {
  orders: WorkOrderWithAsset[]
  groupedOrders: GroupedOrdersItem[] | null
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  filters: WorkOrderFilters
  onSortChange: (patch: Partial<WorkOrderFilters>) => void
}) {
  const router = useRouter()
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Cargando órdenes...</span>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed p-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">
          {hasActiveFilters
            ? "No se encontraron órdenes con estos filtros."
            : "No se encontraron órdenes de trabajo para esta vista."}
        </p>
        {hasActiveFilters && onClearFilters ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 cursor-pointer"
            onClick={onClearFilters}
          >
            Limpiar filtros
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">Intenta ajustar los filtros o revisa más tarde.</p>
        )}
      </div>
    )
  }

  const renderTable = (ordersToRender: WorkOrderWithAsset[]) => (
    <TooltipProvider delayDuration={300}>
    <div className="rounded-xl border border-border/60 overflow-x-auto bg-white">
    <Table className="w-full min-w-[860px]">
        <TableHeader>
          <TableRow className="border-b border-border/60 hover:bg-transparent">
            <SortableTableHead label="#Orden" sortKey="orderId" filters={filters} onSortChange={onSortChange} className="w-[90px]" />
            <SortableTableHead label="Activo" sortKey="asset" filters={filters} onSortChange={onSortChange} className="w-[85px]" />
            <TableHead className="min-w-[220px] py-3 px-3 text-[13px] font-semibold text-muted-foreground">Descripción</TableHead>
            <TableHead className="w-[88px] py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0">Tipo</TableHead>
            <SortableTableHead label="Prioridad" sortKey="priority" filters={filters} onSortChange={onSortChange} className="w-[82px]" />
            <TableHead className="w-[95px] py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0">Estado</TableHead>
            <TableHead className="w-[110px] py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0">Origen</TableHead>
            <TableHead className="w-[95px] py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0">Recurr.</TableHead>
            <SortableTableHead label="Creado" sortKey="created" filters={filters} onSortChange={onSortChange} className="w-[88px]" />
            <TableHead className="w-[110px] py-3 px-3 text-[13px] font-semibold text-muted-foreground shrink-0">Asignado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordersToRender.map((order) => (
            <TableRow
              key={order.id}
              className="border-b border-border/40 last:border-0 transition-colors duration-150 hover:bg-slate-50/50 cursor-pointer"
              onClick={() => router.push(`/ordenes/${order.id}`)}
            >
              <TableCell className="font-semibold text-[15px] py-3 px-3 align-middle text-primary">{order.order_id}</TableCell>
              <TableCell className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                {order.asset_id ? (
                  <Link
                    href={`/activos/${order.asset_id}`}
                    className="font-medium hover:underline text-primary"
                  >
                    {order.asset?.asset_id || "Activo"}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell className="py-3 px-3 align-top">
                <p className="text-sm text-foreground line-clamp-3 leading-snug" title={order.description || undefined}>
                  {order.description || "—"}
                </p>
                {(() => {
                  const { tasksCount, partsCount } = getWorkOrderScopeSummary(order)
                  if (tasksCount ?? partsCount) {
                    const parts = []
                    if (tasksCount) parts.push(`${tasksCount} tarea${tasksCount !== 1 ? "s" : ""}`)
                    if (partsCount) parts.push(`${partsCount} repuesto${partsCount !== 1 ? "s" : ""}`)
                    return <span className="text-xs text-muted-foreground mt-0.5 block">{parts.join(" · ")}</span>
                  }
                  return null
                })()}
              </TableCell>
              <TableCell className="py-3 px-3">
                <Badge variant={getTypeVariant(order.type)} className="capitalize text-xs font-medium px-1.5 py-0">
                  {order.type || 'N/A'}
                </Badge>
              </TableCell>
              <TableCell className="py-3 px-3">
                <Badge variant={getPriorityVariant(order.priority)} className="capitalize text-xs font-medium px-1.5 py-0">
                  {order.priority || 'N/A'}
                </Badge>
              </TableCell>
              <TableCell className="py-3 px-3">
                <Badge variant={getStatusVariant(order.status)} className="capitalize text-xs font-medium px-1.5 py-0">
                  {order.status || 'N/A'}
                </Badge>
              </TableCell>
              <TableCell className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const origin = getOriginBadge(order)
                  return origin.href ? (
                    <Link href={origin.href} className={cn(badgeVariants({ variant: "outline" }), "w-fit text-xs cursor-pointer hover:underline")}>
                      {origin.label}
                    </Link>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {origin.label}
                    </Badge>
                  )
                })()}
              </TableCell>
              <TableCell className="py-3 px-3">
                {(() => {
                  const n = getRecurrenceCount(order)
                  return n !== null ? (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium px-1.5 py-0 bg-amber-100 text-amber-800 hover:bg-amber-100"
                    >
                      Recurrente ({n})
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )
                })()}
              </TableCell>
              <TableCell className="py-3 px-3 text-xs">
                {(() => {
                  const created = order.created_at ? formatDate(order.created_at) : '—'
                  const hasRecurrence = getRecurrenceCount(order) !== null
                  const lastRecurrence = order.last_escalation_date ? formatDate(order.last_escalation_date) : null
                  const content = <span className={hasRecurrence && lastRecurrence ? "cursor-help" : undefined}>{created}</span>
                  if (hasRecurrence && lastRecurrence) {
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Última recurrencia: {lastRecurrence}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }
                  return content
                })()}
              </TableCell>
              <TableCell className="py-3 px-3 text-xs" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[80px]" title={getTechnicianName(order.assigned_to)}>{getTechnicianName(order.assigned_to)}</span>
                  {order.purchase_order_id ? (
                    <Link href={`/compras/${order.purchase_order_id}`} title="Ver OC" className="shrink-0 text-muted-foreground hover:text-foreground">
                      <ShoppingCart className="h-4 w-4" />
                    </Link>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
  )

  if (groupedOrders && groupedOrders.length > 0) {
    return (
      <div className="space-y-6">
        {groupedOrders.map((group) => (
          <div key={group.assetId ?? "sin-activo"}>
            <div className="flex items-center gap-2 mb-2">
              {group.assetId ? (
                <Link
                  href={`/activos/${group.assetId}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {group.label}
                </Link>
              ) : (
                <span className="font-semibold text-muted-foreground">{group.label}</span>
              )}
              <span className="text-xs text-muted-foreground">({group.orders.length} órdenes)</span>
            </div>
            <div className="rounded-md border">
              {renderTable(group.orders)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      {renderTable(orders)}
    </div>
  )
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return dateString
    }
    return new Intl.DateTimeFormat("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch (error) {
    console.warn("Error formatting date:", dateString, error)
    return dateString
  }
} 