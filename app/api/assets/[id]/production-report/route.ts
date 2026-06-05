import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  getMaintenanceUnit,
  getCurrentValue,
  getMaintenanceValue,
  type MaintenanceUnit,
} from '@/lib/utils/maintenance-units'
import {
  computeCyclicIntervalResults,
  type CyclicIntervalResult,
  type CyclicMaintenanceInterval,
} from '@/lib/utils/cyclic-maintenance'

const INTERVAL_SELECT = `
  *,
  maintenance_tasks(
    id,
    description,
    task_parts(*)
  )
`

function isReadingOnlyMaintenance(record: {
  description?: string | null
  type?: string | null
}): boolean {
  const description = record.description?.toLowerCase() || ''
  const type = record.type?.toLowerCase() || ''
  return (
    description.includes('lectura') ||
    description.includes('reading') ||
    description.includes('actualización de horas') ||
    description.includes('actualización de horómetro') ||
    description.includes('actualización de kilómetros') ||
    description.includes('update hours') ||
    description.includes('update kilometers') ||
    description.includes('horómetro') ||
    description.includes('horometro') ||
    description.includes('via checklist') ||
    description.includes('→') ||
    description.includes('->') ||
    type === 'reading' ||
    type === 'lectura' ||
    (description.includes('actualización') &&
      (description.includes('1332') || description.includes('1385')))
  )
}

function mapCyclicStatusForReport(status: CyclicIntervalResult['status']): string {
  if (status === 'not_applicable') return 'scheduled'
  return status
}

function mapCyclicToIntervalAnalysisEntry(
  intervalRow: Record<string, unknown>,
  cyclic: CyclicIntervalResult,
  history: Array<Record<string, unknown>>,
  unit: MaintenanceUnit,
  componentMeta?: {
    component_id: string
    component_name: string
    component_asset_id: string
  }
) {
  const intervalId = String(intervalRow.id)
  const lastMaintenanceOfType =
    history.find((m) => m.maintenance_plan_id === intervalId) ??
    (cyclic.lastMaintenanceDate
      ? history.find((m) => m.date === cyclic.lastMaintenanceDate)
      : undefined)

  const hoursOverdue =
    cyclic.status === 'overdue' ? Math.max(0, Math.abs(cyclic.valueRemaining)) : 0

  return {
    ...intervalRow,
    ...componentMeta,
    analysis: {
      status: mapCyclicStatusForReport(cyclic.status),
      progress: Math.min(cyclic.progress, 100),
      nextHours: cyclic.nextDueValue ?? intervalRow.interval_value,
      hoursOverdue,
      wasPerformed: cyclic.wasPerformed,
      urgencyLevel: cyclic.urgency,
      valueRemaining: cyclic.valueRemaining,
      nextDueValue: cyclic.nextDueValue,
      unit,
      lastMaintenance: lastMaintenanceOfType
        ? {
            date: lastMaintenanceOfType.date,
            hours: getMaintenanceValue(lastMaintenanceOfType, unit),
            technician: lastMaintenanceOfType.technician || 'No especificado',
            description: lastMaintenanceOfType.description,
          }
        : null,
      intervalHours: intervalRow.interval_value,
      planId: intervalId,
    },
  }
}

