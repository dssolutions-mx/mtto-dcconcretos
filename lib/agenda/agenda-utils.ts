import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
} from "date-fns"
import { es } from "date-fns/locale"

export interface AgendaWorkOrder {
  id: string
  order_id: string
  description: string
  priority: string | null
  status: string
  planned_date: string | null
  assigned_to: string | null
  incident_id: string | null
  asset_id: string | null
  asset_name: string | null
  asset_code: string | null
  asset_status: string | null
  technician_name: string | null
  estimated_duration: number | null
  planned_start_at: string | null
  planned_end_at: string | null
  service_window_id: string | null
  ops_notified: boolean
  production_conflict_count: number | null
  origin: "incident" | "checklist" | "preventive" | "manual"
  incident_created_at: string | null
  incident_status: string | null
  hours_open: number | null
}

export function getWeekBounds(anchor: Date): { from: string; to: string } {
  const from = startOfWeek(anchor, { weekStartsOn: 1 })
  const to = endOfWeek(anchor, { weekStartsOn: 1 })
  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
  }
}

export function groupAgendaByDay(
  items: AgendaWorkOrder[],
  weekStart: Date,
): Map<string, AgendaWorkOrder[]> {
  const map = new Map<string, AgendaWorkOrder[]>()
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i)
    map.set(format(day, "yyyy-MM-dd"), [])
  }

  for (const item of items) {
    if (!item.planned_date) continue
    const dayKey = item.planned_date.slice(0, 10)
    if (!map.has(dayKey)) map.set(dayKey, [])
    map.get(dayKey)!.push(item)
  }

  for (const [, list] of map) {
    list.sort((a, b) => {
      const prio = (p: string | null) =>
        p === "Alta" ? 0 : p === "Media" ? 1 : 2
      const pd = prio(a.priority) - prio(b.priority)
      if (pd !== 0) return pd
      return (a.order_id ?? "").localeCompare(b.order_id ?? "")
    })
  }

  return map
}

export function formatAgendaDayLabel(dateStr: string, today: Date): string {
  const d = parseISO(dateStr)
  const label = format(d, "EEE d MMM", { locale: es })
  if (isSameDay(d, today)) return `Hoy · ${label}`
  return label
}

export function inferWorkOrderOrigin(wo: {
  incident_id?: string | null
  checklist_id?: string | null
  maintenance_plan_id?: string | null
}): AgendaWorkOrder["origin"] {
  if (wo.incident_id) return "incident"
  if (wo.checklist_id) return "checklist"
  if (wo.maintenance_plan_id) return "preventive"
  return "manual"
}

export const ORIGIN_LABELS: Record<AgendaWorkOrder["origin"], string> = {
  incident: "Incidente",
  checklist: "Checklist",
  preventive: "Preventivo",
  manual: "Manual",
}
