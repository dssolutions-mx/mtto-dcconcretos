import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Fetch composite
    const { data: composite, error: compError } = await supabase
      .from('assets')
      .select('id, name, is_composite, component_assets')
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

    // Fetch components (with plant/department for header context)
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
        departments:departments ( id, name )
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

    // Upcoming maintenance (aggregate) using models & cyclic logic
    let upcoming_maintenance: any[] = []
    try {
      const modelIds = Array.from(new Set((components || []).map((c: any) => c.model_id).filter(Boolean)))
      let intervalsByModel: Record<string, any[]> = {}
      if (modelIds.length > 0) {
        const { data: intervals } = await supabase
          .from('maintenance_intervals')
          .select('*')
          .in('model_id', modelIds as string[])
        intervalsByModel = (intervals || []).reduce((acc: any, it: any) => {
          acc[it.model_id] = acc[it.model_id] || []
          acc[it.model_id].push(it)
          return acc
        }, {})
      }

      const historyByAsset: Record<string, any[]> = {}
      ;(maintenance_history || []).forEach((m: any) => {
        historyByAsset[m.asset_id] = historyByAsset[m.asset_id] || []
        historyByAsset[m.asset_id].push(m)
      })

      for (const c of components || []) {
        const currentHours = Number(c.current_hours || 0)
        const assetHistory = (historyByAsset[c.id] || []).sort((a, b) => (Number(b.hours || 0) - Number(a.hours || 0)))
        const modelIntervals = intervalsByModel[c.model_id] || []
        if (modelIntervals.length === 0) continue

        const maxInterval = Math.max(...modelIntervals.map((i: any) => Number(i.interval_value || 0)))
        if (!isFinite(maxInterval) || maxInterval <= 0) continue

        const currentCycle = Math.floor(currentHours / maxInterval) + 1
        const currentCycleStartHour = (currentCycle - 1) * maxInterval
        const currentCycleEndHour = currentCycle * maxInterval
        const highestMaintenanceInCycle = assetHistory
          .map(h => Number(h.hours) || 0)
          .filter(h => h > currentCycleStartHour && h < currentCycleEndHour)
          .reduce((mx, v) => Math.max(mx, v), 0)

        for (const interval of modelIntervals) {
          const intervalHours = Number(interval.interval_value || 0)
          const isFirstCycleOnly = Boolean((interval as any).is_first_cycle_only)
          if (isFirstCycleOnly && currentCycle !== 1) continue

          let due = ((currentCycle - 1) * maxInterval) + intervalHours
          let status = 'scheduled'
          if (due > currentCycleEndHour) {
            due = (currentCycle * maxInterval) + intervalHours
            if (due - currentHours > 1000) continue
          } else {
            const cycleIntervalHour = due - currentCycleStartHour
            const highestRelativeHour = highestMaintenanceInCycle - currentCycleStartHour
            if (highestRelativeHour >= cycleIntervalHour && highestMaintenanceInCycle > 0) {
              status = 'covered'
            } else if (currentHours >= due) {
              status = 'overdue'
            } else if (currentHours >= due - 100) {
              status = 'upcoming'
            }
          }

          let urgency = 'low'
          if (status === 'upcoming') {
            const hoursRemaining = due - currentHours
            urgency = hoursRemaining <= 50 ? 'high' : 'medium'
          } else if (status === 'overdue') {
            urgency = 'high'
          }

          upcoming_maintenance.push({
            asset_id: c.id,
            asset_name: c.name,
            interval_id: interval.id,
            interval_name: interval.description || `${interval.type} ${interval.interval_value}h`,
            type: interval.type,
            interval_value: interval.interval_value,
            current_value: currentHours,
            target_value: due,
            status,
            urgency
          })
        }
      }

      // Sort by priority
      const statusPriority: any = { overdue: 4, upcoming: 3, scheduled: 2, covered: 1 }
      const urgencyPriority: any = { high: 3, medium: 2, low: 1 }
      upcoming_maintenance.sort((a, b) => {
        const pa = (statusPriority[a.status] || 0)
        const pb = (statusPriority[b.status] || 0)
        if (pa !== pb) return pb - pa
        const ua = (urgencyPriority[a.urgency] || 0)
        const ub = (urgencyPriority[b.urgency] || 0)
        if (ua !== ub) return ub - ua
        return (a.interval_value || 0) - (b.interval_value || 0)
      })
    } catch {}

    return NextResponse.json({
      success: true,
      data: {
        composite,
        components: components || [],
        incidents: incidents || [],
        pending_schedules: pending_schedules || [],
        completed_checklists: completed_checklists || [],
        maintenance_history: maintenance_history || [],
        upcoming_maintenance
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
