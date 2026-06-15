import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getMaintenanceUnit, getCurrentValue } from '@/lib/utils/maintenance-units'
import {
  computeCyclicIntervalResults,
  filterRelevantCyclicResults,
} from '@/lib/utils/cyclic-maintenance'
import { formatIntervalLabel } from '@/lib/utils/maintenance-units'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch composite (include coupling flags for drift logic)
    const { data: composite, error: compError } = await supabase
      .from('assets')
      .select('id, name, is_composite, component_assets, primary_component_id, composite_sync_hours, composite_sync_kilometers, composite_type')
      .eq('id', id)
      .eq('is_composite', true)
      .single()

    if (compError || !composite) {
      return NextResponse.json({ error: compError?.message || 'Composite not found' }, { status: 404 })
    }

    const componentIds: string[] = Array.isArray(composite.component_assets) ? composite.component_assets : []
    const aggregateAssetIds: string[] = Array.from(new Set([composite.id, ...componentIds]))
    if (componentIds.length === 0) {
      // Still aggregate composite-level data even if no components present
      const { data: incidentsOnly } = await supabase
        .from('incident_history')
        .select('*, assets:assets(id, name, asset_id)')
        .eq('asset_id', composite.id)
        .order('date', { ascending: false })
        .limit(50)

      const { data: pendingOnly } = await supabase
        .from('checklist_schedules')
        .select('*, checklists(name, frequency), assets:assets(id, name, asset_id)')
        .eq('asset_id', composite.id)
        .eq('status', 'pendiente')
        .order('scheduled_date', { ascending: true })
        .limit(50)

      const { data: completedOnly } = await supabase
        .from('completed_checklists')
        .select('*, checklists(name, frequency), assets:assets(id, name, asset_id)')
        .eq('asset_id', composite.id)
        .order('completion_date', { ascending: false })
        .limit(50)

      const { data: historyOnly } = await supabase
        .from('maintenance_history')
        .select('*, assets:assets(id, name, asset_id)')
        .eq('asset_id', composite.id)
        .order('date', { ascending: false })
        .limit(50)

      return NextResponse.json({ success: true, data: { composite, components: [], incidents: incidentsOnly || [], pending_schedules: pendingOnly || [], completed_checklists: completedOnly || [], maintenance_history: historyOnly || [], upcoming_maintenance: [] } })
    }

    // Fetch components (with plant/department and model for maintenance_unit)
    const { data: components } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        current_hours,
        current_kilometers,
        model_id,
        plant_id,
        department_id,
        plants:plants ( id, name ),
        departments:departments ( id, name ),
        equipment_models ( maintenance_unit )
      `)
      .in('id', componentIds)

    // Aggregations
    const { data: incidents } = await supabase
      .from('incident_history')
      .select('*, assets:assets(id, name, asset_id)')
      .in('asset_id', aggregateAssetIds)
      .order('date', { ascending: false })
      .limit(50)

    const { data: pending_schedules } = await supabase
      .from('checklist_schedules')
      .select('*, checklists(name, frequency), assets:assets(id, name, asset_id)')
      .in('asset_id', aggregateAssetIds)
      .eq('status', 'pendiente')
      .order('scheduled_date', { ascending: true })
      .limit(50)

    const { data: completed_checklists } = await supabase
      .from('completed_checklists')
      .select('*, checklists(name, frequency), assets:assets(id, name, asset_id)')
      .in('asset_id', aggregateAssetIds)
      .order('completion_date', { ascending: false })
      .limit(50)

    const { data: maintenance_history } = await supabase
      .from('maintenance_history')
      .select('*, assets:assets(id, name, asset_id)')
      .in('asset_id', aggregateAssetIds)
      .order('date', { ascending: false })
      .limit(50)

    // Upcoming maintenance (aggregate) using cyclic logic - interval-value coverage
    let upcoming_maintenance: any[] = []
    try {
      const modelIds = Array.from(new Set((components || []).map((c: any) => c.model_id).filter(Boolean)))
      const intervalsByModel: Record<string, any[]> = {}
      const intervalIds = new Set<string>()
      if (modelIds.length > 0) {
        const { data: intervals } = await supabase
          .from('maintenance_intervals')
          .select('*')
          .in('model_id', modelIds as string[])
        ;(intervals || []).forEach((it: any) => {
          if (!it.model_id) return
          intervalsByModel[it.model_id] = intervalsByModel[it.model_id] || []
          intervalsByModel[it.model_id].push(it)
          intervalIds.add(it.id)
        })
      }

      const historyByAsset: Record<string, any[]> = {}
      ;(maintenance_history || []).forEach((m: any) => {
        if (!m.asset_id) return
        historyByAsset[m.asset_id] = historyByAsset[m.asset_id] || []
        historyByAsset[m.asset_id].push(m)
      })

      for (const c of components || []) {
        const modelIntervals = intervalsByModel[c.model_id] || []
        if (modelIntervals.length === 0) continue

        const unit = getMaintenanceUnit(c)
        const currentValue = getCurrentValue(c, unit)
        const componentHistory = historyByAsset[c.id] || []

        const intervalResults = computeCyclicIntervalResults({
          intervals: modelIntervals,
          history: componentHistory,
          currentValue,
          unit,
          options: { applyEarliestUnpaid: true },
        })

        for (const r of filterRelevantCyclicResults(intervalResults)) {
          if (r.status === 'completed') continue

          upcoming_maintenance.push({
            asset_id: c.id,
            asset_name: c.name,
            interval_id: r.intervalId,
            interval_name: formatIntervalLabel(r.interval, unit),
            interval_description: r.interval.description,
            type: r.interval.type,
            interval_value: r.interval.interval_value,
            current_value: r.currentValue,
            target_value: r.nextDueValue ?? r.interval.interval_value,
            status: r.status,
            urgency: r.urgency,
          })
        }
      }

      const statusPriority: Record<string, number> = { overdue: 4, upcoming: 3, scheduled: 2, covered: 1 }
      const urgencyPriority: Record<string, number> = { high: 3, medium: 2, low: 1 }
      upcoming_maintenance.sort((a, b) => {
        const pa = statusPriority[a.status] || 0
        const pb = statusPriority[b.status] || 0
        if (pa !== pb) return pb - pa
        const ua = urgencyPriority[a.urgency] || 0
        const ub = urgencyPriority[b.urgency] || 0
        if (ua !== ub) return ub - ua
        return (a.interval_value || 0) - (b.interval_value || 0)
      })
    } catch {}

    // Sibling-drift detection: when coupling is OFF for a dimension, flag components
    // whose last meter event in that dimension is stale (>30 days older than the freshest sibling).
    const DRIFT_DAYS = 30
    let sibling_drift: Record<string, { hours_stale: boolean; km_stale: boolean }> = {}

    const needsHoursDrift = composite.composite_sync_hours === false
    const needsKmDrift = composite.composite_sync_kilometers === false

    if ((needsHoursDrift || needsKmDrift) && componentIds.length > 1) {
      try {
        // Fetch last meter event per component for each relevant dimension
        const { data: meterEvents } = await supabase
          .from('asset_meter_reading_events')
          .select('asset_id, event_at, hours_reading, km_reading')
          .in('asset_id', componentIds)
          .order('event_at', { ascending: false })

        // Build last event dates per component per dimension
        const lastHours: Record<string, Date> = {}
        const lastKm: Record<string, Date> = {}
        for (const ev of meterEvents || []) {
          const dt = new Date(ev.event_at)
          if (ev.hours_reading != null && !lastHours[ev.asset_id]) lastHours[ev.asset_id] = dt
          if (ev.km_reading != null && !lastKm[ev.asset_id]) lastKm[ev.asset_id] = dt
        }

        const msPerDay = 86_400_000
        const freshestHours = Object.values(lastHours).length > 0
          ? Math.max(...Object.values(lastHours).map(d => d.getTime()))
          : 0
        const freshestKm = Object.values(lastKm).length > 0
          ? Math.max(...Object.values(lastKm).map(d => d.getTime()))
          : 0

        for (const cid of componentIds) {
          const hDate = lastHours[cid]
          const kDate = lastKm[cid]
          const hours_stale = needsHoursDrift && freshestHours > 0
            && (!hDate || (freshestHours - hDate.getTime()) / msPerDay > DRIFT_DAYS)
          const km_stale = needsKmDrift && freshestKm > 0
            && (!kDate || (freshestKm - kDate.getTime()) / msPerDay > DRIFT_DAYS)
          if (hours_stale || km_stale) {
            sibling_drift[cid] = { hours_stale, km_stale }
          }
        }
      } catch {
        // Non-blocking: drift is best-effort
      }
    }

    const fuelTargetIds =
      composite.primary_component_id &&
      componentIds.includes(composite.primary_component_id)
        ? [composite.primary_component_id]
        : componentIds

    const since = new Date()
    since.setDate(since.getDate() - 30)
    const sinceIso = since.toISOString()

    let diesel_liters_30d = 0
    let urea_liters_30d = 0
    let recent_fuel_transactions: unknown[] = []

    if (fuelTargetIds.length > 0) {
      const { data: fuelTxs } = await supabase
        .from('diesel_transactions')
        .select(
          `
          id,
          asset_id,
          quantity_liters,
          transaction_date,
          transaction_type,
          diesel_products!inner(product_type),
          assets:asset_id ( id, name, asset_id )
        `
        )
        .in('asset_id', fuelTargetIds)
        .eq('transaction_type', 'consumption')
        .eq('is_transfer', false)
        .gte('transaction_date', sinceIso)
        .order('transaction_date', { ascending: false })
        .limit(100)

      for (const tx of fuelTxs ?? []) {
        const liters = Number((tx as { quantity_liters?: number }).quantity_liters ?? 0)
        const pt = (tx as { diesel_products?: { product_type?: string } }).diesel_products
          ?.product_type
        if (pt === 'urea') urea_liters_30d += liters
        else diesel_liters_30d += liters
      }
      recent_fuel_transactions = (fuelTxs ?? []).slice(0, 15)
    }

    return NextResponse.json({
      success: true,
      data: {
        composite,
        components: components || [],
        incidents: incidents || [],
        pending_schedules: pending_schedules || [],
        completed_checklists: completed_checklists || [],
        maintenance_history: maintenance_history || [],
        upcoming_maintenance,
        sibling_drift,
        fuel_summary: {
          diesel_liters_30d,
          urea_liters_30d,
          target_component_ids: fuelTargetIds,
          recent_transactions: recent_fuel_transactions,
        },
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