async function resolveAggregateScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  asset: Record<string, unknown>,
  requestedId: string
): Promise<{
  aggregateAssetIds: string[]
  isCompositeReport: boolean
  compositeId: string | null
  componentIds: string[]
}> {
  const isComposite = asset.is_composite === true
  let compositeId: string | null = isComposite ? requestedId : null
  let componentIds: string[] = []

  if (isComposite) {
    componentIds = Array.isArray(asset.component_assets)
      ? (asset.component_assets as string[])
      : []
    const aggregateAssetIds = Array.from(new Set([requestedId, ...componentIds]))
    return {
      aggregateAssetIds,
      isCompositeReport: componentIds.length > 0,
      compositeId: requestedId,
      componentIds,
    }
  }

  const { data: rel } = await supabase
    .from('asset_composite_relationships')
    .select('composite_asset_id')
    .eq('component_asset_id', requestedId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const relRow = rel as { composite_asset_id?: string } | null
  if (relRow?.composite_asset_id) {
    compositeId = relRow.composite_asset_id
    const { data: parent } = await supabase
      .from('assets')
      .select('id, component_assets, is_composite')
      .eq('id', relRow.composite_asset_id)
      .single()

    const parentRow = parent as {
      is_composite?: boolean
      component_assets?: string[]
    } | null

    if (parentRow?.is_composite) {
      componentIds = Array.isArray(parentRow.component_assets)
        ? parentRow.component_assets
        : []
      const aggregateAssetIds = Array.from(
        new Set([relRow.composite_asset_id, ...componentIds])
      )
      return {
        aggregateAssetIds,
        isCompositeReport: componentIds.length > 0,
        compositeId: relRow.composite_asset_id,
        componentIds,
      }
    }
  }

  return {
    aggregateAssetIds: [requestedId],
    isCompositeReport: false,
    compositeId,
    componentIds: [],
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select(`
        *,
        equipment_models (
          id,
          name,
          manufacturer,
          model_id,
          category,
          description,
          specifications,
          maintenance_unit,
          maintenance_intervals (*)
        )
      `)
      .eq('id', id)
      .single()

    if (assetError) {
      return NextResponse.json({ error: assetError.message }, { status: 500 })
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const scope = await resolveAggregateScope(supabase, asset, id)
    const { aggregateAssetIds, isCompositeReport, compositeId, componentIds } = scope
    const useAggregate = aggregateAssetIds.length > 1

    const assetIdFilter = useAggregate
      ? { column: 'asset_id' as const, op: 'in' as const, value: aggregateAssetIds }
      : { column: 'asset_id' as const, op: 'eq' as const, value: id }

    const applyAssetFilter = <T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
      query: T
    ) =>
      useAggregate
        ? query.in(assetIdFilter.column, aggregateAssetIds)
        : query.eq(assetIdFilter.column, id)

    const { data: completedChecklists, error: checklistsError } = await applyAssetFilter(
      supabase.from('completed_checklists').select(`
        *,
        assets:asset_id ( id, name, asset_id ),
        checklists (
          id,
          name,
          description,
          frequency,
          checklist_sections (
            id,
            title,
            checklist_items (
              id,
              description,
              required,
              item_type
            )
          )
        ),
        checklist_issues (
          id,
          status,
          description,
          notes,
          photo_url,
          resolved,
          resolution_date
        )
      `)
    ).order('completion_date', { ascending: false })

    if (checklistsError) {
      console.error('Error fetching completed checklists:', checklistsError)
    }

    const { data: incidents, error: incidentsError } = await applyAssetFilter(
      supabase.from('incident_history').select('*, assets:asset_id ( id, name, asset_id )')
    ).order('date', { ascending: false })

    if (incidentsError) {
      console.error('Error fetching incidents:', incidentsError)
    }

    const { data: maintenanceHistory, error: maintenanceError } = await applyAssetFilter(
      supabase.from('maintenance_history').select('*, assets:asset_id ( id, name, asset_id )')
    ).order('date', { ascending: false })

    if (maintenanceError) {
      console.error('Error fetching maintenance history:', maintenanceError)
    }

    const { data: workOrders, error: workOrdersError } = await applyAssetFilter(
      supabase.from('work_orders').select('*')
    ).order('created_at', { ascending: false })

    if (workOrdersError) {
      console.error('Error fetching work orders:', workOrdersError)
    }

    const { data: serviceOrders, error: serviceOrdersError } = await applyAssetFilter(
      supabase.from('service_orders').select('*')
    ).order('date', { ascending: false })

    if (serviceOrdersError) {
      console.error('Error fetching service orders:', serviceOrdersError)
    }

    const { data: maintenancePlans, error: plansError } = await applyAssetFilter(
      supabase
        .from('maintenance_plans')
        .select(`
        *,
        maintenance_intervals (
          id,
          interval_value,
          type,
          description,
          name
        )
      `)
    ).order('next_due', { ascending: true })

    if (plansError) {
      console.error('Error fetching maintenance plans:', plansError)
    }

    let maintenanceIntervals: Record<string, unknown>[] = []
    let intervalAnalysis: Record<string, unknown>[] = []
    let reportComponents: Array<Record<string, unknown>> = []

    const historyRows = (maintenanceHistory || []) as Array<Record<string, unknown>>
    const historyByAsset: Record<string, Array<Record<string, unknown>>> = {}
    for (const row of historyRows) {
      const aid = row.asset_id as string
      if (!aid) continue
      historyByAsset[aid] = historyByAsset[aid] || []
      historyByAsset[aid].push(row)
    }

    if (isCompositeReport && componentIds.length > 0) {
      const { data: components } = await supabase
        .from('assets')
        .select(`
          id,
          name,
          asset_id,
          model_id,
          current_hours,
          current_kilometers,
          equipment_models ( id, maintenance_unit )
        `)
        .in('id', componentIds)

      reportComponents = (components || []) as Array<Record<string, unknown>>

      const componentRows = (components || []) as Array<{
        id: string
        name?: string
        asset_id?: string
        model_id?: string
        current_hours?: number
        current_kilometers?: number
        equipment_models?: { maintenance_unit?: string }
      }>

      const modelIds = Array.from(
        new Set(componentRows.map((c) => c.model_id).filter(Boolean))
      ) as string[]

      const intervalsByModel: Record<string, Record<string, unknown>[]> = {}
      if (modelIds.length > 0) {
        const { data: intervalsData, error: intervalsError } = await supabase
          .from('maintenance_intervals')
          .select(INTERVAL_SELECT)
          .in('model_id', modelIds)
          .order('interval_value', { ascending: true })

        if (intervalsError) {
          console.error('Error fetching composite maintenance intervals:', intervalsError)
        } else {
          for (const it of intervalsData || []) {
            const mid = it.model_id as string
            intervalsByModel[mid] = intervalsByModel[mid] || []
            intervalsByModel[mid].push(it)
            maintenanceIntervals.push(it)
          }
        }
      }

      for (const comp of componentRows) {
        const modelId = comp.model_id as string
        const modelIntervals = (intervalsByModel[modelId] || []) as CyclicMaintenanceInterval[]
        if (modelIntervals.length === 0) continue

        const unit = getMaintenanceUnit(comp)
        const currentValue = getCurrentValue(comp, unit)
        const componentHistory = historyByAsset[comp.id] || []

        const cyclicResults = computeCyclicIntervalResults({
          intervals: modelIntervals,
          history: componentHistory,
          currentValue,
          unit,
          options: { applyEarliestUnpaid: true },
        })

        const componentMeta = {
          component_id: comp.id,
          component_name: comp.name || '',
          component_asset_id: comp.asset_id || '',
        }

        for (const cyclic of cyclicResults) {
          const intervalRow = (intervalsByModel[modelId] || []).find((i) => i.id === cyclic.intervalId)
          if (!intervalRow) continue
          intervalAnalysis.push(
            mapCyclicToIntervalAnalysisEntry(
              intervalRow,
              cyclic,
              componentHistory,
              unit,
              componentMeta
            )
          )
        }
      }
    } else if (asset.equipment_models?.id) {
      const modelId = asset.equipment_models.id as string
      const { data: intervalsData, error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .select(INTERVAL_SELECT)
        .eq('model_id', modelId)
        .order('interval_value', { ascending: true })

      if (intervalsError) {
        console.error('Error fetching maintenance intervals:', intervalsError)
      } else {
        maintenanceIntervals = (intervalsData || []) as Record<string, unknown>[]
        const cyclicIntervals = maintenanceIntervals as unknown as CyclicMaintenanceInterval[]
        const unit = getMaintenanceUnit(asset)
        const currentValue = getCurrentValue(asset, unit)
        const assetHistory = historyByAsset[id] || historyRows

        const cyclicResults = computeCyclicIntervalResults({
          intervals: cyclicIntervals,
          history: assetHistory,
          currentValue,
          unit,
          options: { applyEarliestUnpaid: true },
        })

        intervalAnalysis = cyclicResults
          .map((cyclic) => {
            const intervalRow = maintenanceIntervals.find((i) => i.id === cyclic.intervalId)
            if (!intervalRow) return null
            return mapCyclicToIntervalAnalysisEntry(
              intervalRow,
              cyclic,
              assetHistory,
              unit
            )
          })
          .filter(Boolean) as Record<string, unknown>[]
      }
    }

    const actualMaintenanceHistory = historyRows.filter((record) => !isReadingOnlyMaintenance(record))

    const totalMaintenanceCost = actualMaintenanceHistory.reduce(
      (sum, record) => sum + (parseFloat(String(record.total_cost || '0')) || 0),
      0
    )

    const incidentRows = (incidents || []) as Array<{ total_cost?: string | number; downtime?: number }>
    const totalIncidentCost = incidentRows.reduce(
      (sum, incident) => sum + (parseFloat(String(incident.total_cost || '0')) || 0),
      0
    )

    const totalMaintenanceHours = actualMaintenanceHistory.reduce(
      (sum, record) => sum + (Number(record.labor_hours) || 0),
      0
    )

    const preventiveMaintenance = actualMaintenanceHistory.filter((record) => {
      const type = String(record.type || '').toLowerCase()
      return type === 'preventive' || type === 'preventivo' || record.maintenance_plan_id
    })

    const correctiveMaintenance = actualMaintenanceHistory.filter((record) => {
      const type = String(record.type || '').toLowerCase()
      return (
        type === 'corrective' ||
        type === 'correctivo' ||
        (!record.maintenance_plan_id && type !== 'preventive' && type !== 'preventivo')
      )
    })

    const completedChecklistsCount = (completedChecklists || []).length

    const checklistRows = (completedChecklists || []) as Array<{
      checklist_issues?: Array<{ id?: string; resolved?: boolean }>
    }>
    const allChecklistIssues = checklistRows
      .flatMap((checklist) => checklist.checklist_issues || [])
      .filter(
        (issue, index, array) =>
          !issue.id || array.findIndex((i) => i.id === issue.id) === index
      )

    const checklistIssuesCount = allChecklistIssues.length
    const resolvedIssuesCount = allChecklistIssues.filter((issue: { resolved?: boolean }) => issue.resolved).length

    const totalDowntime = incidentRows.reduce(
      (sum, incident) => sum + (Number(incident.downtime) || 0),
      0
    )

    const currentDate = new Date()
    const assetRow = asset as { installation_date?: string; created_at?: string; warranty_expiration?: string }
    const installationDate = assetRow.installation_date
      ? new Date(assetRow.installation_date)
      : new Date(assetRow.created_at ?? Date.now())
    const operatingDays = Math.ceil(
      (currentDate.getTime() - installationDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const totalOperatingHours = operatingDays * 24
    const availability =
      totalOperatingHours > 0
        ? ((totalOperatingHours - totalDowntime) / totalOperatingHours) * 100
        : 100

    const warrantyStatus = assetRow.warranty_expiration
      ? new Date(assetRow.warranty_expiration) > currentDate
        ? 'Active'
        : 'Expired'
      : 'Not specified'

    const daysToWarrantyExpiration = assetRow.warranty_expiration
      ? Math.ceil(
          (new Date(assetRow.warranty_expiration).getTime() - currentDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : null

    const reportData = {
      asset,
      reportMeta: {
        isComposite: isCompositeReport,
        compositeId,
        components: reportComponents,
        aggregateAssetIds,
      },
      completedChecklists: completedChecklists || [],
      incidents: incidents || [],
      maintenanceHistory: actualMaintenanceHistory || [],
      allMaintenanceHistory: maintenanceHistory || [],
      workOrders: workOrders || [],
      serviceOrders: serviceOrders || [],
      maintenancePlans: maintenancePlans || [],
      maintenanceIntervals: maintenanceIntervals || [],
      intervalAnalysis: intervalAnalysis || [],
      summary: {
        totalMaintenanceCost,
        totalIncidentCost,
        totalCost: totalMaintenanceCost + totalIncidentCost,
        totalMaintenanceHours,
        preventiveMaintenanceCount: preventiveMaintenance.length,
        correctiveMaintenanceCount: correctiveMaintenance.length,
        completedChecklistsCount,
        checklistIssuesCount,
        resolvedIssuesCount,
        openIssuesCount: checklistIssuesCount - resolvedIssuesCount,
        totalDowntime,
        availability: parseFloat(availability.toFixed(2)),
        operatingDays,
        warrantyStatus,
        daysToWarrantyExpiration,
      },
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(reportData)
  } catch (error: unknown) {
    console.error('Error generating production report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
