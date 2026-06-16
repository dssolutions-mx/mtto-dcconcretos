"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { addWeeks, format, parseISO, startOfWeek, subWeeks } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, Printer, Wrench } from "lucide-react"
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
import { getAssetStatusConfig } from "@/lib/utils/asset-status"
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
  const [scheduled, setScheduled] = useState<AgendaWorkOrder[]>([])
  const [unscheduled, setUnscheduled] = useState<AgendaWorkOrder[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  )
  const bounds = useMemo(() => getWeekBounds(anchor), [anchor])
  const today = useMemo(() => new Date(), [])

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

  const byDay = useMemo(
    () => groupAgendaByDay(scheduled, weekStart),
    [scheduled, weekStart],
  )

  const weekLabel = format(weekStart, "d MMM", { locale: es })
  const weekEndLabel = format(addWeeks(weekStart, 1), "d MMM yyyy", { locale: es })

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
              <Card key={dayKey} className="min-h-[12rem]">
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
                      <AgendaCard key={wo.id} workOrder={wo} />
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

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
                  <AgendaCard key={wo.id} workOrder={wo} showScheduleHint />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function AgendaCard({
  workOrder: wo,
  showScheduleHint,
}: {
  workOrder: AgendaWorkOrder
  showScheduleHint?: boolean
}) {
  const priorityClass =
    wo.priority === "Alta"
      ? "border-red-200 bg-red-50"
      : wo.priority === "Media"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-muted/30"

  return (
    <Link
      href={`/ordenes/${wo.id}`}
      className={cn(
        "block rounded-md border p-2 text-xs transition-colors hover:bg-muted/50",
        priorityClass,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-semibold">{wo.order_id}</span>
        <div className="flex gap-1 shrink-0">
          {wo.asset_status && (
            <Badge variant={getAssetStatusConfig(wo.asset_status).variant} className="text-[10px]">
              {getAssetStatusConfig(wo.asset_status).label}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {ORIGIN_LABELS[wo.origin]}
          </Badge>
        </div>
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
    </Link>
  )
}
