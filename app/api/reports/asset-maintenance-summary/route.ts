import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from '@/lib/reporting/asset-plant-attribution'
import {
  checklistReadingEventTimeMs,
  fetchDieselConsumptionCostRowsForAssets,
  fetchDieselHorometerFromMeterView,
  meterHorometerRowsInReportWindow,
  type DieselHorometerRowForMerge,
} from '@/lib/reports/merged-operating-hours'
import { formatMexicoCityDateOnly } from '@/lib/reports/mexico-city-report-window'
import {
  computeCyclicIntervalResults,
  parseMaintenanceUnitString,
  selectCyclicSummaryInterval,
} from '@/lib/utils/cyclic-maintenance'

type Body = {
  dateFrom: string
  dateTo: string
  businessUnitId?: string | null
  plantId?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { dateFrom, dateTo, businessUnitId, plantId } = (await req.json()) as Body

    // Normalize dates to YYYY-MM-DD for consistency
    const dateFromStr = typeof dateFrom === 'string' && dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom
    const dateToStr = typeof dateTo === 'string' && dateTo.includes('T') ? dateTo.split('T')[0] : dateTo

    // Compute exclusive end-of-day bound in UTC for consistency with other report APIs
    const dateFromStart = new Date(`${dateFromStr}T00:00:00.000Z`)
    const dateToExclusive = new Date(`${dateToStr}T00:00:00.000Z`)
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
    const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)

    const supabase = await createServerSupabase()

    // Get organizational structure with assets
    const buQuery = supabase
      .from('business_units')
      .select(`
        id, name, code,
        plants:plants(
          id, name, code, business_unit_id,
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

    const { data: businessUnitsRaw, error: buError } = await buQuery
    if (buError) {
      console.error('Business units error:', buError)
      throw buError
    }

    // Build full org maps and raw asset list first.
    // Apply BU/plant filters only after historical attribution to avoid
    // using current asset location for past periods.
    const plantById = new Map<string, { id: string; name: string; code: string; business_unit_id: string; business_unit_name: string }>()
    const rawAssets: any[] = []
    const allBusinessUnits = businessUnitsRaw || []
    
    for (const bu of allBusinessUnits) {
      for (const plant of (bu.plants || [])) {
        plantById.set(plant.id, {
          id: plant.id,
          name: plant.name,
          code: plant.code,
          business_unit_id: bu.id,
          business_unit_name: bu.name,
        })
        
        for (const asset of (plant.assets || [])) {
          rawAssets.push({
            id: asset.id,
            asset_code: asset.asset_id,
            asset_name: asset.name,
            current_plant_id: plant.id,
            current_plant_name: plant.name,
            current_business_unit_id: bu.id,
            current_business_unit_name: bu.name,
            model_id: asset.model_id,
            current_hours: asset.current_hours || 0,
            current_kilometers: asset.current_kilometers || 0,
            maintenance_unit: (asset as any).equipment_models?.maintenance_unit || 'hours'
          })
        }
      }
    }

    const rawAssetIds = rawAssets.map((a) => a.id)
    const attributionDate = `${dateToStr}T23:59:59.999Z`
    let assignmentRows: any[] = []
    if (rawAssetIds.length > 0) {
      const { data, error: assignmentError } = await supabase
        .from('asset_assignment_history')
        .select('asset_id, previous_plant_id, new_plant_id, created_at')
        .in('asset_id', rawAssetIds)
        .order('created_at', { ascending: true })
      if (assignmentError) throw assignmentError
      assignmentRows = data || []
    }
    const assignmentHistoryMap = buildAssignmentHistoryMap(assignmentRows)

    const assets: any[] = rawAssets
      .map((asset) => {
        const attributedPlantId = resolveAssetPlantAtTimestamp({
          assetId: asset.id,
          eventDate: attributionDate,
          currentPlantId: asset.current_plant_id,
          historyByAsset: assignmentHistoryMap,
        })
        const attributedPlant = attributedPlantId ? plantById.get(attributedPlantId) : null
        if (!attributedPlant) return null

        return {
          ...asset,
          plant_id: attributedPlant.id,
          plant_name: attributedPlant.name,
          business_unit_id: attributedPlant.business_unit_id,
          business_unit_name: attributedPlant.business_unit_name,
        }
      })
      .filter((asset): asset is any => {
        if (!asset) return false
        if (businessUnitId && asset.business_unit_id !== businessUnitId) return false
        if (plantId && asset.plant_id !== plantId) return false
        return true
      })

    if (assets.length === 0) {
      return NextResponse.json({ assets: [] })
    }

    // Get model IDs
    const modelIds = Array.from(new Set(assets.map(a => a.model_id).filter(Boolean)))
    
    // Fetch maintenance intervals for all models
    const { data: maintenanceIntervals, error: intervalsError } = await supabase
      .from('maintenance_intervals')
      .select('id, model_id, interval_value, name, type, is_first_cycle_only, is_recurring')
      .in('model_id', modelIds)

    if (intervalsError) {
      console.error('Error fetching maintenance intervals:', intervalsError)
    }

    // Group intervals by model_id
    const intervalsByModel = new Map<string, any[]>()
    ;(maintenanceIntervals || []).forEach(interval => {
      if (!interval.model_id) return
      if (!intervalsByModel.has(interval.model_id)) {
        intervalsByModel.set(interval.model_id, [])
      }
      intervalsByModel.get(interval.model_id)!.push(interval)
    })

    // Fetch maintenance history for all assets (preventive only)
    const assetIds = assets.map(a => a.id)
    // maintenance_history.maintenance_plan_id = maintenance_intervals.id (WO completion resolves from maintenance_plans.interval_id)
    const { data: maintenanceHistory, error: historyError } = await supabase
      .from('maintenance_history')
      .select(`
        asset_id, 
        maintenance_plan_id, 
        hours, 
        kilometers, 
        date, 
        type
      `)
      .in('asset_id', assetIds)
      .or('type.eq.preventive,type.eq.Preventivo,type.eq.preventivo')
      .not('maintenance_plan_id', 'is', null)
      .order('date', { ascending: false })

    if (historyError) {
      console.error('[SUMMARY API] Error fetching maintenance history:', historyError)
    }

    // Group maintenance history by asset_id and maintenance_plan_id
    const historyByAssetAndPlan = new Map<string, Map<string, any>>()
    ;(maintenanceHistory || []).forEach(mh => {
      if (!mh.asset_id) return
      if (!historyByAssetAndPlan.has(mh.asset_id)) {
        historyByAssetAndPlan.set(mh.asset_id, new Map())
      }
      const assetHistory = historyByAssetAndPlan.get(mh.asset_id)!
      if (mh.maintenance_plan_id && (!assetHistory.has(mh.maintenance_plan_id) || 
          new Date(mh.date) > new Date(assetHistory.get(mh.maintenance_plan_id)?.date || 0))) {
        assetHistory.set(mh.maintenance_plan_id, mh)
      }
    })

    // Diesel: horometer curve from `asset_meter_reading_events` (one extended fetch; in-period rows sliced in memory).
    // Liters/cost from `diesel_transactions` (fields not on the view). Same diesel membership: warehouse + product diesel.
    const extendedStartMs = dateFromStart.getTime() - 30 * 24 * 60 * 60 * 1000
    const extendedStartDateStr = formatMexicoCityDateOnly(extendedStartMs)
    const periodStartMs = dateFromStart.getTime()
    const periodEndExclusiveMs = dateToExclusive.getTime()

    const [checklistsRes, dieselHorometerExtended, dieselCostRows] = await Promise.all([
      supabase
        .from('completed_checklists')
        .select('asset_id, equipment_hours_reading, reading_timestamp, completion_date')
        .in('asset_id', assetIds)
        .gte('completion_date', extendedStartDateStr)
        .lt('completion_date', dateToExclusiveStr)
        .not('equipment_hours_reading', 'is', null),
      fetchDieselHorometerFromMeterView(supabase, {
        assetIds,
        eventAtGte: new Date(extendedStartMs).toISOString(),
        eventAtLt: dateToExclusive.toISOString(),
      }),
      fetchDieselConsumptionCostRowsForAssets(supabase, {
        assetIds,
        transactionDateGte: dateFromStr,
        transactionDateLt: dateToExclusiveStr,
      }),
    ])

    const hoursData = checklistsRes.data
    const dieselHorometerInPeriod = meterHorometerRowsInReportWindow(
      dieselHorometerExtended,
      periodStartMs,
      periodEndExclusiveMs
    )

    const productIds = Array.from(new Set(dieselCostRows.map((t) => t.product_id).filter(Boolean)))
    let products: { id: string; price_per_liter?: number | null }[] = []
    if (productIds.length > 0) {
      const { data } = await supabase.from('diesel_products').select('id, price_per_liter').in('id', productIds)
      products = data || []
    }

    const priceByProduct = new Map<string, number>()
    products.forEach((p) => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

    // Build asset map with diesel and hours data (same logic as gerencial API)
    const gerencialAssetsMap = new Map<string, any>()
    assets.forEach(asset => {
      gerencialAssetsMap.set(asset.id, {
        id: asset.id,
        asset_code: asset.asset_code,
        maintenance_cost: 0,
        preventive_cost: 0,
        corrective_cost: 0,
        diesel_cost: 0,
        diesel_liters: 0,
        hours_worked: 0,
        remisiones_count: 0,
        concrete_m3: 0
      })
    })

    const dieselByAsset = new Map<string, DieselHorometerRowForMerge[]>()
    for (const row of dieselHorometerInPeriod) {
      if (!dieselByAsset.has(row.asset_id)) dieselByAsset.set(row.asset_id, [])
      dieselByAsset.get(row.asset_id)!.push(row)
    }
    for (const tx of dieselCostRows) {
      if (!tx.asset_id) continue
      if (!dieselByAsset.has(tx.asset_id)) dieselByAsset.set(tx.asset_id, [])
    }
    type ReadingEvent = { ts: number, val: number }
    const checklistEventsByAsset = new Map<string, ReadingEvent[]>()
    
    // Build validation map from extended diesel readings (for filtering incorrect checklist readings)
    // Filter out diesel readings with unrealistic jumps to get clean validation set
    const dieselValidationByAsset = new Map<string, number[]>()
    const dieselValidationByAssetRaw = new Map<string, Array<{ val: number, date: string }>>()
    
    dieselHorometerExtended.forEach((t) => {
      if (!t.asset_id || !t.horometer_reading) return
      const val = Number(t.horometer_reading)
      if (!Number.isNaN(val)) {
        if (!dieselValidationByAssetRaw.has(t.asset_id)) {
          dieselValidationByAssetRaw.set(t.asset_id, [])
        }
        dieselValidationByAssetRaw.get(t.asset_id)!.push({ val, date: t.transaction_date })
      }
    })
    
    // Filter diesel readings: keep only those in logical sequence (no unrealistic jumps)
    dieselValidationByAssetRaw.forEach((readings, assetId) => {
      if (readings.length === 0) return
      
      // Sort by date
      readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      const validReadings: number[] = []
      const MAX_HOURS_PER_DAY = 24
      
      for (let i = 0; i < readings.length; i++) {
        const current = readings[i]
        
        if (i === 0) {
          // First reading - always include
          validReadings.push(current.val)
          continue
        }
        
        const previous = readings[i - 1]
        const timeDeltaDays = (new Date(current.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60 * 24)
        const delta = current.val - previous.val
        const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
        
        // Include if delta is reasonable (positive and <= 24h/day)
        if (delta >= 0 && (timeDeltaDays >= 60 || hoursPerDay <= MAX_HOURS_PER_DAY)) {
          validReadings.push(current.val)
        }
      }
      
      if (validReadings.length > 0) {
        dieselValidationByAsset.set(assetId, validReadings)
      }
    })
    
    ;(hoursData || []).forEach((h: any) => {
      if (!h.asset_id) return
      const val = Number(h.equipment_hours_reading)
      const ts = checklistReadingEventTimeMs({
        reading_timestamp: h.reading_timestamp,
        completion_date: h.completion_date,
      })
      if (Number.isNaN(val) || Number.isNaN(ts)) return
      if (!checklistEventsByAsset.has(h.asset_id)) checklistEventsByAsset.set(h.asset_id, [])
      checklistEventsByAsset.get(h.asset_id)!.push({ ts, val })
    })
    
    dieselCostRows.forEach((tx) => {
      if (!tx.asset_id) return
      const asset = gerencialAssetsMap.get(tx.asset_id)
      if (!asset) return
      const qty = Number(tx.quantity_liters || 0)
      const price = Number(tx.unit_cost || 0) || priceByProduct.get(tx.product_id || '') || 0
      const cost = qty * price

      asset.diesel_liters += qty
      asset.diesel_cost += cost
    })

    // Compute hours_worked per asset (SAME LOGIC AS GERENCIAL API)
    // Process ALL assets that have readings (not just those with diesel transactions)
    const allAssetIdsWithReadings = new Set<string>()
    checklistEventsByAsset.forEach((_, assetId) => allAssetIdsWithReadings.add(assetId))
    dieselByAsset.forEach((_, assetId) => allAssetIdsWithReadings.add(assetId))
    
    allAssetIdsWithReadings.forEach(assetId => {
      const asset = gerencialAssetsMap.get(assetId)
      if (!asset) return
      const events: ReadingEvent[] = []
      // Diesel meter points from unified view (in report period); timestamps match `transaction_date` on source tx.
      // Only use horometer_reading, not previous_horometer (prevents 0-time deltas)
      // Filter out diesel readings with unrealistic jumps
      const txs = dieselByAsset.get(assetId) || []
      const dieselReadingsRaw: Array<{ ts: number, val: number }> = []
      txs.forEach((t) => {
        const tts = new Date(t.transaction_date).getTime()
        if (!Number.isNaN(tts) && t.horometer_reading != null) {
          const v = Number(t.horometer_reading)
          if (!Number.isNaN(v)) dieselReadingsRaw.push({ ts: tts, val: v })
        }
      })
      
      // Filter diesel readings: keep only those in logical sequence
      const dieselReadings: ReadingEvent[] = []
      if (dieselReadingsRaw.length > 0) {
        dieselReadingsRaw.sort((a, b) => a.ts - b.ts)
        const MAX_HOURS_PER_DAY = 24
        
        for (let i = 0; i < dieselReadingsRaw.length; i++) {
          const current = dieselReadingsRaw[i]
          
          if (i === 0) {
            dieselReadings.push({ ts: current.ts, val: current.val })
            continue
          }
          
          const previous = dieselReadingsRaw[i - 1]
          const timeDeltaDays = (current.ts - previous.ts) / (1000 * 60 * 60 * 24)
          const delta = current.val - previous.val
          const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
          
          // Include if delta is reasonable (positive and <= 24h/day, or gap >60 days)
          if (delta >= 0 && (timeDeltaDays >= 60 || hoursPerDay <= MAX_HOURS_PER_DAY)) {
            dieselReadings.push({ ts: current.ts, val: current.val })
          }
        }
      }
      events.push(...dieselReadings)
      
      // Checklist events - filter out clearly incorrect readings
      // Use extended diesel readings for validation (includes readings before period start)
      const chkEvents = checklistEventsByAsset.get(assetId) || []
      const validationDieselValues = dieselValidationByAsset.get(assetId) || []
      
      if (validationDieselValues.length > 0 || dieselReadings.length > 0) {
        // Use extended diesel readings if available, otherwise use period diesel readings
        const dieselValues = validationDieselValues.length > 0 ? validationDieselValues : dieselReadings.map(e => e.val)
        const dieselMin = Math.min(...dieselValues)
        const dieselMax = Math.max(...dieselValues)
        const dieselRange = dieselMax - dieselMin
        // Allow checklist readings within 2x the diesel range (to account for readings before/after period)
        const allowedMin = dieselMin - dieselRange * 2
        const allowedMax = dieselMax + dieselRange * 2
        
        chkEvents.forEach(e => {
          if (e.val >= allowedMin && e.val <= allowedMax) {
            events.push(e)
          }
        })
      } else {
        // No diesel readings - use all checklist readings (fallback)
        events.push(...chkEvents)
      }

      if (events.length === 0) return
      
      // Sort all events chronologically
      events.sort((a, b) => a.ts - b.ts)
      
      // Remove duplicates (same timestamp and value)
      const uniqueEvents: ReadingEvent[] = []
      events.forEach(e => {
        const last = uniqueEvents[uniqueEvents.length - 1]
        if (!last || last.ts !== e.ts || last.val !== e.val) {
          uniqueEvents.push(e)
        }
      })
      
      if (uniqueEvents.length < 2) return // Need at least 2 readings
      
      const startMs = dateFromStart.getTime()
      const endMs = dateToExclusive.getTime()
      
      // Find baseline: last reading before period start, or first reading in period
      let baselineIdx = -1
      for (let i = uniqueEvents.length - 1; i >= 0; i--) {
        if (uniqueEvents[i].ts < startMs) {
          baselineIdx = i
          break
        }
      }
      // If no reading before start, use first reading in period
      if (baselineIdx === -1) {
        for (let i = 0; i < uniqueEvents.length; i++) {
          if (uniqueEvents[i].ts >= startMs) {
            baselineIdx = i
            break
          }
        }
      }
      if (baselineIdx === -1 || baselineIdx >= uniqueEvents.length - 1) return
      
      // Calculate incremental deltas between consecutive readings within the period
      // This handles resets (negative deltas) and detects unrealistic jumps
      let totalHours = 0
      const MAX_HOURS_PER_DAY = 24 // Maximum reasonable hours per day
      const MAX_HOURS_PER_MONTH = MAX_HOURS_PER_DAY * 31 // ~744 hours/month max
      
      for (let i = baselineIdx; i < uniqueEvents.length - 1; i++) {
        const current = uniqueEvents[i]
        const next = uniqueEvents[i + 1]
        
        // Only count deltas within the report period
        if (next.ts < startMs) continue
        if (current.ts >= endMs) break
        
        const delta = next.val - current.val
        
        if (delta < 0) continue // Skip negative deltas (resets)
        
        // Calculate time delta in days
        const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
        
        if (timeDeltaDays < 1/24) continue // Skip <1h gaps (duplicate readings)
        
        const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
        
        if (hoursPerDay > MAX_HOURS_PER_DAY && timeDeltaDays < 60) continue // Skip unrealistic jumps
        
        // For very large time gaps (>60 days), cap at reasonable rate (24h/day max)
        let cappedDelta = delta
        if (timeDeltaDays > 0) {
          const maxReasonableDelta = MAX_HOURS_PER_DAY * timeDeltaDays
          if (delta > maxReasonableDelta) {
            cappedDelta = maxReasonableDelta
          }
        }
        totalHours += cappedDelta
      }
      
      if (totalHours > 0) {
        asset.hours_worked = totalHours
      }
    })

    // Fetch maintenance costs and sales data from gerencial API (for purchase orders, remisiones, concrete)
    const host = req.headers.get('host') || ''
    const base = process.env.NEXT_PUBLIC_BASE_URL || (host.includes('localhost') ? `http://${host}` : `https://${host}`)
    
    let gerencialResp
    try {
      gerencialResp = await fetch(`${base}/api/reports/gerencial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          businessUnitId: businessUnitId || null,
          plantId: plantId || null,
          hideZeroActivity: false
        })
      })
    } catch (err) {
      console.error('Error calling gerencial API:', err)
    }

    const gerencialData = gerencialResp?.ok ? await gerencialResp.json() : null
    
    // Merge gerencial data (maintenance costs, remisiones, concrete) with our calculated diesel/hours
    if (gerencialData?.assets) {
      gerencialData.assets.forEach((gerencialAsset: any) => {
        const asset = gerencialAssetsMap.get(gerencialAsset.id)
        if (asset) {
          // Use our calculated diesel_liters and hours_worked (more reliable)
          // Merge other data from gerencial API
          asset.maintenance_cost = (gerencialAsset.preventive_cost || 0) + (gerencialAsset.corrective_cost || 0)
          asset.preventive_cost = gerencialAsset.preventive_cost || 0
          asset.corrective_cost = gerencialAsset.corrective_cost || 0
          asset.remisiones_count = gerencialAsset.remisiones_count || 0
          asset.concrete_m3 = gerencialAsset.concrete_m3 || 0
          // diesel_cost is already calculated above, but update if gerencial has a different value
          // (gerencial uses FIFO, we use simple pricing - prefer gerencial's FIFO calculation)
          if (gerencialAsset.diesel_cost) {
            asset.diesel_cost = gerencialAsset.diesel_cost
          }
        }
      })
    }
    // Process each asset to find most overdue/next maintenance plan using cyclic logic
    const assetSummaries = assets.map(asset => {
      const intervals = intervalsByModel.get(asset.model_id || '') || []
      
      // Get all maintenance history for this asset (not just by plan)
      const assetMaintenanceHistory = (maintenanceHistory || []).filter(mh => mh.asset_id === asset.id)

      const maintenanceUnit = parseMaintenanceUnitString(asset.maintenance_unit)
      const currentValue =
        maintenanceUnit === 'hours'
          ? Number(asset.current_hours) || 0
          : Number(asset.current_kilometers) || 0

      let selectedInterval: any = null
      let lastServiceDate: string | null = null
      let lastServiceValue: number | null = null
      let lastServiceIntervalValue: number | null = null
      let hoursOverdue: number | undefined = undefined
      let kilometersOverdue: number | undefined = undefined
      let hoursRemaining: number | undefined = undefined
      let kilometersRemaining: number | undefined = undefined
      let selectedIntervalDueValue: number | null = null

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
        selectedIntervalDueValue = selection.selectedIntervalDueValue
        if (maintenanceUnit === 'hours') {
          hoursOverdue = selection.overdue
          hoursRemaining = selection.remaining
        } else {
          kilometersOverdue = selection.overdue
          kilometersRemaining = selection.remaining
        }
      }


      // Get gerencial data for this asset
      // The gerencial API uses sophisticated logic combining checklist events and diesel transactions
      // to calculate hours_worked and diesel_liters - we reuse that calculated data here
      const gerencialAsset = gerencialAssetsMap.get(asset.id) || {
        maintenance_cost: 0,
        preventive_cost: 0,
        corrective_cost: 0,
        diesel_cost: 0,
        diesel_liters: 0,
        hours_worked: 0,
        remisiones_count: 0,
        concrete_m3: 0
      }

      return {
        asset_id: asset.id,
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        plant_id: asset.plant_id,
        plant_name: asset.plant_name,
        maintenance_unit: maintenanceUnit,
        current_hours: maintenanceUnit === 'hours' ? asset.current_hours : undefined,
        current_kilometers: maintenanceUnit === 'kilometers' ? asset.current_kilometers : undefined,
        maintenance_plan_id: selectedInterval?.id,
        maintenance_plan_name: selectedInterval ? (() => {
          const intervalValue = selectedInterval.interval_value || 0
          const unit = maintenanceUnit === 'hours' ? 'h' : 'km'
          const intervalName = selectedInterval.name || `${intervalValue} ${unit}`
          
          // Show the actual due hour/km if it's different from the base interval (indicating cycle > 1)
          if (selectedIntervalDueValue !== null && selectedIntervalDueValue !== intervalValue) {
            const formattedDue = Math.round(selectedIntervalDueValue).toLocaleString('es-MX')
            const isOverdue = (maintenanceUnit === 'hours' && hoursOverdue !== undefined && hoursOverdue > 0) ||
                             (maintenanceUnit === 'kilometers' && kilometersOverdue !== undefined && kilometersOverdue > 0)
            const statusText = isOverdue ? 'vencido en' : 'vencerá en'
            return `${intervalName} (${statusText} ${formattedDue} ${unit})`
          }
          
          return `${intervalName}`
        })() : null,
        interval_value: selectedInterval?.interval_value,
        last_service_date: lastServiceDate,
        last_service_hours: maintenanceUnit === 'hours' ? lastServiceValue : undefined,
        last_service_kilometers: maintenanceUnit === 'kilometers' ? lastServiceValue : undefined,
        last_service_interval_value: lastServiceIntervalValue,
        hours_remaining: hoursRemaining,
        kilometers_remaining: kilometersRemaining,
        hours_overdue: hoursOverdue,
        kilometers_overdue: kilometersOverdue,
        // Use preventive_cost + corrective_cost directly (total expenses from purchase orders)
        // This matches what the gerencial report shows for total expenses
        maintenance_cost: (gerencialAsset.preventive_cost || 0) + (gerencialAsset.corrective_cost || 0),
        diesel_cost: gerencialAsset.diesel_cost || 0,
        diesel_liters: gerencialAsset.diesel_liters || 0,
        hours_worked: gerencialAsset.hours_worked || 0,
        remisiones_count: gerencialAsset.remisiones_count || 0,
        concrete_m3: gerencialAsset.concrete_m3 || 0
      }
    })

    return NextResponse.json({ assets: assetSummaries })
  } catch (e: any) {
    console.error('Asset maintenance summary error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

