/**
 * Same logic as supabase/functions/maintenance-alerts-schedule — keep in sync.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCyclicIntervalResults,
  parseMaintenanceUnitString,
  selectCyclicSummaryInterval,
} from '@/lib/utils/cyclic-maintenance'

export interface MaintenanceAlert {
  asset_id: string
  asset_code: string
  asset_name: string
  plant_id: string
  plant_name: string
  business_unit_id: string | null
  maintenance_unit: string
  current_hours?: number
  current_kilometers?: number
  maintenance_plan_name: string | null
  interval_value?: number
  last_service_date: string | null
  last_service_hours?: number
  last_service_kilometers?: number
  last_service_interval_value?: number
  hours_remaining?: number
  kilometers_remaining?: number
  hours_overdue?: number
  kilometers_overdue?: number
}

export async function calculateMaintenanceSummary(supabase: SupabaseClient): Promise<MaintenanceAlert[]> {
  // Fetch all assets with their models and plants
  const { data: businessUnitsRaw } = await supabase
    .from('business_units')
    .select(`
      id, name,
      plants:plants(
        id, name, business_unit_id,
        assets:assets(
          id, asset_id, name, plant_id, model_id,
          current_hours, current_kilometers,
          equipment_models(
            id, name, maintenance_unit
          )
        )
      )
    `)
    .order('name')
  
  // Build flat asset list
  const assets: any[] = []
  for (const bu of (businessUnitsRaw || [])) {
    for (const plant of (bu.plants || [])) {
      for (const asset of (plant.assets || [])) {
        assets.push({
          id: asset.id,
          asset_code: asset.asset_id,
          asset_name: asset.name,
          plant_id: asset.plant_id,
          plant_name: plant.name,
          business_unit_id: plant.business_unit_id,
          model_id: asset.model_id,
          current_hours: asset.current_hours || 0,
          current_kilometers: asset.current_kilometers || 0,
          maintenance_unit: (asset as any).equipment_models?.maintenance_unit || 'hours'
        })
      }
    }
  }
  
  if (assets.length === 0) {
    return []
  }
  
  // Get model IDs and fetch intervals
  const modelIds = Array.from(new Set(assets.map(a => a.model_id).filter(Boolean)))
  const { data: maintenanceIntervals } = await supabase
    .from('maintenance_intervals')
    .select('id, model_id, interval_value, name, type, is_first_cycle_only, is_recurring')
    .in('model_id', modelIds)
  
  // Group intervals by model_id
  const intervalsByModel = new Map<string, any[]>()
  ;(maintenanceIntervals || []).forEach(interval => {
    if (!interval.model_id) return
    if (!intervalsByModel.has(interval.model_id)) {
      intervalsByModel.set(interval.model_id, [])
    }
    intervalsByModel.get(interval.model_id)!.push(interval)
  })
  
  // Fetch maintenance history
  const assetIds = assets.map(a => a.id)
  const { data: maintenanceHistory } = await supabase
    .from('maintenance_history')
    .select('asset_id, maintenance_plan_id, hours, kilometers, date, type')
    .in('asset_id', assetIds)
    .or('type.eq.preventive,type.eq.Preventivo,type.eq.preventivo')
    .not('maintenance_plan_id', 'is', null)
    .order('date', { ascending: false })
  
  const alerts: MaintenanceAlert[] = []

  for (const asset of assets) {
    const intervals = intervalsByModel.get(asset.model_id || '') || []
    const assetMaintenanceHistory = (maintenanceHistory || []).filter(
      (mh) => mh.asset_id === asset.id
    )
    const maintenanceUnit = parseMaintenanceUnitString(asset.maintenance_unit)
    const currentValue =
      maintenanceUnit === 'hours'
        ? Number(asset.current_hours) || 0
        : Number(asset.current_kilometers) || 0

    let selectedInterval: { id: string; interval_value?: number; name?: string } | null = null
    let lastServiceDate: string | null = null
    let lastServiceValue: number | null = null
    let lastServiceIntervalValue: number | null = null
    let hoursOverdue: number | undefined = undefined
    let kilometersOverdue: number | undefined = undefined
    let hoursRemaining: number | undefined = undefined
    let kilometersRemaining: number | undefined = undefined

    if (intervals.length > 0) {
      const intervalResults = computeCyclicIntervalResults({
        intervals,
        history: assetMaintenanceHistory,
        currentValue,
        unit: maintenanceUnit,
      })
      const selection = selectCyclicSummaryInterval({
        intervalResults,
        history: assetMaintenanceHistory,
        intervals,
        currentValue,
        unit: maintenanceUnit,
      })
      selectedInterval = selection.selectedInterval
      lastServiceDate = selection.lastServiceDate
      lastServiceValue = selection.lastServiceValue
      lastServiceIntervalValue = selection.lastServiceIntervalValue
      if (maintenanceUnit === 'hours') {
        hoursOverdue = selection.overdue
        hoursRemaining = selection.remaining
      } else {
        kilometersOverdue = selection.overdue
        kilometersRemaining = selection.remaining
      }
    }

    // Build maintenance plan name
    let maintenancePlanName: string | null = null
    if (selectedInterval) {
      const intervalValue = selectedInterval.interval_value || 0
      const unit = maintenanceUnit === 'hours' ? 'h' : 'km'
      const intervalName = selectedInterval.name || `${intervalValue} ${unit}`
      maintenancePlanName = intervalName
    }
    
    alerts.push({
      asset_id: asset.id,
      asset_code: asset.asset_code,
      asset_name: asset.asset_name,
      plant_id: asset.plant_id,
      plant_name: asset.plant_name,
      business_unit_id: asset.business_unit_id,
      maintenance_unit: maintenanceUnit,
      current_hours: maintenanceUnit === 'hours' ? asset.current_hours : undefined,
      current_kilometers: maintenanceUnit === 'kilometers' ? asset.current_kilometers : undefined,
      maintenance_plan_name: maintenancePlanName,
      interval_value: selectedInterval?.interval_value,
      last_service_date: lastServiceDate,
      last_service_hours: maintenanceUnit === 'hours' ? lastServiceValue : undefined,
      last_service_kilometers: maintenanceUnit === 'kilometers' ? lastServiceValue : undefined,
      last_service_interval_value: lastServiceIntervalValue,
      hours_remaining: hoursRemaining,
      kilometers_remaining: kilometersRemaining,
      hours_overdue: hoursOverdue,
      kilometers_overdue: kilometersOverdue
    })
  }
  
  return alerts
}
