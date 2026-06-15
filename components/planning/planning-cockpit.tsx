"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  computePlanningCockpitMetrics,
  type PlanningCockpitMetrics,
  type ThemeBucket,
} from "@/lib/maintenance/planning-cockpit-metrics"
import { cohortToBounds, INSPECTION_COHORTS } from "@/lib/incidents/inspection-cohort"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"
import { ChevronRight, ClipboardList, Layers, Target } from "lucide-react"
import { CreateCampaignDialog } from "@/components/campaigns/create-campaign-dialog"

type PlanningCockpitProps = {
  incidents: Record<string, unknown>[]
  workOrders: Record<string, unknown>[]
  operationalAssetCount: number
  inspectedAssetIds: string[]
  initialCohort?: InspectionCohortId
  initialPlantId?: string
}

export function PlanningCockpit({
  incidents,
  workOrders,
  operationalAssetCount,
  inspectedAssetIds,
  initialCohort = "june_2026_inspection",
  initialPlantId,
}: PlanningCockpitProps) {
  const [cohortId, setCohortId] = useState<InspectionCohortId>(initialCohort)
  const [plantFilter, setPlantFilter] = useState(initialPlantId ?? "all")
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean
    theme?: ThemeBucket
  }>({ open: false })

  const bounds = cohortToBounds(cohortId)

  const metrics: PlanningCockpitMetrics | null = useMemo(() => {
    if (!bounds) return null
    let inc = incidents
    let wos = workOrders
    if (plantFilter !== "all") {
      inc = incidents.filter((i) => {
        const assets = i.assets as { plant_id?: string } | null
        return assets?.plant_id === plantFilter
      })
      wos = workOrders.filter((wo) => {
        const asset = wo.asset as { plant_id?: string } | null
        return asset?.plant_id === plantFilter
      })
    }
    return computePlanningCockpitMetrics({
      incidents: inc as Parameters<typeof computePlanningCockpitMetrics>[0]["incidents"],
      workOrders: wos as Parameters<typeof computePlanningCockpitMetrics>[0]["workOrders"],
      bounds,
      operationalAssetCount,
      inspectedAssetIds: new Set(inspectedAssetIds),
    })
  }, [
    incidents,
    workOrders,
    bounds,
    operationalAssetCount,
    inspectedAssetIds,
    plantFilter,
  ])

  const plantOptions = useMemo(() => {
    const map = new Map<string, string>()
    workOrders.forEach((wo) => {
      const asset = wo.asset as { plant_id?: string; plants?: { name?: string } } | null
      if (asset?.plant_id) {
        map.set(asset.plant_id, asset.plants?.name ?? asset.plant_id)
      }
    })
    return [...map.entries()].map(([id, label]) => ({ id, label }))
  }, [workOrders])

  if (!metrics || !bounds) {
    return (
      <p className="text-muted-foreground text-sm">Seleccione una cohorte de revisión válida.</p>
    )
  }

  const cohortLabel = INSPECTION_COHORTS[cohortId]?.label ?? cohortId

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Cohorte</label>
          <Select
            value={cohortId}
            onValueChange={(v) => setCohortId(v as InspectionCohortId)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="june_2026_inspection">Revisión Jun 2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Planta</label>
          <Select value={plantFilter} onValueChange={setPlantFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {plantOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Cobertura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {metrics.inspectedAssetCount}/{metrics.operationalAssetCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unidades inspeccionadas</p>
            <Button asChild variant="link" className="h-auto p-0 mt-2 text-xs">
              <Link href="/checklists?tab=frequency">Completar inspección restante</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Funnel de atención — {cohortLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>{metrics.funnel.totalInCohort} hallazgos</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:inline" />
              <span>{metrics.funnel.withWorkOrder} con OT</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground hidden sm:inline" />
              <span>{metrics.funnel.resolvedInCohort} cerrados</span>
              {metrics.funnel.withoutWorkOrder > 0 && (
                <Link
                  href={`/incidentes?cohort=${cohortId}&ot=without`}
                  className="text-amber-700 font-medium hover:underline"
                >
                  {metrics.funnel.withoutWorkOrder} sin OT
                </Link>
              )}
            </div>
            <Progress value={metrics.funnel.closedPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metrics.funnel.closedPct}% atendidos en revisión
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Priorizar por tema
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.themeBuckets.map((bucket) => (
            <Card key={bucket.themeId} className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{bucket.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {bucket.workOrderCount} OTs · {bucket.unitCount} unidades ·{" "}
                  {bucket.plantCount} plantas
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {bucket.planningHint}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs cursor-pointer"
                    onClick={() => setCampaignDialog({ open: true, theme: bucket })}
                  >
                    Crear campaña
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="text-xs">
                    <Link
                      href={`/ordenes/campanas?theme=${bucket.themeId}&cohort=${cohortId}`}
                    >
                      Ver OTs
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {metrics.hotspotUnits.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Unidades hotspot</h2>
          <div className="rounded-md border divide-y">
            {metrics.hotspotUnits.map((u) => (
              <div
                key={u.assetId}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div>
                  <Link
                    href={`/activos/${u.assetId}`}
                    className="font-medium hover:underline"
                  >
                    {u.unitCode}
                  </Link>
                  <span className="text-muted-foreground ml-2">{u.plantName}</span>
                </div>
                <span className="text-muted-foreground">
                  {u.issueCount} hallazgos · {u.workOrderCount} OTs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="rounded-lg border p-4 text-sm text-muted-foreground">
        <summary className="font-medium text-foreground cursor-pointer">
          Guía de planificación
        </summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Cerrar brecha sin OT (generar o asignar desde incidentes).</li>
          <li>Atacar temas sistémicos con campañas por tema.</li>
          <li>Atender unidades hotspot con campaña dedicada.</li>
          <li>Completar inspección en unidades pendientes.</li>
          <li>Revisar reincidentes para escalación o causa raíz.</li>
        </ol>
      </details>

      <CreateCampaignDialog
        open={campaignDialog.open}
        onOpenChange={(open) => setCampaignDialog((s) => ({ ...s, open }))}
        themeBucket={campaignDialog.theme}
        cohortId={cohortId}
        plantId={plantFilter !== "all" ? plantFilter : undefined}
      />
    </div>
  )
}
