"use client"

import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { frequencyLabel } from "./schedule-labels"
import type { PendingSchedule } from "./types"

type ExistingSchedulesAlertProps = {
  pendingSchedules: PendingSchedule[]
  templateId?: string
  loading?: boolean
}

function formatScheduleDate(schedule: PendingSchedule): string {
  const raw = schedule.scheduled_day ?? schedule.scheduled_date
  if (!raw) return "Sin fecha"
  try {
    const date = raw.includes("T") ? parseISO(raw) : parseISO(`${raw}T12:00:00`)
    return format(date, "PPP", { locale: es })
  } catch {
    return raw
  }
}

export function ExistingSchedulesAlert({
  pendingSchedules,
  templateId,
  loading = false,
}: ExistingSchedulesAlertProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Revisando programaciones existentes…
      </div>
    )
  }

  if (pendingSchedules.length === 0) return null

  const duplicate =
    templateId &&
    pendingSchedules.some((schedule) => schedule.template_id === templateId)

  const monthlyPlantaDuplicates = pendingSchedules.filter(
    (schedule) => schedule.checklists?.frequency === "mensual"
  )

  return (
    <Alert
      variant={duplicate ? "destructive" : "default"}
      className={
        duplicate
          ? undefined
          : "border-amber-300/70 bg-amber-50/60 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
      }
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {duplicate
          ? "Ya existe una programación pendiente con esta plantilla"
          : `${pendingSchedules.length} programación(es) pendiente(s) para este activo`}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        {duplicate ? (
          <p>
            Evite duplicar el mismo checklist. Revise la lista o elija otra plantilla/fecha.
          </p>
        ) : (
          <p>
            Revise las programaciones activas antes de crear otra, especialmente checklists mensuales de planta.
          </p>
        )}
        <ul className="space-y-1.5 text-sm">
          {pendingSchedules.slice(0, 5).map((schedule) => (
            <li
              key={schedule.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5"
            >
              <span className="font-medium">
                {schedule.checklists?.name ?? "Plantilla"}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {frequencyLabel(schedule.checklists?.frequency)}
              </Badge>
              <span className="text-muted-foreground">
                {formatScheduleDate(schedule)}
              </span>
              {schedule.profiles ? (
                <span className="text-muted-foreground">
                  · {schedule.profiles.nombre} {schedule.profiles.apellido}
                </span>
              ) : null}
              {templateId && schedule.template_id === templateId ? (
                <Badge variant="destructive" className="text-[10px]">
                  Misma plantilla
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
        {pendingSchedules.length > 5 ? (
          <p className="text-xs text-muted-foreground">
            y {pendingSchedules.length - 5} más…
          </p>
        ) : null}
        {monthlyPlantaDuplicates.length > 0 && !duplicate ? (
          <p className="text-xs">
            Incluye {monthlyPlantaDuplicates.length} checklist(s) mensual(es) pendiente(s).
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
