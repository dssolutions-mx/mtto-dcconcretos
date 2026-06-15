import { normalizeIssueCoreItem } from "@/lib/incidents/normalize-issue-core-item"
import {
  incidentEffectiveMs,
  type DateRangeBounds,
  type IncidentDateField,
} from "@/lib/incidents/incident-date-filter"
import {
  computeCohortFunnelMetrics,
  type CohortFunnelMetrics,
} from "@/lib/incidents/inspection-cohort"
import {
  classifyIssueTheme,
  type IssueThemeId,
  getThemeDef,
} from "@/lib/maintenance/issue-theme-taxonomy"
import { isIncidentResolvedForDashboard } from "@/lib/incident-dashboard-metrics"

export type WorkOrderForPlanning = {
  id: string
  order_id?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  asset_id?: string | null
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

export type IncidentForPlanning = {
  id?: string
  date?: string | null
  created_at?: string | null
  status?: string | null
  description?: string | null
  work_order_id?: string | null
  asset_id?: string | null
}

export type ThemeBucket = {
  themeId: IssueThemeId
  label: string
  planningHint: string
  workOrderCount: number
  unitCount: number
  plantCount: number
  workOrderIds: string[]
}

export type HotspotUnit = {
  assetId: string
  unitCode: string
  assetName: string
  plantName: string
  issueCount: number
  workOrderCount: number
}

export type PlantThemeCell = {
  plantId: string
  plantName: string
  themeId: IssueThemeId
  count: number
}

export type PlanningCockpitMetrics = {
  funnel: CohortFunnelMetrics
  operationalAssetCount: number
  inspectedAssetCount: number
  themeBuckets: ThemeBucket[]
  hotspotUnits: HotspotUnit[]
  plantThemeMatrix: PlantThemeCell[]
}

function incidentInBounds(
  incident: IncidentForPlanning,
  bounds: DateRangeBounds,
  dateField: IncidentDateField,
): boolean {
  const ms = incidentEffectiveMs(incident, dateField)
  return Number.isFinite(ms) && ms >= bounds.fromMs && ms <= bounds.toMs
}

function themeFromWorkOrder(wo: WorkOrderForPlanning): IssueThemeId {
  const desc = wo.description ?? ""
  return classifyIssueTheme(desc)
}

export function computePlanningCockpitMetrics(input: {
  incidents: IncidentForPlanning[]
  workOrders: WorkOrderForPlanning[]
  bounds: DateRangeBounds
  dateField?: IncidentDateField
  operationalAssetCount: number
  inspectedAssetIds: Set<string>
}): PlanningCockpitMetrics {
  const dateField = input.dateField ?? "event"
  const funnel = computeCohortFunnelMetrics(
    input.incidents,
    input.bounds,
    dateField,
  )

  const cohortIncidents = input.incidents.filter((i) =>
    incidentInBounds(i, input.bounds, dateField),
  )
  const cohortIncidentIds = new Set(
    cohortIncidents.map((i) => i.id).filter(Boolean) as string[],
  )

  const pendingWos = input.workOrders.filter((wo) => wo.status === "Pendiente")
  const cohortWos = pendingWos.filter((wo) => {
    if (wo.incident_id && cohortIncidentIds.has(wo.incident_id)) return true
    if (!wo.created_at) return false
    const ms = new Date(wo.created_at).getTime()
    return ms >= input.bounds.fromMs && ms <= input.bounds.toMs
  })

  const themeMap = new Map<
    IssueThemeId,
    { woIds: string[]; assetIds: Set<string>; plantIds: Set<string> }
  >()

  for (const wo of cohortWos) {
    const themeId = themeFromWorkOrder(wo)
    const entry = themeMap.get(themeId) ?? {
      woIds: [],
      assetIds: new Set<string>(),
      plantIds: new Set<string>(),
    }
    entry.woIds.push(wo.id)
    if (wo.asset_id) entry.assetIds.add(wo.asset_id)
    const pid = wo.asset?.plant_id
    if (pid) entry.plantIds.add(pid)
    themeMap.set(themeId, entry)
  }

  const themeBuckets: ThemeBucket[] = [...themeMap.entries()]
    .map(([themeId, data]) => {
      const def = getThemeDef(themeId)
      return {
        themeId,
        label: def.label,
        planningHint: def.planningHint,
        workOrderCount: data.woIds.length,
        unitCount: data.assetIds.size,
        plantCount: data.plantIds.size,
        workOrderIds: data.woIds,
      }
    })
    .sort((a, b) => b.workOrderCount - a.workOrderCount)

  const assetIssues = new Map<
    string,
    { count: number; woCount: number; asset?: WorkOrderForPlanning["asset"] }
  >()

  for (const inc of cohortIncidents) {
    if (!inc.asset_id || isIncidentResolvedForDashboard(inc.status)) continue
    const cur = assetIssues.get(inc.asset_id) ?? { count: 0, woCount: 0 }
    cur.count += 1
    assetIssues.set(inc.asset_id, cur)
  }

  for (const wo of cohortWos) {
    if (!wo.asset_id) continue
    const cur = assetIssues.get(wo.asset_id) ?? { count: 0, woCount: 0, asset: wo.asset }
    cur.woCount += 1
    cur.asset = wo.asset ?? cur.asset
    assetIssues.set(wo.asset_id, cur)
  }

  const hotspotUnits: HotspotUnit[] = [...assetIssues.entries()]
    .map(([assetId, data]) => ({
      assetId,
      unitCode: data.asset?.asset_id ?? assetId.slice(0, 8),
      assetName: data.asset?.name ?? "—",
      plantName: data.asset?.plants?.name ?? "—",
      issueCount: data.count,
      workOrderCount: data.woCount,
    }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10)

  const matrixMap = new Map<string, PlantThemeCell>()
  for (const wo of cohortWos) {
    const themeId = themeFromWorkOrder(wo)
    const plantId = wo.asset?.plant_id ?? "unknown"
    const plantName = wo.asset?.plants?.name ?? "Sin planta"
    const key = `${plantId}:${themeId}`
    const cur = matrixMap.get(key) ?? { plantId, plantName, themeId, count: 0 }
    cur.count += 1
    matrixMap.set(key, cur)
  }

  return {
    funnel,
    operationalAssetCount: input.operationalAssetCount,
    inspectedAssetCount: input.inspectedAssetIds.size,
    themeBuckets,
    hotspotUnits,
    plantThemeMatrix: [...matrixMap.values()],
  }
}

export function coreItemFromDescription(description: string): string {
  return normalizeIssueCoreItem(description) || description.slice(0, 40)
}
