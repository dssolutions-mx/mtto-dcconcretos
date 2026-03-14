"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Eye,
  Gauge,
  Plus,
} from "lucide-react"
import { CompletedChecklistEvidenceViewer } from "@/components/checklists/completed-checklist-evidence-viewer"

interface IncidentsChecklistsTabProps {
  assetId: string
  assetName: string
  incidents: any[]
  incidentsLoading: boolean
  pendingChecklists: any[]
  pendingChecklistsLoading: boolean
  completedChecklists: any[]
  checklistsLoading: boolean
  isPendingIncident: (incident: any) => boolean
  formatDate: (date: string | null) => string
}

export function IncidentsChecklistsTab({
  assetId,
  assetName,
  incidents,
  incidentsLoading,
  pendingChecklists,
  pendingChecklistsLoading,
  completedChecklists,
  checklistsLoading,
  isPendingIncident,
  formatDate,
}: IncidentsChecklistsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-5 w-5" />
            Incidentes Recientes
          </CardTitle>
          <CardDescription>Últimos problemas reportados</CardDescription>
        </CardHeader>
        <CardContent>
          {incidentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500" aria-hidden />
              <h3 className="mt-4 text-base font-medium">Sin incidentes reportados</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                No hay incidentes registrados para este activo.
              </p>
              <Button variant="outline" className="mt-4 cursor-pointer" asChild>
                <Link href={`/activos/${assetId}/incidentes`}>
                  Reportar incidente
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.slice(0, 3).map((incident) => (
                <div
                  key={incident.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-muted/30 transition-colors duration-200 cursor-default"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge
                        variant={incident.type === "Falla" ? "destructive" : "outline"}
                        className="mb-1"
                      >
                        {incident.type}
                      </Badge>
                      <h4 className="font-medium text-sm">{formatDate(incident.date)}</h4>
                    </div>
                    <Badge
                      variant={
                        incident.status?.toLowerCase() === "resuelto" ||
                        incident.status?.toLowerCase() === "resolved"
                          ? "outline"
                          : isPendingIncident(incident)
                            ? "destructive"
                            : "default"
                      }
                      className="flex items-center gap-1"
                    >
                      {incident.status?.toLowerCase() === "resuelto" ||
                      incident.status?.toLowerCase() === "resolved" ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : isPendingIncident(incident) ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {incident.status || "En proceso"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{incident.reported_by}</p>
                  <p className="text-sm mt-1 line-clamp-2">{incident.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                      <Link href={`/incidentes/${incident.id}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        Ver
                      </Link>
                    </Button>
                    {incident.work_order_id && (
                      <Button variant="default" size="sm" className="cursor-pointer" asChild>
                        <Link href={`/ordenes/${incident.work_order_id}`}>
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ver OT {incident.work_order?.order_id ?? "..."}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {incidents.length > 3 && (
                <div className="mt-2 text-center">
                  <Button variant="outline" size="sm" asChild className="cursor-pointer">
                    <Link href={`/activos/${assetId}/incidentes`}>
                      Ver todos ({incidents.length})
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
            <Clock className="h-5 w-5" />
            Checklists Pendientes
          </CardTitle>
          <CardDescription>Inspecciones por realizar</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingChecklistsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : pendingChecklists.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-10 w-10 text-green-500" aria-hidden />
              <h3 className="mt-4 text-base font-medium">Sin checklists pendientes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Todas las inspecciones están al día.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingChecklists.slice(0, 3).map((checklist) => (
                <div
                  key={checklist.id}
                  className="border border-amber-200 rounded-lg p-3 bg-amber-50 hover:bg-amber-100/50 transition-colors duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge variant="default" className="mb-1 bg-amber-500">
                        Pendiente
                      </Badge>
                      <h4 className="font-medium text-sm">
                        {formatDate(checklist.scheduled_date || checklist.created_at)}
                      </h4>
                    </div>
                    <Badge
                      variant={
                        checklist.checklists?.frequency === "diario"
                          ? "default"
                          : checklist.checklists?.frequency === "semanal"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs"
                    >
                      {checklist.checklists?.frequency || "N/A"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">
                    {checklist.checklists?.name || "Sin nombre"}
                  </p>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full cursor-pointer min-h-[44px]"
                      asChild
                    >
                      <Link href={`/checklists/ejecutar/${checklist.id}`}>
                        <Plus className="h-4 w-4 mr-1" />
                        Ejecutar
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {pendingChecklists.length > 3 && (
                <div className="mt-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    {pendingChecklists.length - 3} más pendientes
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-md transition-colors duration-200 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-medium">
            <ClipboardCheck className="h-5 w-5" />
            Checklists Completados
          </CardTitle>
          <CardDescription>Últimas inspecciones realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {checklistsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : completedChecklists.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck
                className="mx-auto h-10 w-10 text-muted-foreground opacity-50"
                aria-hidden
              />
              <h3 className="mt-4 text-base font-medium">Sin checklists completados</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Aún no se han completado inspecciones.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedChecklists.slice(0, 3).map((checklist) => (
                <div
                  key={checklist.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-muted/30 transition-colors duration-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Badge
                        variant="outline"
                        className="mb-1 bg-green-50 border-green-200 text-green-700"
                      >
                        Completado
                      </Badge>
                      <h4 className="font-medium text-sm">
                        {formatDate(checklist.completion_date || checklist.updated_at)}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          checklist.checklists?.frequency === "diario"
                            ? "default"
                            : checklist.checklists?.frequency === "semanal"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs"
                      >
                        {checklist.checklists?.frequency || "N/A"}
                      </Badge>
                      <CompletedChecklistEvidenceViewer
                        completedChecklistId={checklist.id}
                        checklistName={checklist.checklists?.name || "Sin nombre"}
                        completionDate={checklist.completion_date || checklist.updated_at}
                        technician={
                          checklist.profiles
                            ? [checklist.profiles.nombre, checklist.profiles.apellido]
                                .filter(Boolean)
                                .join(" ") || "No especificado"
                            : checklist.technician || "No especificado"
                        }
                        assetName={assetName || "Activo desconocido"}
                        trigger={
                          <Button variant="outline" size="sm" className="h-7 px-2 cursor-pointer">
                            <Camera className="h-3 w-3 mr-1" />
                            <span className="text-xs">Evidencias</span>
                          </Button>
                        }
                      />
                    </div>
                  </div>
                  <p className="text-sm font-medium">{checklist.checklists?.name || "Sin nombre"}</p>
                  <p className="text-sm text-muted-foreground">
                    {checklist.profiles
                      ? [checklist.profiles.nombre, checklist.profiles.apellido]
                          .filter(Boolean)
                          .join(" ") || "No especificado"
                      : checklist.technician || "No especificado"}
                  </p>
                  {(checklist.equipment_hours_reading || checklist.equipment_kilometers_reading) && (
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center gap-4">
                      {checklist.equipment_hours_reading && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {checklist.equipment_hours_reading} horas
                        </span>
                      )}
                      {checklist.equipment_kilometers_reading && (
                        <span className="flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          {checklist.equipment_kilometers_reading} km
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t">
                    <Button size="sm" variant="outline" asChild className="w-full cursor-pointer">
                      <Link href={`/checklists/completado/${checklist.id}`}>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {completedChecklists.length > 3 && (
                <div className="mt-2 text-center">
                  <Button variant="outline" size="sm" asChild className="cursor-pointer">
                    <Link href={`/activos/${assetId}/historial-checklists`}>
                      Ver historial completo ({completedChecklists.length} checklists)
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
