"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DepartmentSelector } from "@/components/ui/department-selector"
import {
  PIPELINE_STAGE_LABELS,
  type RoutedIncident,
} from "@/lib/incidents/incident-routing"
import { getStatusInfo } from "@/components/incidents/incidents-status-utils"

export function DepartmentInboxTab() {
  const [departmentId, setDepartmentId] = useState("")
  const [incidents, setIncidents] = useState<RoutedIncident[]>([])
  const [loading, setLoading] = useState(false)

  const loadInbox = useCallback(async () => {
    if (!departmentId) {
      setIncidents([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/incidents/routed?department_id=${encodeURIComponent(departmentId)}`,
      )
      if (res.ok) setIncidents(await res.json())
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    void loadInbox()
  }, [loadInbox])

  const stats = useMemo(() => {
    const slaBreached = incidents.filter((i) => i.sla_breached).length
    const unassigned = incidents.filter((i) => !i.assigned_to_id).length
    return { total: incidents.length, slaBreached, unassigned }
  }, [incidents])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Bandeja por departamento</CardTitle>
          <CardDescription>
            Incidentes abiertos enrutados al departamento seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <DepartmentSelector
              label="Departamento"
              value={departmentId}
              onValueChange={setDepartmentId}
              showPlantName
            />
          </div>
          <Button
            variant="outline"
            onClick={() => void loadInbox()}
            disabled={!departmentId || loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {departmentId && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats.total}</strong> en bandeja
          </span>
          <span>
            <strong className="text-foreground">{stats.unassigned}</strong> sin responsable
          </span>
          {stats.slaBreached > 0 && (
            <span className="text-red-600">
              <strong>{stats.slaBreached}</strong> fuera de SLA
            </span>
          )}
        </div>
      )}

      {!departmentId ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Selecciona un departamento para ver su bandeja de incidentes.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay incidentes abiertos enrutados a este departamento.
        </p>
      ) : (
        <div className="grid gap-3">
          {incidents.map((incident) => {
            const statusInfo = getStatusInfo(String(incident.status ?? ""))
            const stage = incident.pipeline_stage ?? "bandeja"
            return (
              <Card
                key={incident.id}
                className={incident.sla_breached ? "border-red-300 bg-red-50/40" : undefined}
              >
                <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{incident.type}</Badge>
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      <Badge variant="secondary">
                        {PIPELINE_STAGE_LABELS[stage] ?? stage}
                      </Badge>
                      {incident.sla_breached && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          SLA
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium line-clamp-2">{incident.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {incident.asset_code} · {incident.asset_display_name}
                      {incident.assignee_name ? ` · ${incident.assignee_name}` : " · Sin asignar"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {incident.date
                        ? format(new Date(incident.date), "dd MMM yyyy", { locale: es })
                        : "—"}
                      {incident.hours_since_routed != null &&
                        ` · ${incident.hours_since_routed}h desde ruteo`}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={`/incidentes/${incident.id}`}>
                      Ver
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
