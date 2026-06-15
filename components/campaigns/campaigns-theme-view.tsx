"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  classifyIssueTheme,
  allThemesSorted,
  getThemeDef,
  type IssueThemeId,
} from "@/lib/maintenance/issue-theme-taxonomy"
import { cohortToBounds } from "@/lib/incidents/inspection-cohort"
import type { InspectionCohortId } from "@/lib/incidents/inspection-cohort"
import { CreateCampaignDialog } from "@/components/campaigns/create-campaign-dialog"
import type { ThemeBucket } from "@/lib/maintenance/planning-cockpit-metrics"
import { Wrench } from "lucide-react"

export type CampaignListItem = {
  id: string
  name: string
  status: string
  theme?: string | null
  target_end?: string | null
  work_order_count?: number
  completed_count?: number
  progress_pct?: number
}

type WorkOrderRow = {
  id: string
  order_id?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  incident_id?: string | null
  created_at?: string | null
  asset?: {
    id: string
    name?: string | null
    asset_id?: string | null
    plant_id?: string | null
    plants?: { name?: string | null } | null
  } | null
}

type CampaignsThemeViewProps = {
  workOrders: WorkOrderRow[]
  campaigns: CampaignListItem[]
  initialTheme?: IssueThemeId
  initialCohort?: InspectionCohortId
}

export function CampaignsThemeView({
  workOrders,
  campaigns,
  initialTheme,
  initialCohort = "june_2026_inspection",
}: CampaignsThemeViewProps) {
  const [selectedTheme, setSelectedTheme] = useState<IssueThemeId | "all">(
    initialTheme ?? "all",
  )
  const [campaignDialog, setCampaignDialog] = useState<{
    open: boolean
    bucket?: ThemeBucket
  }>({ open: false })

  const bounds = cohortToBounds(initialCohort)

  const pendingWos = useMemo(
    () => workOrders.filter((wo) => wo.status === "Pendiente"),
    [workOrders],
  )

  const cohortWos = useMemo(() => {
    if (!bounds) return pendingWos
    return pendingWos.filter((wo) => {
      if (!wo.created_at) return true
      const ms = new Date(wo.created_at).getTime()
      return ms >= bounds.fromMs && ms <= bounds.toMs
    })
  }, [pendingWos, bounds])

  const themeGroups = useMemo(() => {
    const map = new Map<
      IssueThemeId,
      { wos: WorkOrderRow[]; assetIds: Set<string>; plantIds: Set<string> }
    >()
    for (const wo of cohortWos) {
      const themeId = classifyIssueTheme(wo.description ?? "")
      const entry = map.get(themeId) ?? {
        wos: [],
        assetIds: new Set<string>(),
        plantIds: new Set<string>(),
      }
      entry.wos.push(wo)
      if (wo.asset?.id) entry.assetIds.add(wo.asset.id)
      if (wo.asset?.plant_id) entry.plantIds.add(wo.asset.plant_id)
      map.set(themeId, entry)
    }
    return map
  }, [cohortWos])

  const themeCounts = useMemo(() => {
    const counts: Partial<Record<IssueThemeId, number>> = {}
    for (const [themeId, data] of themeGroups) {
      counts[themeId] = data.wos.length
    }
    return counts
  }, [themeGroups])

  const displayedWos = useMemo(() => {
    if (selectedTheme === "all") return cohortWos
    return themeGroups.get(selectedTheme)?.wos ?? []
  }, [selectedTheme, cohortWos, themeGroups])

  const groupedByPlant = useMemo(() => {
    const map = new Map<string, { label: string; wos: WorkOrderRow[] }>()
    for (const wo of displayedWos) {
      const pid = wo.asset?.plant_id ?? "none"
      const label = wo.asset?.plants?.name ?? "Sin planta"
      const entry = map.get(pid) ?? { label, wos: [] }
      entry.wos.push(wo)
      map.set(pid, entry)
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "es"))
  }, [displayedWos])

  const openCreateForTheme = (themeId: IssueThemeId) => {
    const data = themeGroups.get(themeId)
    if (!data) return
    const def = getThemeDef(themeId)
    setCampaignDialog({
      open: true,
      bucket: {
        themeId,
        label: def.label,
        planningHint: def.planningHint,
        workOrderCount: data.wos.length,
        unitCount: data.assetIds.size,
        plantCount: data.plantIds.size,
        workOrderIds: data.wos.map((w) => w.id),
      },
    })
  }

  return (
    <Tabs defaultValue="suggested">
      <TabsList>
        <TabsTrigger value="suggested">Sugeridas por tema</TabsTrigger>
        <TabsTrigger value="campaigns">
          Mis campañas ({campaigns.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="suggested" className="space-y-4 mt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedTheme === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedTheme("all")}
          >
            Todas ({cohortWos.length})
          </Button>
          {allThemesSorted().map((t) => {
            const count = themeCounts[t.id] ?? 0
            if (count === 0) return null
            return (
              <Button
                key={t.id}
                size="sm"
                variant={selectedTheme === t.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedTheme(t.id)}
              >
                {t.label} ({count})
              </Button>
            )
          })}
        </div>

        {selectedTheme !== "all" && (themeCounts[selectedTheme] ?? 0) > 0 && (
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={() => openCreateForTheme(selectedTheme)}
          >
            Crear campaña con estas OTs
          </Button>
        )}

        {groupedByPlant.map((group) => (
          <Card key={group.label}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm">{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {group.wos.map((wo) => (
                <div
                  key={wo.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{wo.asset?.asset_id ?? "—"}</span>
                    <span className="text-muted-foreground ml-2 truncate">
                      {wo.description?.slice(0, 60)}
                    </span>
                  </div>
                  <Badge variant="outline">{wo.priority ?? "Media"}</Badge>
                  <Button asChild size="sm" variant="ghost" className="shrink-0">
                    <Link href={`/ordenes/${wo.id}`}>
                      <Wrench className="h-3 w-3 mr-1" />
                      {wo.order_id ? `OT-${wo.order_id}` : "Ver"}
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {displayedWos.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No hay OTs pendientes en este tema para la cohorte seleccionada.
          </p>
        )}
      </TabsContent>

      <TabsContent value="campaigns" className="mt-4 space-y-3">
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay campañas. Cree una desde un tema sugerido o planificación.
          </p>
        ) : (
          campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <Link
                    href={`/ordenes/campanas/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.work_order_count ?? 0} OTs · {c.progress_pct ?? 0}% completadas
                    {c.target_end && ` · meta ${c.target_end}`}
                  </p>
                </div>
                <Badge variant="secondary">{c.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </TabsContent>

      <CreateCampaignDialog
        open={campaignDialog.open}
        onOpenChange={(open) => setCampaignDialog((s) => ({ ...s, open }))}
        themeBucket={campaignDialog.bucket}
        cohortId={initialCohort}
      />
    </Tabs>
  )
}
