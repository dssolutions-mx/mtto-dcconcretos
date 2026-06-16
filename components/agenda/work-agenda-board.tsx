"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addWeeks, endOfWeek, format, parseISO, startOfWeek, subWeeks } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, CalendarPlus, Printer, Wrench } from "lucide-react"
import { AgendaDayDetailPanel } from "@/components/agenda/agenda-day-detail-panel"
import { PlanWorkOrderDialog, type PlanWorkOrderSummary } from "@/components/agenda/plan-work-order-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatAgendaDayLabel,
  getWeekBounds,
  groupAgendaByDay,
  ORIGIN_LABELS,
  type AgendaWorkOrder,
} from "@/lib/agenda/agenda-utils"
import { cn } from "@/lib/utils"

interface Technician {
  id: string
  name: string
}

interface WorkAgendaBoardProps {
  initialTechnicianId?: string
}

export function WorkAgendaBoard({ initialTechnicianId }: WorkAgendaBoardProps) {
  const [anchor, setAnchor] = useState(() => new Date())
  const [technicianId, setTechnicianId] = useState(initialTechnicianId ?? "all")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [scheduled, setScheduled] = useState<AgendaWorkOrder[]>([])
  const [unscheduled, setUnscheduled] = useState<AgendaWorkOrder[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [planningOrder, setPlanningOrder] = useState<PlanWorkOrderSummary | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  )
  const bounds = useMemo(() => getWeekBounds(anchor), [anchor])
  const today = useMemo(() => new Date(), [])
  const todayKey = format(today, "yyyy-MM-dd")

  const loadAgenda = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      from: bounds.from,
      to: bounds.to,
      include_unscheduled: "true",
    })
    if (technicianId && technicianId !== "all") {
      params.set("assigned_to", technicianId)
    }

    try {
      const res = await fetch(`/api/work-orders/agenda?${params}`)
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      setScheduled(data.scheduled ?? [])
      setUnscheduled(data.unscheduled ?? [])
      setTechnicians(data.technicians ?? [])
    } catch {
      setScheduled([])
      setUnscheduled([])
    } finally {
      setLoading(false)
    }
  }, [bounds.from, bounds.to, technicianId])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

  useEffect(() => {
    if (!selectedDay) {
      setSelectedDay(todayKey)
    }
  }, [selectedDay, todayKey])

  const byDay = useMemo(
    () => groupAgendaByDay(scheduled, weekStart),
    [scheduled, weekStart],
  )

  const weekLabel = format(weekStart, "d MMM", { locale: es })
  const weekEndLabel = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })

  const openPlanDialog = (wo: AgendaWorkOrder, defaultDate?: string) => {
    setPlanningOrder({
      id: wo.id,
      order_id: wo.order_id,
      description: wo.description,
      priority: wo.priority,
      status: wo.status,
      planned_date: wo.planned_date,
      assigned_to: wo.assigned_to,
      asset_code: wo.asset_code,
      asset_name: wo.asset_name,
      origin: wo.origin,
      technician_name: wo.technician_name,
    })
    if (defaultDate) {
      setSelectedDay(defaultDate)
    }
    setPlanDialogOpen(true)
  }

  const hojaHref =
    technicianId && technicianId !== "all"
      ? `/ordenes/agenda/hoja?technician=${technicianId}&from=${bounds.from}&to=${bounds.to}`
      : `/ordenes/agenda/hoja?from=${bounds.from}&to=${bounds.to}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(subWeeks(anchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[10rem] text-center">
            {weekLabel} – {weekEndLabel}
          </div>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos los técnicos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los técnicos</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild>
            <Link href={hojaHref} target="_blank">
              <Printer className="h-4 w-4 mr-2" />
              Hoja de trabajo
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {[...byDay.entries()].map(([dayKey, items]) => (
              <Card
                key={dayKey}
                className={cn(
                  "min-h-[12rem] cursor-pointer transition-shadow hover:shadow-md",
                  selectedDay === dayKey && "ring-2 ring-primary",
                )}
                onClick={() => setSelectedDay(dayKey)}
              >
                <CardHeader className="py-3 px-3">
                  <CardTitle className="text-xs font-semibold capitalize">
                    {formatAgendaDayLabel(dayKey, today)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin trabajos</p>
                  ) : (
                    items.map((wo) => (
                      <AgendaCard
                        key={wo.id}
                        workOrder={wo}
                        onPlan={() => openPlanDialog(wo, dayKey)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedDay && (
            <AgendaDayDetailPanel date={selectedDay} technicianId={technicianId} />
          )}

          {unscheduled.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Sin programar ({unscheduled.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unscheduled.map((wo) => (
                  <AgendaCard
                    key={wo.id}
                    workOrder={wo}
                    showScheduleHint
                    onPlan={() => openPlanDialog(wo, selectedDay ?? todayKey)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <PlanWorkOrderDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        workOrder={planningOrder}
        defaultPlannedDate={selectedDay ?? todayKey}
        onSaved={loadAgenda}
      />
    </div>
  )
}

function AgendaCard({
  workOrder: wo,
  showScheduleHint,
  onPlan,
}: {
  workOrder: AgendaWorkOrder
  showScheduleHint?: boolean
  onPlan?: () => void
}) {
  const priorityClass =
    wo.priority === "Alta"
      ? "border-red-200 bg-red-50"
      : wo.priority === "Media"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-muted/30"

  return (
    <div
      className={cn(
        "rounded-md border p-2 text-xs transition-colors",
        priorityClass,
      )}
    >
      <button
        type="button"
        className="w-full text-left hover:opacity-90"
        onClick={(e) => {
          e.stopPropagation()
          onPlan?.()
        }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="font-semibold">{wo.order_id}</span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {ORIGIN_LABELS[wo.origin]}
          </Badge>
        </div>
        <p className="text-muted-foreground truncate mt-0.5">
          {wo.asset_code ?? wo.asset_name ?? "Sin activo"}
        </p>
        <p className="line-clamp-2 mt-1">{wo.description}</p>
        {wo.technician_name && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {wo.technician_name}
          </p>
        )}
        {showScheduleHint && (
          <p className="text-amber-700 mt-1 font-medium">Pendiente de fecha</p>
        )}
        {wo.hours_open != null && wo.origin === "incident" && wo.hours_open >= 3 && (
          <p className="text-red-700 mt-1">{wo.hours_open}d abierto</p>
        )}
      </button>
      <div className="mt-2 flex items-center gap-2">
        {onPlan && (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-[11px] px-2"
            onClick={(e) => {
              e.stopPropagation()
              onPlan()
            }}
          >
            <CalendarPlus className="h-3 w-3 mr-1" />
            Planificar
          </Button>
        )}
        <Link
          href={`/ordenes/${wo.id}`}
          className="text-[11px] text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Ver OT
        </Link>
      </div>
    </div>
  )
}
