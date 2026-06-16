"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  INCIDENT_PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"

type SummaryResponse = {
  total_open: number
  unrouted: number
  by_pipeline_stage: Record<IncidentPipelineStage, number>
}

export function PipelineBoardTab({
  onSelectStage,
}: {
  onSelectStage?: (stage: IncidentPipelineStage) => void
}) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/incidents/routed?summary=true")
      if (res.ok) setSummary(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const routedTotal =
    (summary?.total_open ?? 0) - (summary?.unrouted ?? 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Resumen por etapa — diseñado para alto volumen. Usa la pestaña{" "}
            <span className="font-medium text-foreground">Bandeja</span> para ver y clasificar
            incidentes en tabla paginada.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary?.total_open ?? 0} abiertos · {routedTotal} enrutados ·{" "}
            {summary?.unrouted ?? 0} sin clasificar
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadBoard()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {INCIDENT_PIPELINE_STAGES.map((stage) => {
          const count = summary?.by_pipeline_stage[stage] ?? 0
          return (
            <Card
              key={stage}
              className={`border-2 ${PIPELINE_STAGE_COLORS[stage]} ${onSelectStage ? "cursor-pointer hover:shadow-sm" : ""}`}
              onClick={() => onSelectStage?.(stage)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">
                  {PIPELINE_STAGE_LABELS[stage]}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className="text-2xl font-semibold text-foreground tabular-nums">
                    {count}
                  </span>
                  <span>incidentes</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {summary && summary.total_open > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {Math.round((count / summary.total_open) * 100)}% del total abierto
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Con 700+ incidentes abiertos, renderizar tarjetas por incidente en el tablero degrada el
          rendimiento. El flujo recomendado es: elegir departamento en Bandeja → filtrar/buscar →
          abrir solo el incidente que requiera acción.
        </CardContent>
      </Card>
    </div>
  )
}
