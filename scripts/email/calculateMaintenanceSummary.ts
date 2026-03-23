/**
 * Same logic as supabase/functions/maintenance-alerts-schedule — keep in sync.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

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
  
  // Process each asset
  const alerts: MaintenanceAlert[] = []
  
  for (const asset of assets) {
    const intervals = intervalsByModel.get(asset.model_id || '') || []
    const assetMaintenanceHistory = (maintenanceHistory || []).filter(mh => mh.asset_id === asset.id)
    const maintenanceUnit = asset.maintenance_unit || 'hours'
    const currentValue = maintenanceUnit === 'hours' ? asset.current_hours : asset.current_kilometers
    
    let selectedInterval: any = null
    let lastServiceDate: string | null = null
    let lastServiceValue: number | null = null
    let lastServiceIntervalValue: number | null = null
    let hoursOverdue: number | undefined = undefined
    let kilometersOverdue: number | undefined = undefined
    let hoursRemaining: number | undefined = undefined
    let kilometersRemaining: number | undefined = undefined
    
    if (intervals.length > 0 && maintenanceUnit === 'hours') {
      const maxInterval = Math.max(...intervals.map(i => i.interval_value || 0))
      if (maxInterval > 0) {
        const currentCycle = Math.floor(currentValue / maxInterval) + 1
        const currentCycleStartHour = (currentCycle - 1) * maxInterval
        const currentCycleEndHour = currentCycle * maxInterval
        
        // Filter preventive history
        const preventiveHistory = assetMaintenanceHistory.filter(m => {
          const typeLower = m?.type?.toLowerCase()
          const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo'
          if (!isPreventive || !m?.maintenance_plan_id) return false
          return intervals.some(interval => interval.id === m.maintenance_plan_id)
        })
        
        // Current cycle maintenances
        const currentCycleMaintenances = preventiveHistory.filter(m => {
          const mHours = Number(m.hours) || 0
          return mHours > currentCycleStartHour && mHours < currentCycleEndHour
        })
        
        // Process intervals
        const intervalStatuses = intervals.map(interval => {
          const intervalHours = interval.interval_value || 0
          const isRecurring = (interval as any).is_recurring !== false
          const isFirstCycleOnly = (interval as any).is_first_cycle_only === true
          
          if (isFirstCycleOnly && currentCycle !== 1) {
            return { interval, status: 'not_applicable', nextDueHour: null }
          }
          
          let nextDueHour = ((currentCycle - 1) * maxInterval) + intervalHours
          let cycleForService = currentCycle
          
          if (nextDueHour > currentCycleEndHour) {
            cycleForService = currentCycle + 1
            nextDueHour = (currentCycle * maxInterval) + intervalHours
            if (nextDueHour - currentValue > 1000) {
              return { interval, status: 'not_applicable', nextDueHour: null }
            }
          }
          
          // Check completion
          const wasPerformedInCurrentCycle = cycleForService === currentCycle && 
            currentCycleMaintenances.some(m => m.maintenance_plan_id === interval.id)
          
          if (wasPerformedInCurrentCycle) {
            return { interval, status: 'completed', nextDueHour }
          }
          
          // Check coverage (with timing check)
          const isCoveredByHigher = cycleForService === currentCycle && 
            currentCycleMaintenances.some((m: any) => {
              const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
              if (!performedInterval) return false
              const sameUnit = performedInterval.type === interval.type
              const sameCategory = (performedInterval as any).maintenance_category === (interval as any).maintenance_category
              const categoryOk = (performedInterval as any).maintenance_category && (interval as any).maintenance_category 
                ? sameCategory 
                : true
              const higherOrEqual = Number(performedInterval.interval_value) >= Number(interval.interval_value)
              const performedAtHour = Number(m.hours) || 0
              const performedAfterDue = performedAtHour >= nextDueHour
              return sameUnit && categoryOk && higherOrEqual && performedAfterDue
            })
          
          if (isCoveredByHigher) {
            return { interval, status: 'covered', nextDueHour }
          }
          
          // Determine status
          if (cycleForService === currentCycle) {
            if (currentValue >= nextDueHour) {
              return { interval, status: 'overdue', nextDueHour }
            } else if (currentValue >= nextDueHour - 100) {
              return { interval, status: 'upcoming', nextDueHour }
            } else {
              return { interval, status: 'scheduled', nextDueHour }
            }
          } else {
            return { interval, status: 'scheduled', nextDueHour }
          }
        })
        
        // Filter actionable intervals
        const actionableIntervals = intervalStatuses.filter(
          s => s.status !== 'not_applicable' && s.status !== 'completed' && s.status !== 'covered'
        )
        
        // Find last service
        if (preventiveHistory.length > 0) {
          const allPreventiveMaintenance = preventiveHistory
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          if (allPreventiveMaintenance.length > 0) {
            lastServiceDate = allPreventiveMaintenance[0].date
            lastServiceValue = allPreventiveMaintenance[0].hours
            const lastServiceInterval = intervals.find(i => i.id === allPreventiveMaintenance[0].maintenance_plan_id)
            lastServiceIntervalValue = lastServiceInterval?.interval_value || null
          }
        }
        
        // Select interval (overdue first, then upcoming)
        if (actionableIntervals.length > 0) {
          const overdueIntervals = actionableIntervals.filter(s => s.status === 'overdue')
          if (overdueIntervals.length > 0) {
            selectedInterval = overdueIntervals.reduce((first, item) => {
              if (item.interval.interval_value < first.interval.interval_value) {
                return item
              } else if (item.interval.interval_value === first.interval.interval_value) {
                const overdue = currentValue - (item.nextDueHour || 0)
                const firstOverdue = currentValue - (first.nextDueHour || 0)
                return overdue > firstOverdue ? item : first
              }
              return first
            }).interval
            
            const overdueItem = overdueIntervals.find(item => item.interval.id === selectedInterval.id)
            const overdue = currentValue - (overdueItem?.nextDueHour || 0)
            hoursOverdue = overdue
            
            // Update last service for this interval (only if more recent than overall last service)
            const lastServiceForInterval = assetMaintenanceHistory
              .filter(m => m.maintenance_plan_id === selectedInterval.id)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            if (lastServiceForInterval) {
              const lastServiceForIntervalDate = new Date(lastServiceForInterval.date).getTime()
              const currentLastServiceDate = lastServiceDate ? new Date(lastServiceDate).getTime() : 0
              
              // Only update if this interval's last service is more recent than the overall last service
              if (lastServiceForIntervalDate >= currentLastServiceDate) {
                lastServiceDate = lastServiceForInterval.date
                lastServiceValue = lastServiceForInterval.hours
                lastServiceIntervalValue = selectedInterval.interval_value || null
              }
              // Otherwise keep the more recent overall service - DO NOT change lastServiceIntervalValue
              // lastServiceIntervalValue should always reflect the interval of the actual last service performed
            }
          } else {
            const upcomingIntervals = actionableIntervals.filter(s => s.status === 'upcoming' || s.status === 'scheduled')
            if (upcomingIntervals.length > 0) {
              selectedInterval = upcomingIntervals.reduce((min, item) => {
                return (item.nextDueHour || Infinity) < (min.nextDueHour || Infinity) ? item : min
              }).interval
              
              const upcomingItem = upcomingIntervals.find(item => item.interval.id === selectedInterval.id)
              const remaining = (upcomingItem?.nextDueHour || 0) - currentValue
              hoursRemaining = remaining
              
              const lastServiceForInterval = assetMaintenanceHistory
                .filter(m => m.maintenance_plan_id === selectedInterval.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
              if (lastServiceForInterval) {
                const lastServiceForIntervalDate = new Date(lastServiceForInterval.date).getTime()
                const currentLastServiceDate = lastServiceDate ? new Date(lastServiceDate).getTime() : 0
                
                // Only update if this interval's last service is more recent than the overall last service
                if (lastServiceForIntervalDate >= currentLastServiceDate) {
                  lastServiceDate = lastServiceForInterval.date
                  lastServiceValue = lastServiceForInterval.hours
                  lastServiceIntervalValue = selectedInterval.interval_value || null
                }
                // Otherwise keep the more recent overall service - DO NOT change lastServiceIntervalValue
                // lastServiceIntervalValue should always reflect the interval of the actual last service performed
              }
            }
          }
        }
      }
    } else if (intervals.length > 0 && maintenanceUnit === 'kilometers') {
      // Similar logic for kilometers (simplified version)
      const maxInterval = Math.max(...intervals.map(i => i.interval_value || 0))
      if (maxInterval > 0) {
        const currentCycle = Math.floor(currentValue / maxInterval) + 1
        const currentCycleStartKm = (currentCycle - 1) * maxInterval
        const currentCycleEndKm = currentCycle * maxInterval
        
        const preventiveHistory = assetMaintenanceHistory.filter(m => {
          const typeLower = m?.type?.toLowerCase()
          const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo'
          if (!isPreventive || !m?.maintenance_plan_id) return false
          return intervals.some(interval => interval.id === m.maintenance_plan_id)
        })
        
        const currentCycleMaintenances = preventiveHistory.filter(m => {
          const mKm = Number(m.kilometers) || 0
          return mKm > currentCycleStartKm && mKm < currentCycleEndKm
        })
        
        // Process intervals
        const intervalStatuses = intervals.map(interval => {
          const intervalKm = interval.interval_value || 0
          const isRecurring = (interval as any).is_recurring !== false
          const isFirstCycleOnly = (interval as any).is_first_cycle_only === true
          
          if (isFirstCycleOnly && currentCycle !== 1) {
            return { interval, status: 'not_applicable', nextDueKm: null }
          }
          
          let nextDueKm = ((currentCycle - 1) * maxInterval) + intervalKm
          let cycleForService = currentCycle
          
          if (nextDueKm > currentCycleEndKm) {
            cycleForService = currentCycle + 1
            nextDueKm = (currentCycle * maxInterval) + intervalKm
            if (nextDueKm - currentValue > 1000) {
              return { interval, status: 'not_applicable', nextDueKm: null }
            }
          }
          
          // Check completion
          const wasPerformedInCurrentCycle = cycleForService === currentCycle && 
            currentCycleMaintenances.some(m => m.maintenance_plan_id === interval.id)
          
          if (wasPerformedInCurrentCycle) {
            return { interval, status: 'completed', nextDueKm }
          }
          
          // Check coverage (with timing check)
          const isCoveredByHigher = cycleForService === currentCycle && 
            currentCycleMaintenances.some((m: any) => {
              const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
              if (!performedInterval) return false
              const sameUnit = performedInterval.type === interval.type
              const sameCategory = (performedInterval as any).maintenance_category === (interval as any).maintenance_category
              const categoryOk = (performedInterval as any).maintenance_category && (interval as any).maintenance_category 
                ? sameCategory 
                : true
              const higherOrEqual = Number(performedInterval.interval_value) >= Number(interval.interval_value)
              const performedAtKm = Number(m.kilometers) || 0
              const performedAfterDue = performedAtKm >= nextDueKm
              return sameUnit && categoryOk && higherOrEqual && performedAfterDue
            })
          
          if (isCoveredByHigher) {
            return { interval, status: 'covered', nextDueKm }
          }
          
          // Determine status
          if (cycleForService === currentCycle) {
            if (currentValue >= nextDueKm) {
              return { interval, status: 'overdue', nextDueKm }
            } else if (currentValue >= nextDueKm - 100) {
              return { interval, status: 'upcoming', nextDueKm }
            } else {
              return { interval, status: 'scheduled', nextDueKm }
            }
          } else {
            return { interval, status: 'scheduled', nextDueKm }
          }
        })
        
        // Filter actionable intervals
        const actionableIntervals = intervalStatuses.filter(
          s => s.status !== 'not_applicable' && s.status !== 'completed' && s.status !== 'covered'
        )
        
        // Find last service
        if (preventiveHistory.length > 0) {
          const allPreventiveMaintenance = preventiveHistory
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          if (allPreventiveMaintenance.length > 0) {
            lastServiceDate = allPreventiveMaintenance[0].date
            lastServiceValue = allPreventiveMaintenance[0].kilometers
            const lastServiceInterval = intervals.find(i => i.id === allPreventiveMaintenance[0].maintenance_plan_id)
            lastServiceIntervalValue = lastServiceInterval?.interval_value || null
          }
        }
        
        // Select interval (overdue first, then upcoming)
        if (actionableIntervals.length > 0) {
          const overdueIntervals = actionableIntervals.filter(s => s.status === 'overdue')
          if (overdueIntervals.length > 0) {
            selectedInterval = overdueIntervals.reduce((first, item) => {
              if (item.interval.interval_value < first.interval.interval_value) {
                return item
              } else if (item.interval.interval_value === first.interval.interval_value) {
                const overdue = currentValue - ((item as any).nextDueKm || 0)
                const firstOverdue = currentValue - ((first as any).nextDueKm || 0)
                return overdue > firstOverdue ? item : first
              }
              return first
            }).interval
            
            const overdueItem = overdueIntervals.find(item => item.interval.id === selectedInterval.id)
            const overdue = currentValue - ((overdueItem as any).nextDueKm || 0)
            kilometersOverdue = overdue
            
            // Update last service for this interval (only if more recent than overall last service)
            const lastServiceForInterval = assetMaintenanceHistory
              .filter(m => m.maintenance_plan_id === selectedInterval.id)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            if (lastServiceForInterval) {
              const lastServiceForIntervalDate = new Date(lastServiceForInterval.date).getTime()
              const currentLastServiceDate = lastServiceDate ? new Date(lastServiceDate).getTime() : 0
              
              // Only update if this interval's last service is more recent than the overall last service
              if (lastServiceForIntervalDate >= currentLastServiceDate) {
                lastServiceDate = lastServiceForInterval.date
                lastServiceValue = lastServiceForInterval.kilometers
                lastServiceIntervalValue = selectedInterval.interval_value || null
              }
              // Otherwise keep the more recent overall service - DO NOT change lastServiceIntervalValue
              // lastServiceIntervalValue should always reflect the interval of the actual last service performed
            }
          } else {
            const upcomingIntervals = actionableIntervals.filter(s => s.status === 'upcoming' || s.status === 'scheduled')
            if (upcomingIntervals.length > 0) {
              selectedInterval = upcomingIntervals.reduce((min, item) => {
                return ((item as any).nextDueKm || Infinity) < ((min as any).nextDueKm || Infinity) ? item : min
              }).interval
              
              const upcomingItem = upcomingIntervals.find(item => item.interval.id === selectedInterval.id)
              const remaining = ((upcomingItem as any).nextDueKm || 0) - currentValue
              kilometersRemaining = remaining
              
              const lastServiceForInterval = assetMaintenanceHistory
                .filter(m => m.maintenance_plan_id === selectedInterval.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
              if (lastServiceForInterval) {
                const lastServiceForIntervalDate = new Date(lastServiceForInterval.date).getTime()
                const currentLastServiceDate = lastServiceDate ? new Date(lastServiceDate).getTime() : 0
                
                // Only update if this interval's last service is more recent than the overall last service
                if (lastServiceForIntervalDate >= currentLastServiceDate) {
                  lastServiceDate = lastServiceForInterval.date
                  lastServiceValue = lastServiceForInterval.kilometers
                  lastServiceIntervalValue = selectedInterval.interval_value || null
                }
                // Otherwise keep the more recent overall service - DO NOT change lastServiceIntervalValue
                // lastServiceIntervalValue should always reflect the interval of the actual last service performed
              }
            }
          }
        }
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
