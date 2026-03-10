import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getMaintenanceUnit, getCurrentValue, getMaintenanceValue } from '@/lib/utils/maintenance-units'

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
        const maxInterval = Math.max(...modelIntervals.map((i: any) => Number(i.interval_value || 0)))
        if (!isFinite(maxInterval) || maxInterval <= 0) continue

        const currentCycle = Math.floor(currentValue / maxInterval) + 1
        const cycleStart = (currentCycle - 1) * maxInterval
        const cycleEnd = currentCycle * maxInterval

        // Preventive history: maintenance_plan_id matches an interval (IS the interval id)
        const preventiveHistory = (historyByAsset[c.id] || []).filter((m: any) => {
          const typeLower = m?.type?.toLowerCase()
          const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo'
          return isPreventive && m?.maintenance_plan_id && intervalIds.has(m.maintenance_plan_id)
        })

        const currentCycleMaintenances = preventiveHistory.filter((m: any) => {
          const mValue = getMaintenanceValue(m, unit)
          return mValue > cycleStart && mValue < cycleEnd
        })

        const intervalById = new Map(modelIntervals.map((i: any) => [i.id, i]))

        for (const interval of modelIntervals) {
          const intervalValue = Number(interval.interval_value || 0)
          const isFirstCycleOnly = Boolean((interval as any).is_first_cycle_only)
          if (isFirstCycleOnly && currentCycle !== 1) continue

          let due = ((currentCycle - 1) * maxInterval) + intervalValue
          if (due > cycleEnd) {
            due = (currentCycle * maxInterval) + intervalValue
            if (due - currentValue > 1000) continue
          }

          const wasPerformed = currentCycleMaintenances.some((m: any) => m.maintenance_plan_id === interval.id)
          const isCovered = !wasPerformed && currentCycleMaintenances.some((m: any) => {
            const performed = intervalById.get(m.maintenance_plan_id)
            if (!performed) return false
            return performed.type === interval.type &&
              Number(performed.interval_value || 0) >= intervalValue
          })

          let status = 'scheduled'
          if (wasPerformed) status = 'completed'
          else if (isCovered) status = 'covered'
          else if (currentValue >= due) status = 'overdue'
          else if (currentValue >= due - 100) status = 'upcoming'

          // Exclude completed from aggregate list (no action needed)
          if (status === 'completed') continue

          let urgency = 'low'
          if (status === 'upcoming') {
            const remaining = due - currentValue
            urgency = remaining <= 50 ? 'high' : 'medium'
          } else if (status === 'overdue') urgency = 'high'

          upcoming_maintenance.push({
            asset_id: c.id,
            asset_name: c.name,
            interval_id: interval.id,
            interval_name: interval.description || `${interval.type} ${interval.interval_value}${unit === 'kilometers' ? 'km' : 'h'}`,
            type: interval.type,
            interval_value: interval.interval_value,
            current_value: currentValue,
            target_value: due,
            status,
            urgency
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
