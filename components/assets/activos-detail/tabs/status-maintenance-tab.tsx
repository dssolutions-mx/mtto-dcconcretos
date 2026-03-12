"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  History,
  Link2,
  Plus,
  Wrench,
  Calendar as CalendarIcon,
} from "lucide-react"
import {
  getMaintenanceValue,
  getUnitLabel,
  getUnitDisplayName,
  type MaintenanceUnit,
} from "@/lib/utils/maintenance-units"

interface StatusMaintenanceTabProps {
  assetId: string
  asset: any
  maintenanceUnit: MaintenanceUnit
  upcomingMaintenances: any[]
  upcomingLoading: boolean
  maintenanceHistory: any[]
  combinedMaintenanceHistory: any[] | null
  maintenanceIntervals: any[]
  workOrders: any[]
  workOrdersLoading: boolean
  poByWorkOrder: Record<string, any>
  pendingIncidentsCount: number
  pendingChecklistsCount: number
  formatDate: (date: string | null) => string
  formatCurrency: (value: number | string | null | undefined) => string | null
  ui: { shouldShowInNavigation: (module: string) => boolean }
}

const DESCRIPTION_MAX = 100

function getIntervalLabelForMaintenance(
  maintenance: any,
  maintenanceIntervals: any[]
): string | null {
  try {
    const planId = maintenance?.maintenance_plan_id
    if (!planId) return null
    const interval = maintenanceIntervals.find((i: any) => i.id === planId)
    if (!interval) return null
    const unit = interval.type === "kilometers" ? "km" : "h"
    const base = interval.name || interval.description || ""
    if (base) return base
    const value = Number(interval.interval_value) || 0
    if (value > 0) return `${value}${unit}`
    return null
  } catch {
    return null
  }
}

function getIntervalInfoForMaintenance(
  maintenance: any,
  maintenanceIntervals: any[]
): { title: string; description: string | null } | null {
  try {
    const planId = maintenance?.maintenance_plan_id
    if (!planId) return null
    const interval = maintenanceIntervals.find((i: any) => i.id === planId)
    if (!interval) return null
    const unit = interval.type === "kilometers" ? "km" : "h"
    const title = interval.name || interval.description || ""
    const description = interval.description && interval.description !== title
      ? interval.description
      : null
    if (title) return { title, description }
    const value = Number(interval.interval_value) || 0
    if (value > 0) return { title: `${value}${unit}`, description: null }
    return null
  } catch {
    return null
  }
}

