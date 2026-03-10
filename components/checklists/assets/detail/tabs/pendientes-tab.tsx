"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScheduleCard } from "../schedule-card"
import {
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  Clock,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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

interface PendientesTabProps {
  overdue: ChecklistSchedule[]
  today: ChecklistSchedule[]
  upcoming: ChecklistSchedule[]
  future: ChecklistSchedule[]
  onReschedule: (scheduleId: string) => void
  formatDate: (dateString: string) => string
  formatRelativeDate: (dateString: string) => string
  assetId: string
}

export function PendientesTab({
  overdue,
  today,
  upcoming,
  future,
  onReschedule,
  formatDate,
  formatRelativeDate,
  assetId,
}: PendientesTabProps) {
  const totalPending = overdue.length + today.length + upcoming.length + future.length

  if (totalPending === 0) {
    return (
      <Card className="shadow-checklist-2">
        <CardContent className="py-8 text-center">
          <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No hay checklists pendientes
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este activo no tiene checklists programados.
          </p>
          <Button asChild className="bg-checklist-cta hover:bg-checklist-cta/90 cursor-pointer">
            <Link href={`/checklists/programar?asset=${assetId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Programar Primer Checklist
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {(overdue.length > 0 || today.length > 0) && (
        <Alert
          variant="destructive"
          className="shadow-checklist-1 transition-colors duration-200"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {overdue.length > 0 && (
                <p>
                  <strong>{overdue.length}</strong> checklist(s) atrasado(s)
                  requieren atención inmediata
                </p>
              )}
              {today.length > 0 && (
                <p>
                  <strong>{today.length}</strong> checklist(s) programado(s) para
                  hoy
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overdue.length > 0 && (
          <Card className="border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 shadow-checklist-2 transition-shadow duration-200 hover:shadow-checklist-3">
            <CardHeader>
              <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Checklists Atrasados ({overdue.length})
              </CardTitle>
              <CardDescription>Requieren atención inmediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" style={{ contentVisibility: "auto" }}>
                {overdue.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    variant="overdue"
                    onReschedule={onReschedule}
                    formatDate={formatDate}
                    formatRelativeDate={formatRelativeDate}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {today.length > 0 && (
          <Card className="border-yellow-300 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/20 shadow-checklist-2 transition-shadow duration-200 hover:shadow-checklist-3">
            <CardHeader>
              <CardTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Para Hoy ({today.length})
              </CardTitle>
              <CardDescription>Checklists programados para hoy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" style={{ contentVisibility: "auto" }}>
                {today.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    variant="today"
                    onReschedule={onReschedule}
                    formatDate={formatScheduleDate}
                    formatRelativeDate={formatRelativeDate}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {upcoming.length > 0 && (
          <Card className="border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 shadow-checklist-2 transition-shadow duration-200 hover:shadow-checklist-3">
            <CardHeader>
              <CardTitle className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-checklist-primary" />
                Próximos 7 Días ({upcoming.length})
              </CardTitle>
              <CardDescription>
                Checklists programados para la próxima semana
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-3"
                style={{ contentVisibility: "auto" }}
              >
                {upcoming.slice(0, 5).map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    variant="upcoming"
                    onReschedule={onReschedule}
                    formatDate={formatScheduleDate}
                    formatRelativeDate={formatRelativeDate}
                  />
                ))}
                {upcoming.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Y {upcoming.length - 5} más...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {future.length > 0 && (
          <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20 shadow-checklist-2 transition-shadow duration-200 hover:shadow-checklist-3">
            <CardHeader>
              <CardTitle className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Futuro ({future.length})
              </CardTitle>
              <CardDescription>
                Checklists programados para más adelante
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-2"
                style={{ contentVisibility: "auto" }}
              >
                {future.slice(0, 3).map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    variant="future"
                    onReschedule={onReschedule}
                    formatDate={formatScheduleDate}
                    formatRelativeDate={formatRelativeDate}
                  />
                ))}
                {future.length > 3 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Y {future.length - 3} más programados...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
