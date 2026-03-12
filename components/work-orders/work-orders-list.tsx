"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Search, AlertTriangle } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useIsMobile } from "@/hooks/use-mobile"
import Link from "next/link"
import {
  WorkOrderWithAsset,
  WorkOrderStatus,
  MaintenanceType,
  Profile,
} from "@/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import {
  getStatusVariant,
  getTypeVariant,
  getPriorityVariant,
  getPurchaseOrderStatusVariant,
  getPurchaseOrderStatusClass,
  formatDate,
} from "./work-order-badges"
import { WorkOrderActionsMenu } from "./work-order-actions-menu"
import { WorkOrderCardMobile } from "./work-order-card-mobile"
import { useDeleteWorkOrder } from "./use-delete-work-order"
import { WorkOrderDeleteDialog } from "./work-order-delete-dialog"
import {
  WorkflowSummaryBar,
  type WorkflowSummaryFilter,
  type WorkflowSummaryCounts,
} from "./workflow-summary-bar"

function getOrderPlantId(order: WorkOrderWithAsset): string | null {
  return order.plant_id ?? order.asset?.plant_id ?? null
}

function isOverdue(order: WorkOrderWithAsset): boolean {
  if (order.status === WorkOrderStatus.Completed || !order.planned_date) return false
  const planned = new Date(order.planned_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  planned.setHours(0, 0, 0, 0)
  return planned < today
}

function isActive(order: WorkOrderWithAsset): boolean {
  return order.status === WorkOrderStatus.InProgress
}

function isWaitingPo(order: WorkOrderWithAsset): boolean {
  return Boolean(order.required_parts && !order.purchase_order_id)
}

function isTodayCompleted(order: WorkOrderWithAsset): boolean {
  if (order.status !== WorkOrderStatus.Completed || !order.completed_at) return false
  const completed = new Date(order.completed_at)
  const today = new Date()
  return (
    completed.getFullYear() === today.getFullYear() &&
    completed.getMonth() === today.getMonth() &&
    completed.getDate() === today.getDate()
  )
}

function computeWorkflowCounts(orders: WorkOrderWithAsset[]): WorkflowSummaryCounts {
  return {
    overdue: orders.filter(isOverdue).length,
    active: orders.filter(isActive).length,
    waitingPo: orders.filter(isWaitingPo).length,
    todayCompleted: orders.filter(isTodayCompleted).length,
  }
}

interface PlantOption {
  id: string
  name: string
}

export function WorkOrdersList() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState("")
  const [workOrders, setWorkOrders] = useState<WorkOrderWithAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [plantFilter, setPlantFilter] = useState<string>("all")
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowSummaryFilter>(null)
  const [technicians, setTechnicians] = useState<Record<string, Profile>>({})
  const [purchaseOrderStatuses, setPurchaseOrderStatuses] = useState<Record<string, string>>({})
  const [plants, setPlants] = useState<PlantOption[]>([])

  const {
    openDelete: handleDeleteWorkOrder,
    orderToDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    confirmDelete,
    isDeleting,
  } = useDeleteWorkOrder({
    onDeleted: (order) => setWorkOrders((prev) => prev.filter((wo) => wo.id !== order.id)),
  })

  // Initialize search term from URL parameters
  useEffect(() => {
    const assetName = searchParams.get("asset")
    const assetId = searchParams.get("assetId")
    if (assetName) setSearchTerm(assetName)
    else if (assetId) setSearchTerm(assetId)
  }, [searchParams])

  // Fetch plants on mount
  useEffect(() => {
    async function fetchPlants() {
      try {
        const res = await fetch("/api/plants")
        if (!res.ok) return
        const json = await res.json()
        const list = Array.isArray(json.plants) ? json.plants : []
        setPlants(list.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name || p.id })))
      } catch (e) {
        console.error("Error fetching plants:", e)
      }
    }
    fetchPlants()
  }, [])

  const loadWorkOrders = async () => {
    try {
      setIsLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          asset:assets (
            id,
            name,
            asset_id,
            plant_id
          )
        `)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error al cargar órdenes de trabajo:", error)
        throw error
      }

      setWorkOrders((data as WorkOrderWithAsset[]) ?? [])

      const assignedIds = (data ?? [])
        .filter((o) => o.assigned_to)
        .map((o) => o.assigned_to as string)
      const uniqueAssignedIds = [...new Set(assignedIds)]
      const techMap: Record<string, Profile> = {}

      const { data: activeTechs, error: activeTechError } = await supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .eq("is_active", true)
        .limit(500)

      if (!activeTechError && activeTechs) {
        activeTechs.forEach((tech) => {
          techMap[tech.id] = tech
        })
      }

      if (uniqueAssignedIds.length > 0) {
        const { data: assignedTechs, error: assignedTechError } = await supabase
          .from("profiles")
          .select("id, nombre, apellido")
          .in("id", uniqueAssignedIds)
        if (!assignedTechError && assignedTechs) {
          assignedTechs.forEach((tech) => {
            techMap[tech.id] = tech
          })
        }
      }
      setTechnicians(techMap)

      const poIds = (data ?? [])
        .filter((o) => o.purchase_order_id)
        .map((o) => o.purchase_order_id as string)
      if (poIds.length > 0) {
        const { data: poData, error: poError } = await supabase
          .from("purchase_orders")
          .select("id, status")
          .in("id", poIds)
        if (!poError && poData) {
          const statusMap: Record<string, string> = {}
          poData.forEach((po) => {
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

  useEffect(() => {
    loadWorkOrders()
  }, [])

  // Filter: plant_id, type, search, workflow (bar card)
  const filteredOrders = workOrders.filter((order) => {
    if (plantFilter !== "all") {
      const orderPlantId = getOrderPlantId(order)
      if (orderPlantId !== plantFilter) return false
    }
    if (typeFilter !== "all") {
      if (typeFilter === "preventive" && order.type !== MaintenanceType.Preventive) return false
      if (typeFilter === "corrective" && order.type !== MaintenanceType.Corrective) return false
    }
    const assetIdParam = searchParams.get("assetId")
    if (assetIdParam && order.asset_id !== assetIdParam) return false
    const term = searchTerm.toLowerCase()
    if (term) {
      const match =
        (order.asset?.name?.toLowerCase() ?? "").includes(term) ||
        (order.asset?.asset_id?.toLowerCase() ?? "").includes(term) ||
        (order.order_id?.toLowerCase() ?? "").includes(term) ||
        (order.assigned_to && technicians[order.assigned_to]?.nombre?.toLowerCase().includes(term)) ||
        (order.description?.toLowerCase() ?? "").includes(term)
      if (!match) return false
    }
    if (workflowFilter === "overdue") return isOverdue(order)
    if (workflowFilter === "active") return isActive(order)
    if (workflowFilter === "waiting_po") return isWaitingPo(order)
    if (workflowFilter === "today_completed") return isTodayCompleted(order)
    return true
  })

  const workflowCounts = computeWorkflowCounts(workOrders)

  const getTechnicianName = (techId: string | null) => {
    if (!techId) return "No asignado"
    const tech = technicians[techId]
    if (!tech) return techId
    return tech.nombre && tech.apellido ? `${tech.nombre} ${tech.apellido}` : tech.nombre || techId
  }

  const getPurchaseOrderStatus = (poId: string | null): string => {
    if (!poId) return "N/A"
    return purchaseOrderStatuses[poId] ?? "N/A"
  }

  const handlePullToRefresh = async () => {
    await loadWorkOrders()
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return (
    <>
      <PullToRefresh onRefresh={handlePullToRefresh} disabled={isLoading}>
        <Card>
          <CardContent className={cn("pt-6", isMobile && "px-4 pt-4")}>
            {/* Search and Filters */}
            <div
              className={cn(
                "flex gap-4 mb-4",
                isMobile ? "flex-col gap-3" : "flex-col md:flex-row md:items-center md:justify-between"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2",
                  isMobile ? "flex-col gap-3" : "flex-col md:flex-row"
                )}
              >
                <div className={cn("relative", isMobile ? "w-full" : "w-full md:w-64")}>
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar OT, activo, asignado..."
                    className={cn("pl-8", isMobile && "h-11")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className={cn(isMobile ? "w-full h-11" : "w-full md:w-40")}>
                    <SelectValue placeholder="Filtrar por tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="preventive">Preventivos</SelectItem>
                    <SelectItem value="corrective">Correctivos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={plantFilter} onValueChange={setPlantFilter}>
                  <SelectTrigger className={cn(isMobile ? "w-full h-11" : "w-full md:w-44")}>
                    <SelectValue placeholder="Planta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las plantas</SelectItem>
                    {plants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <WorkflowSummaryBar
              counts={workflowCounts}
              activeFilter={workflowFilter}
              onFilterChange={setWorkflowFilter}
            />

            {isMobile ? (
              <MobileView
                orders={filteredOrders}
                isLoading={isLoading}
                getTechnicianName={getTechnicianName}
                getPurchaseOrderStatus={getPurchaseOrderStatus}
                onDeleteOrder={handleDeleteWorkOrder}
              />
            ) : (
              <DesktopView
                orders={filteredOrders}
                isLoading={isLoading}
                getTechnicianName={getTechnicianName}
                getPurchaseOrderStatus={getPurchaseOrderStatus}
                onDeleteOrder={handleDeleteWorkOrder}
              />
            )}
          </CardContent>

          <CardFooter className={cn(isMobile && "px-4")}>
            <div className="text-xs text-muted-foreground">
              Mostrando <strong>{filteredOrders.length}</strong> de <strong>{workOrders.length}</strong> órdenes de trabajo.
            </div>
          </CardFooter>
        </Card>
      </PullToRefresh>

      <WorkOrderDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        orderToDelete={orderToDelete}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </>
  )
}

// Mobile View Component
function MobileView({ 
  orders, 
  isLoading, 
  getTechnicianName, 
  getPurchaseOrderStatus,
  onDeleteOrder
}: {
  orders: WorkOrderWithAsset[]
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
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
      <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">No se encontraron órdenes de trabajo.</p>
        <p className="text-sm text-muted-foreground">Intenta ajustar los filtros.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <WorkOrderCardMobile
          key={order.id}
          order={order}
          getTechnicianName={getTechnicianName}
          getPurchaseOrderStatus={getPurchaseOrderStatus}
          onDeleteOrder={onDeleteOrder}
        />
      ))}
    </div>
  )
}

// Desktop View Component (existing table)
function DesktopView({
  orders,
  isLoading,
  getTechnicianName,
  getPurchaseOrderStatus,
  onDeleteOrder,
}: {
  orders: WorkOrderWithAsset[]
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
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
      <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-center text-muted-foreground">No se encontraron órdenes de trabajo para esta vista.</p>
        <p className="text-sm text-muted-foreground">Intenta ajustar los filtros o revisa más tarde.</p>
      </div>
    )
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
              <TableCell className="font-medium">
                <div className="flex flex-col gap-1">
                  <span>{order.order_id}</span>
                  {order.incident_id && order.asset_id && (
                    <Badge variant="outline" className="w-fit text-xs" asChild>
                      <Link href={`/activos/${order.asset_id}/incidentes`} className="hover:underline">
                        Desde incidente
                      </Link>
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {order.asset?.name || "N/A"}
                {order.asset?.asset_id && (
                  <span className="text-xs text-muted-foreground ml-1">({order.asset.asset_id})</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={getTypeVariant(order.type)} className="capitalize">
                  {order.type || "N/A"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityVariant(order.priority)} className="capitalize">
                  {order.priority || "N/A"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(order.status)} className="capitalize">
                  {order.status || "N/A"}
                </Badge>
              </TableCell>
              <TableCell>
                {order.purchase_order_id ? (
                  <Badge
                    variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))}
                    className={getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id))}
                  >
                    {getPurchaseOrderStatus(order.purchase_order_id)}
                  </Badge>
                ) : order.type === MaintenanceType.Preventive && order.required_parts ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                    Pendiente
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell>
                {order.planned_date ? formatDate(order.planned_date) : "No planificada"}
              </TableCell>
              <TableCell>{getTechnicianName(order.assigned_to)}</TableCell>
              <TableCell className="text-right">
                <WorkOrderActionsMenu
                  order={order}
                  getPurchaseOrderStatus={getPurchaseOrderStatus}
                  onDeleteOrder={onDeleteOrder}
                  variant="desktop"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 