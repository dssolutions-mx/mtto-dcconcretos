"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addWeeks,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Printer,
  Truck,
  Wrench,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WorkAgendaBoard } from "@/components/agenda/work-agenda-board"
import { ScheduleWorkOrderDialog } from "@/components/agenda/schedule-work-order-dialog"
import {
  formatAgendaDayLabel,
  getWeekBounds,
  groupAgendaByDay,
  ORIGIN_LABELS,
  type AgendaWorkOrder,
} from "@/lib/agenda/agenda-utils"
import {
  PLANNING_STATUS_LABELS,
  type PlanningCalendarEvent,
} from "@/lib/planning/planning-types"
import { getAssetStatusConfig } from "@/lib/utils/asset-status"
import { cn } from "@/lib/utils"

export function PlanningCenter() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [view, setView] = useState<"week" | "assets" | "queue">("week")
  const [calendarEvents, setCalendarEvents] = useState<PlanningCalendarEvent[]>([])
  const [unscheduled, setUnscheduled] = useState<AgendaWorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [scheduleTarget, setScheduleTarget] = useState<AgendaWorkOrder | null>(null)

  const bounds = useMemo(() => getWeekBounds(anchor), [anchor])
  const weekStart = useMemo(() => startOfWeek(anchor, { weekStartsOn: 1 }), [anchor])
  const today = useMemo(() => new Date(), [])

  const loadPlanning = useCallback(async () => {
    setLoading(true)
    try {
      const [calRes, agendaRes] = await Promise.all([
        fetch(`/api/planning/service-windows?from=${bounds.from}&to=${bounds.to}`),
        fetch(`/api/work-orders/agenda?from=${bounds.from}&to=${bounds.to}&include_unscheduled=true`),
      ])
      const calData = calRes.ok ? await calRes.json() : { events: [] }
      const agendaData = agendaRes.ok ? await agendaRes.json() : { unscheduled: [] }
      setCalendarEvents(calData.events ?? [])
      setUnscheduled(agendaData.unscheduled ?? [])
    } catch {
      setCalendarEvents([])
      setUnscheduled([])
    } finally {
      setLoading(false)
    }
  }, [bounds.from, bounds.to])

  useEffect(() => {
    loadPlanning()
  }, [loadPlanning])

  const eventsByAsset = useMemo(() => {
    const map = new Map<string, PlanningCalendarEvent[]>()
    for (const ev of calendarEvents) {
      const key = ev.asset_code ?? ev.asset_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [calendarEvents])

  const weekLabel = format(weekStart, "d MMM", { locale: es })
  const weekEndLabel = format(addWeeks(weekStart, 1), "d MMM yyyy", { locale: es })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(subWeeks(anchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[10rem] text-center">
            {weekLabel} – {weekEndLabel}
          </span>
          <Button variant="outline" size="icon" onClick={() => setAnchor(addWeeks(anchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/ordenes/agenda/hoja?from=${bounds.from}&to=${bounds.to}`} target="_blank">
              <Printer className="h-4 w-4 mr-2" />
              Hoja de trabajo
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="week">Semana (mecánicos)</TabsTrigger>
          <TabsTrigger value="assets">Por activo</TabsTrigger>
          <TabsTrigger value="queue">
            Sin programar
            {unscheduled.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unscheduled.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4">
          <WorkAgendaBoard />
        </TabsContent>

        <TabsContent value="assets" className="mt-4 space-y-4">
          {loading ? (
            <div className="h-48 rounded-lg bg-muted animate-pulse" />
          ) : eventsByAsset.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay ventanas de servicio ni OTs programadas esta semana.
              </CardContent>
            </Card>
          ) : (
            eventsByAsset.map(([assetKey, events]) => (
              <AssetPlanningLane key={assetKey} assetKey={assetKey} events={events} />
            ))
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Cola de programación ({unscheduled.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unscheduled.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todo programado.</p>
              ) : (
                unscheduled.map((wo) => (
                  <QueueCard
                    key={wo.id}
                    workOrder={wo}
                    onSchedule={() => setScheduleTarget(wo)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {scheduleTarget && (
        <ScheduleWorkOrderDialog
          open={!!scheduleTarget}
          onOpenChange={(open) => !open && setScheduleTarget(null)}
          workOrderId={scheduleTarget.id}
          workOrderLabel={scheduleTarget.order_id}
          assetId={scheduleTarget.asset_id ?? undefined}
          assetCode={scheduleTarget.asset_code ?? undefined}
          onScheduled={() => {
            setScheduleTarget(null)
            loadPlanning()
          }}
        />
      )}
    </div>
  )
}

function AssetPlanningLane({
  assetKey,
  events,
}: {
  assetKey: string
  events: PlanningCalendarEvent[]
}) {
  const assetStatus = events[0]?.asset_status ?? "operational"
  const statusCfg = getAssetStatusConfig(assetStatus)

  return (
    <Card>
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{assetKey}</CardTitle>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{events.length} evento(s)</span>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {events.map((ev) => (
          <div
            key={`${ev.event_type}-${ev.event_id}`}
            className={cn(
              "rounded-md border p-3 text-xs",
              ev.event_type === "service_window"
                ? "border-blue-200 bg-blue-50/50"
                : "border-border bg-muted/20",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-semibold">
                  {ev.event_type === "service_window"
                    ? "Ventana de servicio"
                    : `OT ${ev.work_order_label}`}
                </span>
                {ev.reason && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {ev.reason}
                  </Badge>
                )}
              </div>
              {ev.ops_notified_at ? (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  <Bell className="h-3 w-3 mr-1" />
                  Ops notificado
                </Badge>
              ) : ev.event_type === "service_window" ? (
                <Badge variant="outline" className="text-amber-700">
                  Sin aviso ops
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(parseISO(ev.starts_at), "EEE d MMM HH:mm", { locale: es })}
              {" – "}
              {format(parseISO(ev.ends_at), "HH:mm", { locale: es })}
            </p>
            <p className="text-muted-foreground">
              Estado:{" "}
              {ev.event_type === "service_window"
                ? PLANNING_STATUS_LABELS[ev.status as keyof typeof PLANNING_STATUS_LABELS] ?? ev.status
                : ev.status}
            </p>
            {ev.work_order_id && (
              <Link
                href={`/ordenes/${ev.work_order_id}`}
                className="text-primary underline mt-1 inline-block"
              >
                Ver orden
              </Link>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function QueueCard({
  workOrder: wo,
  onSchedule,
}: {
  workOrder: AgendaWorkOrder
  onSchedule: () => void
}) {
  const statusCfg = wo.asset_status ? getAssetStatusConfig(wo.asset_status) : null

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{wo.order_id}</span>
          <Badge variant="outline">{ORIGIN_LABELS[wo.origin]}</Badge>
          {statusCfg && <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>}
          {wo.hours_open != null && wo.hours_open >= 3 && (
            <Badge variant="destructive" className="text-[10px]">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {wo.hours_open}d abierto
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {wo.asset_code ?? wo.asset_name} — {wo.description}
        </p>
      </div>
      <Button size="sm" onClick={onSchedule}>
        <Wrench className="h-4 w-4 mr-2" />
        Programar
      </Button>
    </div>
  )
}
