"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  INCIDENT_PIPELINE_STAGES,
  PIPELINE_STAGE_COLORS,
  PIPELINE_STAGE_LABELS,
  type IncidentPipelineStage,
} from "@/lib/incidents/incident-routing"
import type { OrgFoundationSummary } from "@/lib/departments/department-coverage"

type SummaryResponse = {
  total_open: number
  unrouted: number
  sla_breached: number
  by_pipeline_stage: Record<IncidentPipelineStage, number>
}

export function PipelineBoardTab({
  onSelectStage,
}: {
  onSelectStage?: (stage: IncidentPipelineStage) => void
}) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [orgSummary, setOrgSummary] = useState<OrgFoundationSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBoard = useCallback(async () => {
    setLoading(true)
    try {
      const [routedRes, orgRes] = await Promise.all([
        fetch("/api/incidents/routed?summary=true"),
        fetch("/api/incidents/org-foundation"),
      ])
      if (routedRes.ok) setSummary(await routedRes.json())
      if (orgRes.ok) {
        const orgJson = await orgRes.json()
        setOrgSummary(orgJson.summary ?? null)
      }
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

  const routedTotal = (summary?.total_open ?? 0) - (summary?.unrouted ?? 0)
  const readinessPct =
    orgSummary && orgSummary.open_incidents_total > 0
      ? Math.round(
          ((orgSummary.open_incidents_routed +
            orgSummary.open_incidents_assigned +
            orgSummary.open_incidents_acknowledged) /
            (orgSummary.open_incidents_total * 3)) *
            100,
        )
      : 0
  const dashboardReady = readinessPct >= 50

  const actionCards = [
    {
      title: "Sin clasificar",
      count: summary?.unrouted ?? 0,
      href: "/incidentes/pipeline?tab=inbox",
      cta: "Clasificar backlog",
      show: (summary?.unrouted ?? 0) > 0,
    },
    {
      title: "Sin responsable",
      count: orgSummary
        ? orgSummary.open_incidents_routed - orgSummary.open_incidents_assigned
        : 0,
      href: "/incidentes/pipeline?tab=inbox",
      cta: "Ir a mi bandeja",
      show: orgSummary
        ? orgSummary.open_incidents_routed > orgSummary.open_incidents_assigned
        : false,
    },
    {
      title: "Sin acuse",
      count: orgSummary
        ? orgSummary.open_incidents_routed - orgSummary.open_incidents_acknowledged
        : 0,
      href: "/incidentes/pipeline?tab=inbox",
      cta: "Acusar en bandeja",
      show: orgSummary
        ? orgSummary.open_incidents_routed > orgSummary.open_incidents_acknowledged
        : false,
    },
    {
      title: "Fuera de SLA",
      count: summary?.sla_breached ?? 0,
      href: "/reportes/incidentes-sla",
      cta: "Ver tablero SLA",
      show: (summary?.sla_breached ?? 0) > 0,
    },
  ].filter((card) => card.show)

  return (
    <div className="space-y-4">
      {!dashboardReady && orgSummary && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tablero SLA en modo preview</AlertTitle>
          <AlertDescription>
            Solo {readinessPct}% de preparación operativa ({orgSummary.open_incidents_routed}/
            {orgSummary.open_incidents_total} ruteados, {orgSummary.open_incidents_assigned}{" "}
            asignados, {orgSummary.open_incidents_acknowledged} con acuse). Clasifica el backlog y
            asigna responsables para métricas confiables.{" "}
            <Link href="/gestion/departamentos" className="underline font-medium">
              Configurar departamentos
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Resumen por etapa con acciones operativas. Usa{" "}
            <span className="font-medium text-foreground">Bandeja</span> para tomar, acusar y
            clasificar en volumen.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {summary?.total_open ?? 0} abiertos · {routedTotal} enrutados ·{" "}
            {summary?.unrouted ?? 0} sin clasificar
            {summary && summary.sla_breached > 0 && (
              <>
                {" "}
                · <span className="text-red-600 font-medium">{summary.sla_breached} SLA</span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadBoard()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {actionCards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actionCards.map((card) => (
            <Card key={card.title} className="border-amber-200 bg-amber-50/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">{card.title}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-semibold text-foreground tabular-nums">
                    {card.count}
                  </span>{" "}
                  pendientes
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                  <Link href={card.href}>
                    {card.cta}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  )
}
