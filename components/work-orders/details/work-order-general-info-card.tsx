"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Wrench, CalendarCheck, CalendarDays, Clock } from "lucide-react"
import { WorkOrderCostDisplay } from "@/components/work-orders/work-order-cost-display"
import { MaintenanceType, ServiceOrderPriority } from "@/types"

function getTypeVariant(type: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (type) {
    case MaintenanceType.Preventive:
    case "Preventivo":
    case "preventive":
      return "outline"
    case MaintenanceType.Corrective:
    case "Correctivo":
    case "corrective":
      return "destructive"
    default:
      return "secondary"
  }
}

function getPriorityVariant(priority: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (priority) {
    case ServiceOrderPriority.Critical:
      return "destructive"
    case ServiceOrderPriority.High:
      return "secondary"
    default:
      return "outline"
  }
}

export interface CycleContext {
  cycle?: number
  intervalHours?: number
  estimated?: boolean
}

export interface WorkOrderGeneralInfoCardProps {
  type: string | null
  priority: string | null
  description: string | null
  requestedByName: string
  assignedToName: string
  createdAt: string | null
  plannedDate: string | null
  estimatedDuration: number | null
  estimatedCost: number
  requiredPartsCost: number
  purchaseOrders: Array<{ id: string; total_amount?: number | null; actual_amount?: number | null }>
  workOrderId: string
  cycleContext: CycleContext | null
  /** When > 0, description is truncated before "NUEVA OCURRENCIA" blocks (details in Recurrence card) */
  recurrenceCount?: number
}

export function WorkOrderGeneralInfoCard({
  type,
  priority,
  description,
  requestedByName,
  assignedToName,
  createdAt,
  plannedDate,
  estimatedDuration,
  estimatedCost,
  requiredPartsCost,
  purchaseOrders,
  workOrderId,
  cycleContext,
  recurrenceCount = 0,
}: WorkOrderGeneralInfoCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    try {
      return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
      }).format(new Date(dateString))
    } catch {
      return dateString
    }
  }

  const rawDescription = description ?? "—"
  const descriptionWithoutOrigin = rawDescription
    .replace(/(^|\n)ORIGEN:[\s\S]*?(?=NUEVA OCURRENCIA|$)/gi, "")
    .trim()
  const descriptionWithoutOccurrences =
    recurrenceCount > 0 && rawDescription.includes("NUEVA OCURRENCIA")
      ? descriptionWithoutOrigin.split("NUEVA OCURRENCIA")[0].trim()
      : descriptionWithoutOrigin
  const recurrenceNote =
    recurrenceCount > 0
      ? `Detalle de ${recurrenceCount} ocurrencias en el historial de recurrencias`
      : null
  const descriptionLines = descriptionWithoutOccurrences
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const summaryLine = descriptionLines[0] ?? "—"
  const statusLine =
    descriptionLines.find((line, index) => index > 0 && /^(falla detectada|requiere revisi[oó]n|pendiente|resuelto)/i.test(line)) ??
    null
  const observationLine =
    descriptionLines.find((line, index) => index > 0 && /^observaciones:/i.test(line)) ?? null
  const detailLines = descriptionLines.filter(
    (line, index) => index > 0 && line !== statusLine && line !== observationLine
  )

  return (
    <Card>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base">Resumen de la orden</CardTitle>
        <CardDescription className="text-xs">Qué ocurre, qué prioridad tiene y quién debe actuar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Problema reportado
            </p>
            <p className="mt-1 text-lg font-semibold leading-7">{summaryLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getTypeVariant(type)} className="capitalize">
              {type || "N/A"}
            </Badge>
            <Badge variant={getPriorityVariant(priority)} className="capitalize">
              {priority || "N/A"}
            </Badge>
            {cycleContext?.cycle && <Badge variant="secondary">Ciclo {cycleContext.cycle}</Badge>}
            {typeof cycleContext?.intervalHours === "number" && (
              <Badge variant="outline">Intervalo {cycleContext.intervalHours}h</Badge>
            )}
            {cycleContext?.estimated && <Badge variant="outline">Estimado</Badge>}
          </div>

          {statusLine && (
            <p className="text-sm font-medium text-foreground/85">{statusLine}</p>
          )}

          {observationLine && (
            <p className="text-sm text-muted-foreground">{observationLine}</p>
          )}

          {detailLines.length > 0 && (
            <div className="space-y-1">
              {detailLines.map((line) => (
                <p key={line} className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}

          {recurrenceNote && (
            <p className="text-sm text-muted-foreground">{recurrenceNote} ↓</p>
          )}
        </div>

        <Separator className="my-3" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Solicitado por</p>
              <p className="text-sm truncate" title={requestedByName}>{requestedByName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <Wrench className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Técnico asignado</p>
              <p className="text-sm truncate" title={assignedToName}>{assignedToName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Fecha creación</p>
              <p className="text-sm">{formatDate(createdAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Fecha programada</p>
              <p className="text-sm">{plannedDate ? formatDate(plannedDate) : "No planificada"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Duración estimada</p>
              <p className="text-sm">{estimatedDuration ? `${Number(estimatedDuration)} h` : "No especificada"}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 min-w-0">
            <WorkOrderCostDisplay
              estimatedCost={estimatedCost}
              requiredPartsCost={requiredPartsCost}
              purchaseOrders={purchaseOrders}
              workOrderId={workOrderId}
              compact
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
