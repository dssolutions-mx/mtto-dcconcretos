"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  Eye,
  Wrench,
  Calendar,
  User,
  Clock,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  normalizeStatus,
  getStatusInfo,
  getTypeInfo,
  getPriorityInfo,
  getDaysSinceCreated,
} from "./incidents-status-utils"

function formatDate(dateString: string | null): string {
  if (!dateString) return "No disponible"
  return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es })
}

function getAssetName(incident: Record<string, unknown>, assets: Record<string, unknown>[]): string {
  if (incident.asset_code) return String(incident.asset_code)
  const asset = assets.find((a) => a.id === incident.asset_id)
  return asset ? String(asset.asset_id ?? "N/A") : "N/A"
}

function getAssetFullName(incident: Record<string, unknown>, assets: Record<string, unknown>[]): string {
  if (incident.asset_display_name) return String(incident.asset_display_name)
  const asset = assets.find((a) => a.id === incident.asset_id)
  return asset ? String(asset.name ?? "Activo no encontrado") : "Activo no encontrado"
}

function getReporterName(incident: Record<string, unknown>): string {
  if (incident.reported_by_name) return String(incident.reported_by_name)
  if (incident.reported_by && String(incident.reported_by).length > 30) return "Usuario del sistema"
  return String(incident.reported_by ?? "Usuario desconocido")
}

interface IncidentsListProps {
  incidents: Record<string, unknown>[]
  assets: Record<string, unknown>[]
  searchTerm: string
  statusFilter: string
  typeFilter: string
  priorityFilter: string
}

