"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Search, AlertTriangle, Filter, X } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { UI_PERMISSIONS } from "@/lib/auth/role-permissions"
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
  getStatusDotClass,
  getPriorityDotClass,
  getTypeVariant,
  getPriorityVariant,
  getPurchaseOrderStatusVariant,
  getPurchaseOrderStatusClass,
  formatDate,
  formatDateRelative,
} from "./work-order-badges"
import { WorkOrderActionsMenu } from "./work-order-actions-menu"
import { WorkOrderCardMobile } from "./work-order-card-mobile"
import { useDeleteWorkOrder } from "./use-delete-work-order"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
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
  const { profile, roleScope, organizationalContext } = useAuthZustand()
  const userRole = profile?.business_role ?? profile?.role ?? null
  const userId = profile?.id ?? null
  const plantId = organizationalContext?.plantId ?? profile?.plant_id ?? null
  const isPlantScoped = roleScope === "plant"
  const isMecanico = userRole === "MECANICO"
  const canEdit = userRole ? UI_PERMISSIONS.canShowEditButton(userRole, "work_orders") : false
  const canDelete = userRole ? UI_PERMISSIONS.canShowDeleteButton(userRole, "work_orders") : false
  const showPlantFilter = !isPlantScoped

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

  // Filter: role scope (plant), MECANICO (assigned to me), plant_id, type, search, workflow (bar card)
  const filteredOrders = workOrders.filter((order) => {
    if (isPlantScoped && plantId) {
      const orderPlantId = getOrderPlantId(order)
      if (orderPlantId !== plantId) return false
    }
    if (isMecanico && userId) {
      if (order.assigned_to !== userId) return false
    }
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

  const scopeFilteredOrders = workOrders.filter((order) => {
    if (isPlantScoped && plantId) {
      const orderPlantId = getOrderPlantId(order)
      if (orderPlantId !== plantId) return false
    }
    if (isMecanico && userId) {
      if (order.assigned_to !== userId) return false
    }
    return true
  })
  const workflowCounts = computeWorkflowCounts(scopeFilteredOrders)

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
            {/* Filter bar: inline on desktop, collapsible on mobile */}
            {(() => {
              const activeFilterCount = [
                searchTerm.trim(),
                typeFilter !== "all",
                plantFilter !== "all",
                workflowFilter !== null,
              ].filter(Boolean).length
              const hasFilters = activeFilterCount > 0
              const clearFilters = () => {
                setSearchTerm("")
                setTypeFilter("all")
                setPlantFilter("all")
                setWorkflowFilter(null)
              }
              return (
                <div className="mb-4 md:mb-5">
                  {isMobile ? (
                    <Collapsible defaultOpen={false}>
                      <div className="flex items-center gap-2">
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Filter className="h-4 w-4" />
                            Filtros
                            {activeFilterCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                                {activeFilterCount}
                              </span>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        {hasFilters && (
                          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                            <X className="h-4 w-4 mr-1" />
                            Limpiar
                          </Button>
                        )}
                      </div>
                      <CollapsibleContent>
                        <div className="mt-3 flex flex-col gap-3">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Buscar OT, activo, asignado..."
                              className="pl-8 h-11"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-full h-11">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos los tipos</SelectItem>
                              <SelectItem value="preventive">Preventivos</SelectItem>
                              <SelectItem value="corrective">Correctivos</SelectItem>
                            </SelectContent>
                          </Select>
                          {showPlantFilter && (
                            <Select value={plantFilter} onValueChange={setPlantFilter}>
                              <SelectTrigger className="w-full h-11">
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
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder="Buscar OT, activo, asignado..."
                          className="pl-8"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los tipos</SelectItem>
                          <SelectItem value="preventive">Preventivos</SelectItem>
                          <SelectItem value="corrective">Correctivos</SelectItem>
                        </SelectContent>
                      </Select>
                      {showPlantFilter && (
                        <Select value={plantFilter} onValueChange={setPlantFilter}>
                          <SelectTrigger className="w-[180px]">
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
                      )}
                      {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1">
                          <X className="h-4 w-4" />
                          Limpiar filtros
                        </Button>
                      )}
                      {activeFilterCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""} activo{activeFilterCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

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
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ) : (
              <DesktopView
                orders={filteredOrders}
                isLoading={isLoading}
                technicians={technicians}
                getTechnicianName={getTechnicianName}
                getPurchaseOrderStatus={getPurchaseOrderStatus}
                onDeleteOrder={handleDeleteWorkOrder}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            )}
          </CardContent>

          <CardFooter className={cn(isMobile && "px-4")}>
            <div className="text-xs text-muted-foreground">
              Mostrando <strong>{filteredOrders.length}</strong> de <strong>{scopeFilteredOrders.length}</strong> órdenes de trabajo.
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
  onDeleteOrder,
  canEdit,
  canDelete,
}: {
  orders: WorkOrderWithAsset[]
  isLoading: boolean
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  canEdit: boolean
  canDelete: boolean
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
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}
    </div>
  )
}

// Desktop View Component — scannable table with hierarchy and hover actions
function DesktopView({
  orders,
  isLoading,
  technicians,
  getTechnicianName,
  getPurchaseOrderStatus,
  onDeleteOrder,
  canEdit,
  canDelete,
}: {
  orders: WorkOrderWithAsset[]
  isLoading: boolean
  technicians: Record<string, Profile>
  getTechnicianName: (techId: string | null) => string
  getPurchaseOrderStatus: (poId: string | null) => string
  onDeleteOrder: (order: WorkOrderWithAsset) => void
  canEdit: boolean
  canDelete: boolean
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

  function TechnicianCell({ techId }: { techId: string | null }) {
    const name = getTechnicianName(techId)
    const tech = techId ? technicians[techId] : null
    const initials = tech?.nombre && tech?.apellido
      ? `${tech.nombre[0]}${tech.apellido[0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase()
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7 flex-shrink-0 border border-border">
          <AvatarFallback className="text-xs bg-muted text-muted-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-sm">{name}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="w-[100px] font-semibold text-muted-foreground">OT ID</TableHead>
            <TableHead className="font-semibold text-muted-foreground">Activo</TableHead>
            <TableHead className="w-[90px] font-semibold text-muted-foreground">Tipo</TableHead>
            <TableHead className="w-[90px] font-semibold text-muted-foreground">Prioridad</TableHead>
            <TableHead className="w-[120px] font-semibold text-muted-foreground">Estado</TableHead>
            <TableHead className="w-[90px] font-semibold text-muted-foreground">OC</TableHead>
            <TableHead className="w-[100px] text-right font-semibold text-muted-foreground">Fecha</TableHead>
            <TableHead className="w-[140px] font-semibold text-muted-foreground">Asignado</TableHead>
            <TableHead className="w-[56px] text-right font-semibold text-muted-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="group border-b last:border-0 hover:bg-muted/40 transition-colors"
            >
              <TableCell className="py-3 align-middle">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{order.order_id}</span>
                  {order.incident_id && order.asset_id && (
                    <Badge variant="outline" className="w-fit text-xs" asChild>
                      <Link href={`/activos/${order.asset_id}/incidentes`} className="hover:underline">
                        Desde incidente
                      </Link>
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 align-middle">
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">
                    {order.asset?.name || "N/A"}
                  </span>
                  {order.asset?.asset_id && (
                    <span className="text-xs text-muted-foreground truncate">{order.asset.asset_id}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 align-middle">
                <Badge variant={getTypeVariant(order.type)} className="capitalize text-xs">
                  {order.type || "N/A"}
                </Badge>
              </TableCell>
              <TableCell className="py-3 align-middle">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      getPriorityDotClass(order.priority)
                    )}
                    aria-hidden
                  />
                  <span className="text-sm capitalize text-muted-foreground">
                    {order.priority || "N/A"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="py-3 align-middle">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      getStatusDotClass(order.status)
                    )}
                    aria-hidden
                  />
                  <span className="text-sm capitalize">{order.status || "N/A"}</span>
                </div>
              </TableCell>
              <TableCell className="py-3 align-middle">
                {order.purchase_order_id ? (
                  <Badge
                    variant={getPurchaseOrderStatusVariant(getPurchaseOrderStatus(order.purchase_order_id))}
                    className={cn("text-xs", getPurchaseOrderStatusClass(getPurchaseOrderStatus(order.purchase_order_id)))}
                  >
                    {getPurchaseOrderStatus(order.purchase_order_id)}
                  </Badge>
                ) : order.type === MaintenanceType.Preventive && order.required_parts ? (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 text-xs">
                    Pendiente
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="py-3 align-middle text-right tabular-nums text-sm text-muted-foreground">
                {order.planned_date ? formatDateRelative(order.planned_date) : "—"}
              </TableCell>
              <TableCell className="py-3 align-middle">
                <TechnicianCell techId={order.assigned_to} />
              </TableCell>
              <TableCell className="py-3 align-middle text-right">
                <div className="flex justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                  <WorkOrderActionsMenu
                    order={order}
                    getPurchaseOrderStatus={getPurchaseOrderStatus}
                    onDeleteOrder={onDeleteOrder}
                    variant="desktop"
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 