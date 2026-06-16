"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import {
  groupIncidentsByPipelineStage,
  INCIDENT_PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
  type IncidentPipelineStage,
  type RoutedIncident,
} from "@/lib/incidents/incident-routing"

export function PipelineBoardTab() {
  const { toast } = useToast()
  const [incidents, setIncidents] = useState<RoutedIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [movingId, setMovingId] = useState<string | null>(null)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/incidents/routed")
      if (res.ok) {
        const data = (await res.json()) as RoutedIncident[]
        setIncidents(data.filter((i) => i.routing_department_id))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  const grouped = groupIncidentsByPipelineStage(incidents)

  const moveToStage = async (incidentId: string, stage: IncidentPipelineStage) => {
    setMovingId(incidentId)
    try {
      const res = await fetch(`/api/incidents/${incidentId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_stage: stage, reason: `Movido a ${PIPELINE_STAGE_LABELS[stage]}` }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Error al mover")
      }
      await loadBoard()
    } catch (err) {
      toast({
        title: "No se pudo mover",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setMovingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {incidents.length} incidentes enrutados en el pipeline
        </p>
        <Button variant="outline" size="sm" onClick={() => void loadBoard()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {incidents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay incidentes enrutados. Configura reglas y aplica la migración, o ejecuta ruteo
            manual desde incidentes sin departamento.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {INCIDENT_PIPELINE_STAGES.map((stage) => (
            <Card key={stage} className={`border-2 ${PIPELINE_STAGE_COLORS[stage]}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">
                  {PIPELINE_STAGE_LABELS[stage]}
                </CardTitle>
                <CardDescription>{grouped[stage].length} incidentes</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-2 max-h-[28rem] overflow-y-auto">
                {grouped[stage].length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-4 text-center">Vacío</p>
                ) : (
                  grouped[stage].map((incident) => (
                    <div
                      key={incident.id}
                      className="rounded-lg border bg-card p-3 shadow-sm space-y-2"
                    >
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {incident.type}
                        </Badge>
                        {incident.sla_breached && (
                          <Badge variant="destructive" className="text-[10px]">
                            SLA
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium line-clamp-3">{incident.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {incident.department_name ?? "—"}
                        {incident.assignee_name ? ` · ${incident.assignee_name}` : ""}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <Select
                          value={stage}
                          onValueChange={(v) =>
                            void moveToStage(incident.id, v as IncidentPipelineStage)
                          }
                          disabled={movingId === incident.id}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INCIDENT_PIPELINE_STAGES.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {PIPELINE_STAGE_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button asChild variant="link" className="h-auto p-0 text-xs justify-start">
                          <Link href={`/incidentes/${incident.id}`}>Abrir incidente</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