export function StatusMaintenanceTab({
  assetId,
  asset,
  maintenanceUnit,
  upcomingMaintenances,
  upcomingLoading,
  maintenanceHistory,
  combinedMaintenanceHistory,
  maintenanceIntervals,
  workOrders,
  workOrdersLoading,
  poByWorkOrder,
  pendingIncidentsCount,
  pendingChecklistsCount,
  formatDate,
  formatCurrency,
  ui,
}: StatusMaintenanceTabProps) {
  const effectiveHistory = combinedMaintenanceHistory ?? maintenanceHistory
  const [expandedUpcomingIds, setExpandedUpcomingIds] = useState<Set<number>>(new Set())
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set())

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium">
              <Calendar className="h-5 w-5" />
              Próximos Mantenimientos
            </CardTitle>
            <CardDescription>Mantenimientos programados para este activo</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : upcomingMaintenances.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle className="mx-auto h-10 w-10 text-green-500" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-green-700">Mantenimientos al día</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No hay mantenimientos vencidos o próximos
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="mt-2 cursor-pointer">
                  <Link href={`/activos/${assetId}/mantenimiento`}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Ver calendario completo
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMaintenances.slice(0, 3).map((maintenance, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-3 border-l-4 transition-shadow duration-200 hover:shadow-md cursor-pointer ${
                      maintenance.status === "overdue"
                        ? "border-l-red-500 bg-red-50 border border-red-200"
                        : maintenance.status === "upcoming"
                          ? "border-l-amber-500 bg-amber-50 border border-amber-200"
                          : maintenance.status === "covered"
                            ? "border-l-blue-500 bg-blue-50 border border-blue-200"
                            : "border-l-gray-200 border border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <Badge
                          variant={
                            maintenance.status === "overdue"
                              ? "destructive"
                              : maintenance.status === "upcoming"
                                ? "default"
                                : "outline"
                          }
                          className="mb-2"
                        >
                          {maintenance.status === "overdue"
                            ? "Vencido"
                            : maintenance.status === "upcoming"
                              ? "Próximo"
                              : maintenance.status === "scheduled"
                                ? "Programado"
                                : "Cubierto"}
                        </Badge>
                        <div className="space-y-1">
                          <h4 className="font-medium text-sm sm:text-base break-words">
                            {maintenance.intervalName ?? ""}
                          </h4>
                          {(() => {
                            const title = maintenance.intervalName ?? ""
                            const description = maintenance.intervalDescription ?? ""
                            const hasExpandableDescription =
                              description && description !== title && description.length > title.length
                            if (!hasExpandableDescription) return null
                            const isExpanded = expandedUpcomingIds.has(index)
                            const displayDesc =
                              !isExpanded && description.length > DESCRIPTION_MAX
                                ? description.slice(0, DESCRIPTION_MAX) + "..."
                                : description
                            return (
                              <div className="text-sm text-muted-foreground">
                                {isExpanded && <p className="break-words mt-1">{displayDesc}</p>}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-1"
                                  onClick={() => {
                                    setExpandedUpcomingIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(index)) next.delete(index)
                                      else next.add(index)
                                      return next
                                    })
                                  }}
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Ver menos
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Ver descripción
                                    </>
                                  )}
                                </Button>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs self-start ${
                          maintenance.urgency === "high"
                            ? "border-red-500 text-red-600 bg-red-50"
                            : maintenance.urgency === "medium"
                              ? "border-yellow-500 text-yellow-600 bg-yellow-50"
                              : "border-green-500 text-green-600 bg-green-50"
                        }`}
                      >
                        {maintenance.urgency === "high"
                          ? "Alta prioridad"
                          : maintenance.urgency === "medium"
                            ? "Media prioridad"
                            : "Baja prioridad"}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="break-words">
                          {`${maintenance.currentValue}/${maintenance.targetValue} ${getUnitDisplayName(maintenance.unit === "kilometers" ? "kilometers" : "hours")}`}
                          {maintenance.status === "overdue" && maintenance.valueRemaining < 0 && (
                            <span className="font-medium text-red-600 ml-2">
                              (Excedido por {Math.abs(maintenance.valueRemaining)}{" "}
                              {getUnitLabel(maintenance.unit === "kilometers" ? "kilometers" : "hours")})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="break-words">
                          {maintenance.status === "overdue"
                            ? `Vencido - debió realizarse antes de las ${maintenance.targetValue}h`
                            : maintenance.status === "covered"
                              ? "Cubierto por mantenimiento posterior"
                              : maintenance.valueRemaining > 0
                                ? `Próximo en ${maintenance.valueRemaining} ${maintenance.unit === "hours" ? "horas" : "km"}`
                                : "Programado para el futuro"}
                        </span>
                      </div>
                      {maintenance.wasPerformed && maintenance.lastMaintenanceDate && (
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 flex-shrink-0" />
                          <span className="break-words text-xs">
                            Realizado: {formatDate(maintenance.lastMaintenanceDate)}
                          </span>
                        </div>
                      )}
                      {!maintenance.wasPerformed && maintenance.status !== "covered" && (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-500" />
                          <span className="break-words text-xs text-orange-600">
                            Nunca realizado
                          </span>
                        </div>
                      )}
                    </div>
                    {(maintenance.status === "overdue" ||
                      (maintenance.status === "upcoming" && maintenance.urgency === "high")) && (
                      <div className="mt-3 pt-2 border-t border-red-200">
                        <Button
                          size="sm"
                          variant={maintenance.status === "overdue" ? "destructive" : "default"}
                          asChild
                          className="w-full cursor-pointer"
                        >
                          <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                            <Wrench className="h-4 w-4 mr-2" />
                            {maintenance.status === "overdue"
                              ? "Registrar Urgente"
                              : "Programar Mantenimiento"}
                          </Link>
                        </Button>
                      </div>
                    )}
                    {maintenance.status === "covered" && (
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <Button size="sm" variant="outline" disabled className="w-full opacity-50">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Cubierto por mantenimiento posterior
                        </Button>
                      </div>
                    )}
                    {maintenance.status === "upcoming" && maintenance.urgency !== "high" && (
                      <div className="mt-3 pt-2 border-t border-amber-200">
                        <Button size="sm" variant="outline" asChild className="w-full cursor-pointer">
                          <Link href={`/activos/${assetId}/mantenimiento/nuevo?planId=${maintenance.intervalId}`}>
                            <Wrench className="h-4 w-4 mr-2" />
                            Programar Mantenimiento
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {upcomingMaintenances.length > 3 && (
                  <div className="mt-3 text-center">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer">
                      <Link href={`/activos/${assetId}/mantenimiento`}>
                        Ver todos ({upcomingMaintenances.length}) mantenimientos
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium">
              <History className="h-5 w-5" />
              Trabajos realizados
            </CardTitle>
            <CardDescription>Historial reciente de mantenimientos ejecutados</CardDescription>
          </CardHeader>
          <CardContent>
            {effectiveHistory.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Sin historial de mantenimiento</p>
                <Button variant="outline" className="mt-4 cursor-pointer" asChild>
                  <Link href={`/activos/${assetId}/mantenimiento/nuevo`}>
                    Registrar primer mantenimiento
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {effectiveHistory.slice(0, 4).map((maintenance: any) => (
                  <div
                    key={maintenance.id}
                    className="border border-gray-200 rounded-lg p-4 space-y-3 hover:bg-muted/30 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              maintenance.type === "Preventivo"
                                ? "default"
                                : maintenance.type === "Correctivo"
                                  ? "destructive"
                                  : "outline"
                            }
                            className="text-xs"
                          >
                            {maintenance.type}
                          </Badge>
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getMaintenanceValue(maintenance, maintenanceUnit)}
                            {getUnitLabel(maintenanceUnit)}
                          </span>
                        </div>
                        <h4 className="font-medium text-base">{formatDate(maintenance.date)}</h4>
                        {maintenance.assets?.asset_id && (
                          <div className="text-xs text-muted-foreground">
                            Activo:{" "}
                            <span className="font-medium">{maintenance.assets.asset_id}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {(() => {
                            const intervalInfo = getIntervalInfoForMaintenance(
                              maintenance,
                              maintenanceIntervals
                            )
                            if (!intervalInfo) return null
                            const { title, description } = intervalInfo
                            const historyId = String(maintenance.id ?? "")
                            const hasExpandableDescription =
                              description && description.length > title.length
                            const isExpanded = expandedHistoryIds.has(historyId)
                            const displayDesc =
                              hasExpandableDescription && !isExpanded && description!.length > DESCRIPTION_MAX
                                ? description!.slice(0, DESCRIPTION_MAX) + "..."
                                : (description ?? "")
                            return (
                              <span className="flex flex-wrap items-center gap-1">
                                Intervalo: <span className="font-medium">{title}</span>
                                {hasExpandableDescription && (
                                  <>
                                    {isExpanded && (
                                      <span className="block w-full mt-1 font-normal">
                                        {displayDesc}
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                      onClick={() => {
                                        setExpandedHistoryIds((prev) => {
                                          const next = new Set(prev)
                                          if (next.has(historyId)) next.delete(historyId)
                                          else next.add(historyId)
                                          return next
                                        })
                                      }}
                                    >
                                      {isExpanded ? (
                                        <><ChevronUp className="h-3 w-3 mr-0.5" /> Ver menos</>
                                      ) : (
                                        <><ChevronDown className="h-3 w-3 mr-0.5" /> Ver descripción</>
                                      )}
                                    </Button>
                                  </>
                                )}
                              </span>
                            )
                          })()}
                          {(() => {
                            const po = poByWorkOrder?.[maintenance.work_order_id]
                            const poCost =
                              po?.adjusted_total_amount ?? po?.total_amount ?? po?.actual_amount ?? null
                            const formatted = formatCurrency(poCost)
                            return formatted ? (
                              <span>
                                Costo: <span className="font-medium">{formatted}</span>
                              </span>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {maintenance.technician || "No asignado"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild className="cursor-pointer">
                        <Link href={`/activos/${maintenance.asset_id || assetId}/mantenimiento/${maintenance.id}`}>
                          Ver detalles
                        </Link>
                      </Button>
                      {maintenance.work_order_id && (
                        <>
                          <Button size="sm" variant="outline" asChild className="cursor-pointer">
                            <Link href={`/ordenes/${maintenance.work_order_id}`}>Ver OT</Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {effectiveHistory.length > 4 && (
                  <div className="mt-2 text-center">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer">
                      <Link href={`/activos/${assetId}/historial`}>Ver historial completo</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-medium">
              <Wrench className="h-5 w-5" />
              Trabajos planificados
            </CardTitle>
            <CardDescription>Órdenes de trabajo pendientes o en curso para este activo</CardDescription>
          </CardHeader>
          <CardContent>
            {workOrdersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : workOrders.length === 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 cursor-pointer"
                  >
                    <Link
                      href={`/ordenes?assetId=${assetId}&asset=${encodeURIComponent(asset?.name || "")}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver todas las OT
                    </Link>
                  </Button>
                  {ui.shouldShowInNavigation("work_orders") && (
                    <Button size="sm" asChild className="flex-1 cursor-pointer">
                      <Link href={`/ordenes/crear?assetId=${assetId}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva OT
                      </Link>
                    </Button>
                  )}
                </div>
                <div className="text-center py-4 border rounded-lg bg-muted/50">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="h-8 w-8 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">Sin órdenes de trabajo</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No hay órdenes de trabajo registradas para este activo
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1 cursor-pointer">
                    <Link
                      href={`/ordenes?assetId=${assetId}&asset=${encodeURIComponent(asset?.name || "")}`}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver todas ({workOrders.length}+)
                    </Link>
                  </Button>
                  {ui.shouldShowInNavigation("work_orders") && (
                    <Button size="sm" asChild className="flex-1 cursor-pointer">
                      <Link href={`/ordenes/crear?assetId=${assetId}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva OT
                      </Link>
                    </Button>
                  )}
                </div>
                {workOrders.slice(0, 3).map((workOrder) => (
                  <div
                    key={workOrder.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-muted/30 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={
                              workOrder.type === "Preventivo"
                                ? "default"
                                : workOrder.type === "Correctivo"
                                  ? "destructive"
                                  : "outline"
                            }
                            className="mb-1"
                          >
                            {workOrder.type}
                          </Badge>
                          {workOrder.incident_id && (
                            <Badge variant="secondary" className="mb-1" asChild>
                              <Link href={`/activos/${assetId}/incidentes`} className="cursor-pointer hover:underline">
                                <Link2 className="h-3 w-3 mr-1" />
                                Desde incidente
                              </Link>
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-medium text-sm">{workOrder.order_id}</h4>
                      </div>
                      <Badge
                        variant={
                          workOrder.status === "Completada"
                            ? "outline"
                            : workOrder.status === "En Proceso"
                              ? "secondary"
                              : workOrder.status === "Pendiente"
                                ? "default"
                                : "outline"
                        }
                        className="text-xs"
                      >
                        {workOrder.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {workOrder.description || "Sin descripción"}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {workOrder.technician_profile
                          ? [workOrder.technician_profile.nombre, workOrder.technician_profile.apellido]
                              .filter(Boolean)
                              .join(" ") || "No asignado"
                          : "No asignado"}
                      </span>
                      <span>{formatDate(workOrder.planned_date || workOrder.created_at)}</span>
                    </div>
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="w-full cursor-pointer"
                      >
                        <Link href={`/ordenes/${workOrder.id}`}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {workOrders.length > 3 && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-muted-foreground">
                      {workOrders.length - 3} órdenes más...
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
