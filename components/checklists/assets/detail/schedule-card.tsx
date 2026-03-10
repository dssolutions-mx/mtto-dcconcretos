"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Calendar, CalendarClock, Eye, Play } from "lucide-react"
import Link from "next/link"
import { getScheduleStatus } from "@/lib/utils/date-utils"

interface ChecklistSchedule {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: string
  assigned_to: string | null
  checklists: {
    id: string
    name: string
    frequency: string
    description?: string | null
  } | null
  profiles: {
    nombre: string | null
    apellido: string | null
  } | null
}

type ScheduleVariant = "overdue" | "today" | "upcoming" | "future"

interface ScheduleCardProps {
  schedule: ChecklistSchedule
  variant: ScheduleVariant
  onReschedule: (scheduleId: string) => void
  formatDate: (dateString: string) => string
  formatRelativeDate: (dateString: string) => string
}

const variantConfig: Record<
  ScheduleVariant,
  {
    borderClass: string
    cardClass: string
    titleClass: string
    subtitleClass: string
    ctaClass: string
    badge: "overdue" | "today" | "upcoming"
  }
> = {
  overdue: {
    borderClass: "border-l-4 border-checklist-status-overdue",
    cardClass: "border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20",
    titleClass: "text-red-800 dark:text-red-200",
    subtitleClass: "text-red-600 dark:text-red-300",
    ctaClass: "bg-checklist-status-overdue hover:bg-checklist-status-overdue/90 text-white",
    badge: "overdue",
  },
  today: {
    borderClass: "border-l-4 border-checklist-status-due",
    cardClass: "border-yellow-300 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/20",
    titleClass: "text-yellow-800 dark:text-yellow-200",
    subtitleClass: "text-yellow-600 dark:text-yellow-300",
    ctaClass: "bg-checklist-status-due hover:bg-checklist-status-due/90 text-white",
    badge: "today",
  },
  upcoming: {
    borderClass: "border-l-4 border-checklist-primary",
    cardClass: "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20",
    titleClass: "text-slate-800 dark:text-slate-200",
    subtitleClass: "text-slate-600 dark:text-slate-300",
    ctaClass: "bg-checklist-cta hover:bg-checklist-cta/90 text-white",
    badge: "upcoming",
  },
  future: {
    borderClass: "border-l-4 border-slate-300 dark:border-slate-600",
    cardClass: "border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20",
    titleClass: "text-slate-800 dark:text-slate-200",
    subtitleClass: "text-slate-600 dark:text-slate-300",
    ctaClass: "bg-checklist-cta hover:bg-checklist-cta/90 text-white",
    badge: "upcoming",
  },
}

function getStatusBadge(
  schedule: ChecklistSchedule,
  formatDate: (s: string) => string
) {
  const scheduleStatus = getScheduleStatus(
    (schedule as { scheduled_day?: string }).scheduled_day ||
      schedule.scheduled_date
  )

  if (scheduleStatus === "overdue") {
    return (
      <Badge
        variant="destructive"
        className="flex items-center gap-1 flex-shrink-0 cursor-default"
      >
        <AlertTriangle className="h-3 w-3" />
        Atrasado
      </Badge>
    )
  }
  if (scheduleStatus === "today") {
    return (
      <Badge
        className="bg-checklist-status-due hover:bg-checklist-status-due/90 text-white flex items-center gap-1 flex-shrink-0 cursor-default"
      >
        <Calendar className="h-3 w-3" />
        Hoy
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1 flex-shrink-0 cursor-default"
    >
      <Calendar className="h-3 w-3" />
      Programado
    </Badge>
  )
}

function ScheduleCardInner({
  schedule,
  variant,
  onReschedule,
  formatDate,
  formatRelativeDate,
}: ScheduleCardProps) {
  const config = variantConfig[variant]
  const scheduledDay =
    (schedule as { scheduled_day?: string }).scheduled_day ||
    schedule.scheduled_date
  const checklistName = schedule.checklists?.name || "Sin nombre"
  const isFuture = variant === "future"

  return (
    <div
      className={`${config.borderClass} pl-4 py-3 bg-background dark:bg-card rounded transition-colors duration-200 hover:bg-muted/30 cursor-default`}
    >
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${config.titleClass}`}>{checklistName}</h4>
          <p className={`text-sm font-medium ${config.subtitleClass}`}>
            {variant === "today"
              ? "Programado para hoy"
              : formatRelativeDate(scheduledDay)}
          </p>
          <p className="text-xs text-muted-foreground">
            {schedule.checklists?.frequency}
            {` • ${formatDate(scheduledDay)}`}
          </p>
        </div>
        {getStatusBadge(schedule, formatDate)}
      </div>

      {schedule.profiles && (
        <p className="text-xs text-muted-foreground mb-2">
          Asignado a: {schedule.profiles.nombre} {schedule.profiles.apellido}
        </p>
      )}

      {!isFuture && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className={`${config.ctaClass} cursor-pointer`} asChild>
            <Link href={`/checklists/ejecutar/${schedule.id}`}>
              <Play className="h-3 w-3 mr-1" />
              {variant === "overdue" ? "Ejecutar Ahora" : "Ejecutar"}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReschedule(schedule.id)}
            className="cursor-pointer transition-colors duration-200"
          >
            <CalendarClock className="h-3 w-3 mr-1" />
            Reprogramar
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link
              href={`/checklists/${schedule.template_id}`}
              className="cursor-pointer transition-colors duration-200"
            >
              <Eye className="h-3 w-3 mr-1" />
              Ver Plantilla
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

export const ScheduleCard = memo(ScheduleCardInner)