export function IncidentsList({
  incidents,
  assets,
  searchTerm,
  statusFilter,
  typeFilter,
  priorityFilter,
}: IncidentsListProps) {
  const hasFilters =
    searchTerm || statusFilter !== "all" || typeFilter !== "all" || priorityFilter !== "all"

  const emptyMessage = hasFilters
    ? "No hay incidentes con estos filtros"
    : "No hay incidentes registrados en el sistema"
  const emptySubtext = hasFilters
    ? "Prueba ajustando los filtros"
    : "Los incidentes aparecerán cuando se reporten desde checklists o manualmente"

  const IncidentCard = ({ incident }: { incident: Record<string, unknown> }) => {
    const statusInfo = getStatusInfo(String(incident.status ?? ""))
    const typeInfo = getTypeInfo(String(incident.type ?? ""))
    const daysSince = getDaysSinceCreated(String(incident.created_at ?? ""))
    const priority = getPriorityInfo(String(incident.status ?? ""), daysSince)
    const StatusIcon = statusInfo.icon
    const TypeIcon = typeInfo.icon
    const PriorityIcon = priority.icon

    return (
      <Card
        className={`mb-4 rounded-2xl border-l-4 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
          priority.level === "critical"
            ? "border-l-red-500"
            : priority.level === "high"
              ? "border-l-orange-500"
              : priority.level === "medium"
                ? "border-l-yellow-500"
                : "border-l-green-500"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant} className={`${statusInfo.color} flex items-center gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </Badge>
              <Badge
                variant={priority.level === "critical" ? "destructive" : "outline"}
                className={`${priority.color} flex items-center gap-1`}
              >
                <PriorityIcon className="h-3 w-3" />
                {priority.label}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(incident.date as string)}
            </div>
          </div>
          <div className="mb-3">
            <Badge variant={typeInfo.variant} className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
              <TypeIcon className="h-3 w-3" />
              {String(incident.type ?? "—")}
            </Badge>
          </div>
          <div className="mb-3">
            {incident.work_order_id ? (
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">
                OT vinculada
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                Pendiente de evaluar OT
              </Badge>
            )}
          </div>
          <Link
            href={`/activos/${incident.asset_id}`}
            className="block font-medium text-blue-600 hover:underline mb-2"
            title={getAssetFullName(incident, assets)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold">{getAssetName(incident, assets)}</div>
            <div className="text-xs text-gray-500 font-normal truncate max-w-[200px]">
              {getAssetFullName(incident, assets)}
            </div>
          </Link>
          <p
            className="text-sm text-gray-600 mb-3 line-clamp-2"
            title={String(incident.description ?? "")}
          >
            {String(incident.description ?? "—")}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{getReporterName(incident)}</span>
            </div>
            {incident.downtime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {incident.downtime} hrs
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {daysSince} días
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1 cursor-pointer">
              <Link href={`/incidentes/${incident.id}`}>
                <Eye className="h-4 w-4 mr-1" />
                Revisar
              </Link>
            </Button>
            {incident.work_order_id ? (
              <Button variant="default" size="sm" asChild className="flex-1 cursor-pointer">
                <Link href={`/ordenes/${incident.work_order_id}`}>
                  <Wrench className="h-4 w-4 mr-1" />
                  {incident.work_order_order_id
                    ? `Ver OT #${incident.work_order_order_id}`
                    : "Ver OT"}
                </Link>
              </Button>
            ) : (
              <Badge variant="outline" className="self-center border-amber-200 bg-amber-50 text-xs text-amber-800">
                Sin OT
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="md:hidden space-y-4">
        {incidents.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
            <p className="text-lg font-medium">{emptyMessage}</p>
            <p className="text-muted-foreground">{emptySubtext}</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <IncidentCard key={String(incident.id)} incident={incident} />
          ))
        )}
      </div>
      <div className="hidden md:block">
        {incidents.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-slate-50/80 py-10 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
            <p className="text-lg font-medium">{emptyMessage}</p>
            <p className="text-muted-foreground mb-4">{emptySubtext}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[80px]">Prioridad</TableHead>
                    <TableHead className="w-[100px]">Fecha</TableHead>
                    <TableHead className="w-[150px]">Activo</TableHead>
                    <TableHead className="w-[100px]">Tipo</TableHead>
                    <TableHead className="w-[120px]">Reportado por</TableHead>
                    <TableHead className="min-w-[200px]">Descripción</TableHead>
                    <TableHead className="w-[80px]">T. Inactivo</TableHead>
                    <TableHead className="w-[120px]">OT</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => {
                    const statusInfo = getStatusInfo(String(incident.status ?? ""))
                    const typeInfo = getTypeInfo(String(incident.type ?? ""))
                    const daysSince = getDaysSinceCreated(String(incident.created_at ?? ""))
                    const priority = getPriorityInfo(String(incident.status ?? ""), daysSince)
                    const StatusIcon = statusInfo.icon
                    const PriorityIcon = priority.icon

                    return (
                      <TableRow key={String(incident.id)} className="hover:bg-slate-50/70">
                        <TableCell className="p-2">
                          <Badge
                            variant={statusInfo.variant}
                            className={`${statusInfo.color} flex items-center gap-1 w-fit text-xs`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge
                            variant={priority.level === "critical" ? "destructive" : "outline"}
                            className={`${priority.color} flex items-center gap-1 w-fit text-xs`}
                          >
                            <PriorityIcon className="h-3 w-3" />
                            {priority.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2 text-sm">
                          {format(new Date(incident.date as string), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/activos/${incident.asset_id}`}
                            className="text-blue-600 hover:underline block"
                            title={getAssetFullName(incident, assets)}
                          >
                            <div className="font-semibold text-sm">{getAssetName(incident, assets)}</div>
                            <div className="text-xs text-gray-500 truncate max-w-[140px]">
                              {getAssetFullName(incident, assets)}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="p-2">
                          <Badge variant={typeInfo.variant} className={`${typeInfo.color} text-xs`}>
                            {String(incident.type ?? "—")}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-2">
                          <div
                            className="text-sm truncate max-w-[120px]"
                            title={getReporterName(incident)}
                          >
                            {getReporterName(incident)}
                          </div>
                        </TableCell>
                        <TableCell className="p-2">
                          <div
                            className="text-sm max-w-[250px] line-clamp-2"
                            title={String(incident.description ?? "")}
                          >
                            {String(incident.description ?? "—")}
                          </div>
                        </TableCell>
                        <TableCell className="p-2 text-sm">
                          {incident.downtime ? `${incident.downtime}h` : "—"}
                        </TableCell>
                        <TableCell className="p-2">
                          {incident.work_order_id ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-xs text-green-800">
                              OT vinculada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-800">
                              Evaluar OT
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" asChild className="h-8 px-2 cursor-pointer">
                              <Link href={`/incidentes/${incident.id}`}>
                                <Eye className="h-3 w-3" />
                                <span className="hidden lg:inline ml-1">Revisar</span>
                              </Link>
                            </Button>
                            {incident.work_order_id && (
                              <Button variant="default" size="sm" asChild className="h-8 px-2 cursor-pointer">
                                <Link href={`/ordenes/${incident.work_order_id}`}>
                                  <Wrench className="h-3 w-3" />
                                  <span className="hidden lg:inline ml-1">
                                    {incident.work_order_order_id
                                      ? `Ver OT #${incident.work_order_order_id}`
                                      : "Ver OT"}
                                  </span>
                                </Link>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
