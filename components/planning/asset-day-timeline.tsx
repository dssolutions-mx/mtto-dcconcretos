"use client"

import { useMemo } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPlantTime } from "@/lib/agenda/planning-datetime"
import {
  PLANNING_STATUS_LABELS,
  type PlanningCalendarEvent,
} from "@/lib/planning/planning-types"
import { getAssetStatusConfig } from "@/lib/utils/asset-status"
import { cn } from "@/lib/utils"

const DAY_START_HOUR = 5
const DAY_END_HOUR = 21
const HOUR_HEIGHT_PX = 28

interface AssetDayTimelineProps {
  day: string
  events: PlanningCalendarEvent[]
  onSelectDay?: (day: string) => void
}

export function AssetDayTimeline({ day, events }: AssetDayTimelineProps) {
  const dayEvents = useMemo(
    () =>
      events
        .filter((ev) => ev.starts_at.slice(0, 10) <= day && ev.ends_at.slice(0, 10) >= day)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [events, day],
  )

  const byAsset = useMemo(() => {
    const map = new Map<string, PlanningCalendarEvent[]>()
    for (const ev of dayEvents) {
      const key = ev.asset_code ?? ev.asset_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [dayEvents])

  const dayLabel = format(parseISO(day), "EEEE d MMMM", { locale: es })
  const totalHours = DAY_END_HOUR - DAY_START_HOUR

  if (byAsset.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Sin ventanas de servicio el {dayLabel}.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Línea de tiempo — {dayLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-auto">
        {byAsset.map(([assetKey, assetEvents]) => {
          const assetStatus = assetEvents[0]?.asset_status ?? "operational"
          const statusCfg = getAssetStatusConfig(assetStatus)

          return (
            <div key={assetKey} className="min-w-[640px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">{assetKey}</span>
                <Badge variant={statusCfg.variant} className="text-[10px]">
                  {statusCfg.label}
                </Badge>
              </div>
              <div className="flex gap-2">
                <div
                  className="w-10 shrink-0 text-[10px] text-muted-foreground"
                  style={{ height: totalHours * HOUR_HEIGHT_PX }}
                >
                  {Array.from({ length: totalHours + 1 }, (_, i) => DAY_START_HOUR + i).map(
                    (h) => (
                      <div
                        key={h}
                        className="relative"
                        style={{ height: i < totalHours ? HOUR_HEIGHT_PX : 0 }}
                      >
                        <span className="absolute -top-1.5 right-1">{String(h).padStart(2, "0")}</span>
                      </div>
                    ),
                  )}
                </div>
                <div
                  className="relative flex-1 rounded-md border bg-muted/20"
                  style={{ height: totalHours * HOUR_HEIGHT_PX }}
                >
                  {Array.from({ length: totalHours }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: i * HOUR_HEIGHT_PX }}
                    />
                  ))}
                  {assetEvents.map((ev) => (
                    <TimelineBlock key={`${ev.event_type}-${ev.event_id}`} event={ev} />
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function TimelineBlock({ event: ev }: { event: PlanningCalendarEvent }) {
  const start = new Date(ev.starts_at)
  const end = new Date(ev.ends_at)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const gridStart = DAY_START_HOUR * 60
  const gridEnd = DAY_END_HOUR * 60
  const clampedStart = Math.max(startMinutes, gridStart)
  const clampedEnd = Math.min(endMinutes, gridEnd)
  const top = ((clampedStart - gridStart) / 60) * HOUR_HEIGHT_PX
  const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT_PX, 20)

  const isWindow = ev.event_type === "service_window"
  const statusLabel = isWindow
    ? (PLANNING_STATUS_LABELS[ev.status as keyof typeof PLANNING_STATUS_LABELS] ?? ev.status)
    : ev.status

  return (
    <div
      className={cn(
        "absolute left-1 right-1 rounded px-2 py-1 text-[10px] overflow-hidden border shadow-sm",
        isWindow ? "bg-blue-100 border-blue-300" : "bg-white border-border",
      )}
      style={{ top, height }}
      title={`${ev.work_order_label ?? "Ventana"} ${formatPlantTime(ev.starts_at)} – ${formatPlantTime(ev.ends_at)}`}
    >
      <div className="font-semibold truncate">
        {isWindow ? "Ventana" : `OT ${ev.work_order_label}`}
      </div>
      <div className="text-muted-foreground">
        {formatPlantTime(ev.starts_at)} – {formatPlantTime(ev.ends_at)}
      </div>
      <div className="text-muted-foreground">{statusLabel}</div>
      {ev.work_order_id && (
        <Button variant="link" className="h-auto p-0 text-[10px]" asChild>
          <Link href={`/ordenes/${ev.work_order_id}`}>Ejecutar</Link>
        </Button>
      )}
    </div>
  )
}

interface WeekDayPickerProps {
  weekStart: Date
  selectedDay: string
  onSelectDay: (day: string) => void
  eventCounts: Map<string, number>
}

export function WeekDayPicker({
  weekStart,
  selectedDay,
  onSelectDay,
  eventCounts,
}: WeekDayPickerProps) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return format(d, "yyyy-MM-dd")
    })
  }, [weekStart])

  return (
    <div className="flex flex-wrap gap-2">
      {days.map((day) => {
        const count = eventCounts.get(day) ?? 0
        const label = format(parseISO(day), "EEE d", { locale: es })
        return (
          <Button
            key={day}
            type="button"
            size="sm"
            variant={selectedDay === day ? "default" : "outline"}
            className="text-xs"
            onClick={() => onSelectDay(day)}
          >
            {label}
            {count > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {count}
              </Badge>
            )}
          </Button>
        )
      })}
    </div>
  )
}
