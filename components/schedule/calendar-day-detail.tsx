"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Wrench,
  Shield,
  FileText
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import type { UpcomingMaintenance, WarrantyEvent, WorkOrderEvent } from "@/types/calendar"

interface CalendarDayDetailProps {
  date: Date
  maintenances: UpcomingMaintenance[]
  warrantyEvents?: WarrantyEvent[]
  workOrderEvents?: WorkOrderEvent[]
  onSelectMaintenance?: (m: UpcomingMaintenance) => void
  selectedMaintenance: UpcomingMaintenance | null
}

function getStatusBadge(status: string, urgency: string) {
  switch (status) {
    case "overdue":
      return (
        <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-semibold rounded-full border border-red-200">
          <AlertTriangle className="h-3 w-3" />
          {urgency === "high" ? "Muy Vencido" : "Vencido"}
        </Badge>
      )
    case "upcoming":
      return (
        <Badge className="flex items-center gap-1 text-[10px] font-semibold rounded-full border border-amber-200 bg-amber-50 text-amber-700">
          <AlertCircle className="h-3 w-3" />
          Próximo
        </Badge>
      )
    case "covered":
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-[10px] font-semibold rounded-full text-blue-600 border-blue-200 bg-blue-50">
          <Info className="h-3 w-3" />
          Cubierto
        </Badge>
      )
    case "scheduled":
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-[10px] font-semibold rounded-full text-green-600 border-green-200 bg-green-50">
          <CheckCircle2 className="h-3 w-3" />
          Programado
        </Badge>
      )
    default:
      return null
  }
}

function getProgramarHref(m: UpcomingMaintenance): string {
  const base = `/activos/${m.assetId}/mantenimiento/nuevo?planId=${m.intervalId}`
  const cycleParam = m.unit === "hours" ? `cycleHour=${m.targetValue}` : `cycleKm=${m.targetValue}`
  return `${base}&${cycleParam}`
}

export function CalendarDayDetail({
  date,
  maintenances,
  warrantyEvents = [],
  workOrderEvents = [],
  onSelectMaintenance,
  selectedMaintenance
}: CalendarDayDetailProps) {
  const dateKey = format(date, "yyyy-MM-dd")
  const warrantiesOnDay = warrantyEvents.filter(
    (w) => w.warrantyExpiration.startsWith(dateKey)
  )
  const workOrdersOnDay = workOrderEvents.filter(
    (wo) => wo.plannedDate.startsWith(dateKey)
  )
  const hasAny = maintenances.length > 0 || warrantiesOnDay.length > 0 || workOrdersOnDay.length > 0

  if (!hasAny) {
    return (
      <div className="flex items-center gap-3 px-4 py-5 min-h-[56px]">
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        <span className="text-sm text-muted-foreground">
          Sin actividades programadas para este día
        </span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/40">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-4 py-2">
        {format(date, "d 'de' MMMM 'de' yyyy", { locale: es })}
      </h3>
      {workOrdersOnDay.map((wo) => (
        <div
          key={wo.id}
          className="grid grid-cols-[1fr_auto] gap-2 px-4 sm:px-5 py-3 min-h-[56px] bg-violet-50 border-l-4 border-l-violet-600"
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold">{wo.orderId}</span>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold rounded-full border-violet-200 bg-violet-100 text-violet-700"
              >
                OT {wo.type === "preventive" ? "Preventiva" : "Correctiva"}
              </Badge>
              <span className="text-[10px] text-muted-foreground capitalize">{wo.priority}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-full">
              {wo.assetCode || "Sin activo"} · {wo.description?.slice(0, 50) || "—"}
            </div>
          </div>
          <Link
            href={`/ordenes/${wo.id}`}
            className="self-center text-sm font-medium text-primary hover:underline shrink-0"
          >
            Ver OT →
          </Link>
        </div>
      ))}
      {maintenances.map((m) => (
        <div
          key={m.id}
          className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1.5rem_1fr_auto] gap-2 px-4 sm:px-5 py-3 min-h-[56px] cursor-pointer transition-colors hover:bg-muted/20 ${
            selectedMaintenance?.id === m.id ? "bg-muted/30" : ""
          }`}
          onClick={() => onSelectMaintenance?.(m)}
        >
          <div className="hidden sm:block text-xs text-muted-foreground shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold truncate">{m.assetCode}</span>
              {getStatusBadge(m.status, m.urgency)}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-full">
              {m.assetName} · {m.intervalType}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={m.status === "covered" ? "outline" : "default"}
              disabled={m.status === "covered"}
              className="min-h-[36px]"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={getProgramarHref(m)}>
                <Wrench className="h-3 w-3 mr-2" />
                {m.status === "covered" ? "Cubierto" : m.status === "overdue" ? "Registrar" : "Programar"}
              </Link>
            </Button>
          </div>
        </div>
      ))}
      {warrantiesOnDay.map((w) => (
        <div
          key={w.id}
          className="grid grid-cols-[1fr_auto] gap-2 px-4 sm:px-5 py-3 min-h-[56px] bg-slate-50 border-l-4 border-l-slate-400"
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-semibold">{w.assetCode}</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold rounded-full ${
                  w.status === "expired"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : w.status === "expiring_soon"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                Garantía {w.status === "expired" ? "vencida" : w.status === "expiring_soon" ? "por vencer" : "activa"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{w.assetName}</div>
          </div>
          <Link
            href={`/activos/${w.assetId}`}
            className="self-center text-sm font-medium text-primary hover:underline shrink-0"
          >
            Ver activo →
          </Link>
        </div>
      ))}
    </div>
  )
}
