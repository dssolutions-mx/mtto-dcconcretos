"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar, Gauge } from "lucide-react"

export interface WorkOrderScheduleCardProps {
  /** Next due date from maintenance plan */
  nextDue: string | null
  /** Planned date from work order */
  plannedDate: string | null
  /** Cycle number (e.g. 3 for "Ciclo 3") */
  cycle: number | null
  /** Interval in hours (e.g. 500) */
  intervalHours: number | null
  /** Current asset hours */
  currentHours: number | null
  /** Whether cycle/interval are estimated */
  estimated?: boolean
}

export function WorkOrderScheduleCard({
  nextDue,
  plannedDate,
  cycle,
  intervalHours,
  currentHours,
  estimated,
}: WorkOrderScheduleCardProps) {
  const displayDate = nextDue || plannedDate
  const nextCycleHours =
    cycle != null && intervalHours != null ? cycle * intervalHours : null

  return (
    <Card>
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
          Próxima ejecución
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <div className="flex flex-wrap items-center gap-2">
          {cycle != null && (
            <Badge variant="secondary">Ciclo {cycle}</Badge>
          )}
          {intervalHours != null && (
            <Badge variant="outline">Intervalo {intervalHours}h</Badge>
          )}
          {estimated && <Badge variant="outline">Estimado</Badge>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-muted-foreground">Fecha programada</p>
              <p className="font-medium">
                {displayDate
                  ? format(new Date(displayDate), "PPP", { locale: es })
                  : "No planificada"}
              </p>
            </div>
          </div>

          {currentHours != null && nextCycleHours != null && (
            <div className="flex items-start gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-muted-foreground">Horas</p>
                <p className="font-medium">
                  {currentHours} hrs — próximo ciclo a {nextCycleHours}h
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
