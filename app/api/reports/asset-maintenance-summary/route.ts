import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from '@/lib/reporting/asset-plant-attribution'

type Body = {
  dateFrom: string
  dateTo: string
  businessUnitId?: string | null
  plantId?: string | null
}

export async function POST(req: NextRequest) {
  console.log('[SUMMARY API] ========== API CALLED ==========')
  try {
    const { dateFrom, dateTo, businessUnitId, plantId } = (await req.json()) as Body

    // Normalize dates to YYYY-MM-DD for consistency
    const dateFromStr = typeof dateFrom === 'string' && dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom
    const dateToStr = typeof dateTo === 'string' && dateTo.includes('T') ? dateTo.split('T')[0] : dateTo
    console.log('[SUMMARY API] Request params:', { dateFrom: dateFromStr, dateTo: dateToStr, businessUnitId, plantId })

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
    // CRITICAL: maintenance_history.maintenance_plan_id references maintenance_plans.id
    // maintenance_plans.interval_id references maintenance_intervals.id
    // We need to join through maintenance_plans to get the actual interval_id
    const assetIds = assets.map(a => a.id)
    console.log('[SUMMARY API] Fetching maintenance history for', assetIds.length, 'assets')
    // CRITICAL: maintenance_history.maintenance_plan_id actually stores INTERVAL IDs directly!
    // No need to join maintenance_plans - the field already contains interval IDs
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
      console.error('[SUMMARY API] Error details:', JSON.stringify(historyError, null, 2))
    } else {
      console.log('[SUMMARY API] Fetched', maintenanceHistory?.length || 0, 'maintenance history records')
      if (maintenanceHistory && maintenanceHistory.length > 0) {
        console.log('[SUMMARY API] Sample maintenance record:', JSON.stringify(maintenanceHistory[0], null, 2))
      }
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

    // Calculate diesel and hours worked using the SAME logic as gerencial API
    // This ensures consistency and avoids internal HTTP call issues
    // Note: dateFromStart, dateToExclusive, and dateToExclusiveStr are already defined above

    // Fetch diesel transactions (only diesel, not urea; exclude transfers - same as gerencial)
    const { data: dieselTxs } = await supabase
      .from('diesel_transactions')
      .select(`
        id,
        asset_id,
        quantity_liters,
        transaction_type,
        unit_cost,
        product_id,
        transaction_date,
        horometer_reading,
        previous_horometer,
        diesel_warehouses!inner(product_type)
      `)
      .eq('diesel_warehouses.product_type', 'diesel')
      .neq('is_transfer', true)
      .gte('transaction_date', dateFromStr)
      .lt('transaction_date', dateToExclusiveStr)

    // Fetch checklist equipment hours (extend window to capture progression)
    // Extended window: 30 days before period start to get baseline readings
    const assetIdsForHours = assets.map(a => a.id)
    const extendedStart = new Date(dateFromStart)
    extendedStart.setDate(extendedStart.getDate() - 30)
    const { data: hoursData } = await supabase
      .from('completed_checklists')
      .select('asset_id, equipment_hours_reading, reading_timestamp')
      .gte('reading_timestamp', extendedStart.toISOString())
      .lt('reading_timestamp', dateToExclusive.toISOString())
      .in('asset_id', assetIdsForHours)
      .not('equipment_hours_reading', 'is', null)
    
    // Also fetch diesel readings from extended period to validate checklist readings
    // This helps filter out incorrect checklist readings by comparing with diesel data
    const { data: dieselTxsForValidation } = await supabase
      .from('diesel_transactions')
      .select(`
        asset_id,
        transaction_date,
        horometer_reading,
        diesel_warehouses!inner(product_type)
      `)
      .eq('diesel_warehouses.product_type', 'diesel')
      .neq('is_transfer', true)
      .gte('transaction_date', extendedStart.toISOString().slice(0, 10))
      .lt('transaction_date', dateToExclusiveStr)
      .in('asset_id', assetIdsForHours)
      .not('horometer_reading', 'is', null)

    // Fetch diesel products for pricing
    const productIds = Array.from(new Set((dieselTxs || []).map(t => t.product_id).filter(Boolean)))
    const { data: products } = await supabase
      .from('diesel_products')
      .select('id, price_per_liter')
      .in('id', productIds)

    const priceByProduct = new Map<string, number>()
    ;(products || []).forEach(p => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

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

    // Aggregate diesel by asset
    const dieselByAsset = new Map<string, any[]>()
    type ReadingEvent = { ts: number, val: number }
    const checklistEventsByAsset = new Map<string, ReadingEvent[]>()
    
    // Build validation map from extended diesel readings (for filtering incorrect checklist readings)
    // Filter out diesel readings with unrealistic jumps to get clean validation set
    const dieselValidationByAsset = new Map<string, number[]>()
    const dieselValidationByAssetRaw = new Map<string, Array<{ val: number, date: string }>>()
    
    ;(dieselTxsForValidation || []).forEach((t: any) => {
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
        } else {
          console.warn(`[Summary] Asset ${assetId}: Filtering out diesel reading ${current.val}h (delta: ${delta}h in ${timeDeltaDays.toFixed(1)} days = ${hoursPerDay.toFixed(1)}h/day)`)
        }
      }
      
      if (validReadings.length > 0) {
        dieselValidationByAsset.set(assetId, validReadings)
      }
    })
    
    ;(hoursData || []).forEach((h: any) => {
      if (!h.asset_id) return
      const val = Number(h.equipment_hours_reading)
      const ts = new Date(h.reading_timestamp).getTime()
      if (Number.isNaN(val) || Number.isNaN(ts)) return
      if (!checklistEventsByAsset.has(h.asset_id)) checklistEventsByAsset.set(h.asset_id, [])
      checklistEventsByAsset.get(h.asset_id)!.push({ ts, val })
    })
    
    ;(dieselTxs || []).forEach(tx => {
      if (tx.transaction_type !== 'consumption' || !tx.asset_id) return
      if (!dieselByAsset.has(tx.asset_id)) dieselByAsset.set(tx.asset_id, [])
      dieselByAsset.get(tx.asset_id)!.push(tx)

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
      // Diesel transaction events (use transaction_date timestamp)
      // Only use horometer_reading, not previous_horometer (prevents 0-time deltas)
      // Filter out diesel readings with unrealistic jumps
      const txs = dieselByAsset.get(assetId) || []
      const dieselReadingsRaw: Array<{ ts: number, val: number }> = []
      txs.forEach((t: any) => {
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
          } else {
            console.warn(`[Summary] Asset ${assetId}: Filtering out diesel reading ${current.val}h (delta: ${delta}h in ${timeDeltaDays.toFixed(1)} days = ${hoursPerDay.toFixed(1)}h/day)`)
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
          // Only include if within reasonable range of diesel readings
          if (e.val >= allowedMin && e.val <= allowedMax) {
            events.push(e)
          } else {
            console.warn(`[Summary] Asset ${assetId}: Filtering out checklist reading ${e.val}h (outside diesel range ${dieselMin}-${dieselMax}h, allowed: ${allowedMin.toFixed(0)}-${allowedMax.toFixed(0)}h)`)
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
        
        // Skip negative deltas (resets) - they don't represent hours worked
        if (delta < 0) {
          console.warn(`[Summary] Asset ${assetId}: Reading reset detected at ${new Date(next.ts).toISOString()}: ${current.val} → ${next.val} (delta: ${delta})`)
          continue
        }
        
        // Calculate time delta in days
        const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
        
        // Skip if time delta is too small (< 1 hour) - likely duplicate or same-event readings
        if (timeDeltaDays < 1/24) {
          console.warn(`[Summary] Asset ${assetId}: Skipping delta with <1h gap at ${new Date(next.ts).toISOString()}: ${current.val} → ${next.val} (${timeDeltaDays.toFixed(4)} days)`)
          continue
        }
        
        const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
        
        // Validate: skip unrealistic jumps (>24 hours/day)
        if (hoursPerDay > MAX_HOURS_PER_DAY && timeDeltaDays < 60) {
          console.warn(`[Summary] Asset ${assetId}: Unrealistic jump detected at ${new Date(next.ts).toISOString()}: ${current.val} → ${next.val} (${delta}h in ${timeDeltaDays.toFixed(1)} days = ${hoursPerDay.toFixed(1)}h/day)`)
          continue
        }
        
        // For very large time gaps (>60 days), cap at reasonable rate (24h/day max)
        let cappedDelta = delta
        if (timeDeltaDays > 0) {
          const maxReasonableDelta = MAX_HOURS_PER_DAY * timeDeltaDays
          if (delta > maxReasonableDelta) {
            console.warn(`[Summary] Asset ${assetId}: Capping large delta at ${new Date(next.ts).toISOString()}: ${delta}h → ${maxReasonableDelta.toFixed(0)}h (${timeDeltaDays.toFixed(1)} days)`)
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
    
    console.log(`[SUMMARY API] Calculated diesel/hours for ${gerencialAssetsMap.size} assets`)

    // Process each asset to find most overdue/next maintenance plan using cyclic logic
    // DEBUG: Asset IDs to log (CR-12 and test asset)
    const debugAssetIds = ['f6c24547-3403-47fd-9d2f-e41f9c249745', '940fea0f-5a6e-4b07-9d06-2f64dcf636d0'] // CR-12
    
    const assetSummaries = assets.map(asset => {
      const intervals = intervalsByModel.get(asset.model_id || '') || []
      
      // Get all maintenance history for this asset (not just by plan)
      const assetMaintenanceHistory = (maintenanceHistory || []).filter(mh => mh.asset_id === asset.id)
      
          // DEBUG: Log for specific assets
          if (debugAssetIds.includes(asset.id)) {
            console.log(`\n\n[DEBUG] ========== ASSET ${asset.id} (${asset.asset_code}) ==========`)
            console.log(`[DEBUG] Asset name:`, asset.asset_name)
            console.log(`[DEBUG] Current hours:`, asset.current_hours)
            console.log(`[DEBUG] Intervals count:`, intervals.length)
            console.log(`[DEBUG] Intervals:`, JSON.stringify(intervals.map(i => ({ 
              id: i.id, 
              interval_value: i.interval_value, 
              name: i.name 
            })), null, 2))
            console.log(`[DEBUG] Maintenance history count:`, assetMaintenanceHistory.length)
            console.log(`[DEBUG] Maintenance history:`, JSON.stringify(assetMaintenanceHistory.map(mh => ({
              maintenance_plan_id: mh.maintenance_plan_id,
              hours: mh.hours,
              date: mh.date,
              type: mh.type
            })), null, 2))
            console.log(`[DEBUG] ========================================\n\n`)
          }
      
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
        // Calculate cycle length (highest interval value)
        const maxInterval = Math.max(...intervals.map(i => i.interval_value || 0))
        if (maxInterval === 0) {
          // No valid intervals, skip
        } else {
          // Calculate current cycle
          const currentCycle = Math.floor(currentValue / maxInterval) + 1
          const currentCycleStartHour = (currentCycle - 1) * maxInterval
          const currentCycleEndHour = currentCycle * maxInterval

          // Use preventive, plan-linked entries only for coverage/completion
          // CRITICAL: Only consider maintenance_history entries where maintenance_plan_id matches an actual interval
          // This excludes work orders and service orders NOT linked to cycle intervals
          const preventiveHistory = assetMaintenanceHistory.filter(m => {
            // Check for 'preventive' (English) or 'preventivo' (Spanish) - handle both languages and cases
            const typeLower = m?.type?.toLowerCase();
            const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo';
            if (!isPreventive || !m?.maintenance_plan_id) return false
            // Verify maintenance_plan_id exists in the intervals array
            return intervals.some(interval => interval.id === m.maintenance_plan_id)
          })
          
          // DEBUG: Log for specific asset
          if (asset.id === 'f6c24547-3403-47fd-9d2f-e41f9c249745') {
            console.log(`[DEBUG] Preventive history filtered:`, {
              total_history: assetMaintenanceHistory.length,
              preventive_count: preventiveHistory.length,
              preventive: preventiveHistory.map(m => ({
                maintenance_plan_id: m.maintenance_plan_id,
                hours: m.hours,
                date: m.date,
                matched_interval: intervals.find(i => i.id === m.maintenance_plan_id)?.interval_value
              })),
              intervals_ids: intervals.map(i => i.id)
            })
          }
          
          // Filter maintenance history to current cycle
          // CRITICAL: Only include maintenance performed in the CURRENT cycle for completion/coverage checks
          // Maintenance from previous cycles doesn't cover current cycle intervals
          // Example: A 2700h service performed at 3568h (cycle 1) does NOT cover 300h service due at 3900h (cycle 2)
          const currentCycleMaintenances = preventiveHistory.filter(m => {
            const mHours = Number(m.hours) || 0
            // Only include maintenance performed AFTER the current cycle started
            // This matches the asset detail page logic exactly
            return mHours > currentCycleStartHour && mHours < currentCycleEndHour
          })
          
          // DEBUG: Log for specific assets
          if (debugAssetIds.includes(asset.id)) {
            console.log(`[DEBUG ${asset.asset_code}] Current cycle maintenances:`, {
              currentCycle,
              currentCycleStartHour,
              currentCycleEndHour,
              currentValue,
              maxInterval,
              count: currentCycleMaintenances.length,
              maintenances: currentCycleMaintenances.map(m => ({
                maintenance_plan_id: m.maintenance_plan_id,
                hours: m.hours,
                interval_value: intervals.find(i => i.id === m.maintenance_plan_id)?.interval_value
              })),
              all_preventive_history: preventiveHistory.map(m => ({
                maintenance_plan_id: m.maintenance_plan_id,
                hours: m.hours,
                in_current_cycle: (Number(m.hours) || 0) > currentCycleStartHour && (Number(m.hours) || 0) < currentCycleEndHour
              }))
            })
          }

          // Process each interval to determine status
          const intervalStatuses = intervals.map(interval => {
            const intervalHours = interval.interval_value || 0
            const isRecurring = (interval as any).is_recurring !== false // Default to true
            const isFirstCycleOnly = (interval as any).is_first_cycle_only === true // Default to false

            if (isFirstCycleOnly && currentCycle !== 1) {
              return { interval, status: 'not_applicable', nextDueHour: null }
            }

            // Calculate next due hour for current cycle
            let nextDueHour = ((currentCycle - 1) * maxInterval) + intervalHours
            let cycleForService = currentCycle

            // Special case: if nextDueHour exceeds the current cycle end, calculate for next cycle
            if (nextDueHour > currentCycleEndHour) {
              // This service belongs to next cycle
              cycleForService = currentCycle + 1
              nextDueHour = (currentCycle * maxInterval) + intervalHours
              
              // Only show next cycle services if they're within reasonable range (e.g., 1000 hours)
              if (nextDueHour - currentValue > 1000) {
                // Skip this interval if too far in the future
                return { interval, status: 'not_applicable', nextDueHour: null }
              }
            }

            // Check if this specific interval was performed in current cycle
            // CRITICAL: maintenance_plan_id IS the interval ID
            const wasPerformedInCurrentCycle = cycleForService === currentCycle && 
              currentCycleMaintenances.some(m => {
                // maintenance_plan_id IS the interval ID
                return m.maintenance_plan_id === interval.id
              })
            
            // DEBUG: Log for specific assets and key intervals
            if (debugAssetIds.includes(asset.id) && (interval.interval_value === 300 || interval.interval_value === 600 || interval.interval_value === 3000)) {
              console.log(`[DEBUG ${asset.asset_code}] ${interval.interval_value}h interval check:`, {
                interval_id: interval.id,
                interval_value: interval.interval_value,
                cycleForService,
                currentCycle,
                nextDueHour,
                currentValue,
                wasPerformedInCurrentCycle,
                isCoveredByHigher: cycleForService === currentCycle && currentCycleMaintenances.some((m: any) => {
                  const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
                  if (!performedInterval) return false
                  const sameUnit = performedInterval.type === interval.type
                  const sameCategory = (performedInterval as any).maintenance_category === (interval as any).maintenance_category
                  const categoryOk = (performedInterval as any).maintenance_category && (interval as any).maintenance_category 
                    ? sameCategory 
                    : true
                  const higherOrEqual = Number(performedInterval.interval_value) >= Number(interval.interval_value)
                  return sameUnit && categoryOk && higherOrEqual
                }),
                status: cycleForService === currentCycle ? 
                  (currentValue >= nextDueHour ? 'overdue' : 
                   currentValue >= nextDueHour - 100 ? 'upcoming' : 'scheduled') : 'scheduled'
              })
            }

            if (wasPerformedInCurrentCycle) {
              return { interval, status: 'completed', nextDueHour }
            }

            // Check if covered by higher service in same cycle
            // CRITICAL: Coverage requires BOTH interval value comparison AND timing check
            // CRITICAL: maintenance_plan_id IS the interval ID
            const isCoveredByHigher = cycleForService === currentCycle && 
              currentCycleMaintenances.some((m: any) => {
                // maintenance_plan_id IS the interval ID
                const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
                if (!performedInterval) return false
                
                // Verify same unit and category
                const sameUnit = performedInterval.type === interval.type
                const sameCategory = (performedInterval as any).maintenance_category === (interval as any).maintenance_category
                const categoryOk = (performedInterval as any).maintenance_category && (interval as any).maintenance_category 
                  ? sameCategory 
                  : true
                
                // CRITICAL: Coverage requires interval value >= due interval value
                const higherOrEqual = Number(performedInterval.interval_value) >= Number(interval.interval_value)
                
                // CRITICAL: Also check timing - the performed service must be done AFTER the due hour
                // This prevents a 1500h service at 5145h from covering a 1800h interval due at 5400h
                const performedAtHour = Number(m.hours) || 0
                const performedAfterDue = performedAtHour >= nextDueHour
                
                return sameUnit && categoryOk && higherOrEqual && performedAfterDue
              })
            
            // DEBUG: Log for specific asset and intervals
            if (asset.id === 'f6c24547-3403-47fd-9d2f-e41f9c249745' && interval.interval_value < 1500) {
              console.log(`[DEBUG] Coverage check for ${interval.interval_value}h:`, {
                interval_id: interval.id,
                interval_value: interval.interval_value,
                cycleForService,
                currentCycle,
                isCoveredByHigher,
                covering_maintenances: currentCycleMaintenances.map((m: any) => {
                  const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
                  return {
                    maintenance_plan_id: m.maintenance_plan_id,
                    hours: m.hours,
                    performed_interval_value: performedInterval?.interval_value,
                    covers: performedInterval && Number(performedInterval.interval_value) >= Number(interval.interval_value)
                  }
                })
              })
            }

            if (isCoveredByHigher) {
              return { interval, status: 'covered', nextDueHour }
            }

            // Determine if overdue, upcoming, or scheduled
            if (cycleForService === currentCycle) {
              // Current cycle logic
              if (currentValue >= nextDueHour) {
                return { interval, status: 'overdue', nextDueHour }
              } else if (currentValue >= nextDueHour - 100) {
                return { interval, status: 'upcoming', nextDueHour }
              } else {
                return { interval, status: 'scheduled', nextDueHour }
              }
            } else {
              // Next cycle service
              return { interval, status: 'scheduled', nextDueHour }
            }
          })

          // Filter out not_applicable, completed, and covered intervals
          const actionableIntervals = intervalStatuses.filter(
            s => s.status !== 'not_applicable' && s.status !== 'completed' && s.status !== 'covered'
          )

          // DEBUG: Log interval statuses for CR-12
          if (debugAssetIds.includes(asset.id)) {
            console.log(`[DEBUG ${asset.asset_code}] ========== INTERVAL STATUSES ==========`)
            console.log(`[DEBUG ${asset.asset_code}] All interval statuses:`, intervalStatuses.map(s => ({
              interval_value: s.interval.interval_value,
              status: s.status,
              nextDueHour: s.nextDueHour,
              overdue_amount: s.status === 'overdue' ? currentValue - (s.nextDueHour || 0) : null,
              remaining: s.status === 'upcoming' || s.status === 'scheduled' ? (s.nextDueHour || 0) - currentValue : null
            })))
            console.log(`[DEBUG ${asset.asset_code}] Actionable intervals (filtered):`, actionableIntervals.map(s => ({
              interval_value: s.interval.interval_value,
              status: s.status,
              nextDueHour: s.nextDueHour,
              overdue_amount: s.status === 'overdue' ? currentValue - (s.nextDueHour || 0) : null,
              remaining: s.status === 'upcoming' || s.status === 'scheduled' ? (s.nextDueHour || 0) - currentValue : null
            })))
            console.log(`[DEBUG ${asset.asset_code}] =========================================`)
          }

          // Find last service from ANY preventive maintenance FIRST (regardless of actionable intervals)
          // This ensures we show last service even when all intervals are completed/covered
          if (preventiveHistory.length > 0) {
            const allPreventiveMaintenance = preventiveHistory
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            
            // Use the most recent preventive maintenance as default
            if (allPreventiveMaintenance.length > 0) {
              lastServiceDate = allPreventiveMaintenance[0].date
              lastServiceValue = allPreventiveMaintenance[0].hours
              // Find the interval value for this last service
              const lastServiceInterval = intervals.find(i => i.id === allPreventiveMaintenance[0].maintenance_plan_id)
              lastServiceIntervalValue = lastServiceInterval?.interval_value || null
            }
          }

          if (actionableIntervals.length > 0) {
            // Find most overdue (highest overdue amount) or next upcoming
            // CRITICAL: Select the FIRST overdue interval (lowest interval_value that's overdue)
            // This matches the asset detail page logic which shows intervals sorted by priority
            const overdueIntervals = actionableIntervals.filter(s => s.status === 'overdue')
            
            if (overdueIntervals.length > 0) {
              // FIX: Select the FIRST overdue interval (lowest interval_value), not the one with highest overdue amount
              // This ensures we show the most critical overdue interval that should be done first
              selectedInterval = overdueIntervals.reduce((first, item) => {
                // Prefer lowest interval_value (first service that should be done)
                // If tied, prefer the one with highest overdue amount
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

              // DEBUG: Log selection for CR-12
              if (debugAssetIds.includes(asset.id)) {
                console.log(`[DEBUG ${asset.asset_code}] Selected overdue interval:`, {
                  interval_value: selectedInterval.interval_value,
                  overdue_hours: overdue,
                  nextDueHour: overdueItem?.nextDueHour
                })
              }

              // Update last service to be specific to this selected interval (if it exists AND is more recent)
              // CRITICAL: maintenance_plan_id IS the interval ID
              // Only update if the interval-specific service is more recent than the overall last service
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
                  // The interval value is from the selectedInterval (which is the interval we're checking)
                  lastServiceIntervalValue = selectedInterval.interval_value || null
                }
                // Otherwise keep the more recent overall service - DO NOT change lastServiceIntervalValue
                // lastServiceIntervalValue should always reflect the interval of the actual last service performed
              }
            } else {
              // Find next upcoming interval
              const upcomingIntervals = actionableIntervals.filter(s => s.status === 'upcoming' || s.status === 'scheduled')
              
              if (upcomingIntervals.length > 0) {
                // Select the one with lowest nextDueHour (next due)
                selectedInterval = upcomingIntervals.reduce((min, item) => {
                  return (item.nextDueHour || Infinity) < (min.nextDueHour || Infinity) ? item : min
                }).interval

                const upcomingItem = upcomingIntervals.find(item => item.interval.id === selectedInterval.id)
                const remaining = (upcomingItem?.nextDueHour || 0) - currentValue
                hoursRemaining = remaining

                // DEBUG: Log selection for CR-12
                if (debugAssetIds.includes(asset.id)) {
                  console.log(`[DEBUG ${asset.asset_code}] Selected upcoming interval:`, {
                    interval_value: selectedInterval.interval_value,
                    remaining_hours: remaining,
                    nextDueHour: upcomingItem?.nextDueHour
                  })
                }

                // Update last service to be specific to this selected interval (if it exists AND is more recent)
                // CRITICAL: maintenance_plan_id IS the interval ID
                // Only update if the interval-specific service is more recent than the overall last service
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
        // Similar logic for kilometers (simplified - cycles work the same way)
        const maxInterval = Math.max(...intervals.map(i => i.interval_value || 0))
        if (maxInterval > 0) {
          const currentCycle = Math.floor(currentValue / maxInterval) + 1
          const currentCycleStartKm = (currentCycle - 1) * maxInterval
          const currentCycleEndKm = currentCycle * maxInterval

          // Use preventive, plan-linked entries only for coverage/completion
          // CRITICAL: maintenance_history.maintenance_plan_id stores what appears in maintenance_plans.interval_id
          // We DON'T need to filter by planToIntervalMap here since we're checking ALL intervals for the model
          const preventiveHistory = assetMaintenanceHistory.filter(m => {
            // Check for 'preventive' (English) or 'preventivo' (Spanish) - handle both languages and cases
            const typeLower = m?.type?.toLowerCase();
            const isPreventive = typeLower === 'preventive' || typeLower === 'preventivo';
            if (!isPreventive || !m?.maintenance_plan_id) return false
            // maintenance_plan_id should match an interval.id (it stores interval_id values)
            return intervals.some(interval => interval.id === m.maintenance_plan_id)
          })

          const currentCycleMaintenances = preventiveHistory.filter(m => {
            const mKm = Number(m.kilometers) || 0
            // Include maintenance in current cycle (between cycle start and end)
            // Also include maintenance from previous cycle that's close to boundary (within 200km)
            return (mKm > currentCycleStartKm && mKm < currentCycleEndKm) ||
                   (mKm <= currentCycleStartKm && mKm >= currentCycleStartKm - 200)
          })

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

            // Check if this specific interval was performed in current cycle
            // CRITICAL: maintenance_plan_id IS the interval ID
            const wasPerformedInCurrentCycle = cycleForService === currentCycle && 
              currentCycleMaintenances.some(m => {
                return m.maintenance_plan_id === interval.id
              })

            if (wasPerformedInCurrentCycle) {
              return { interval, status: 'completed', nextDueKm }
            }

            // CRITICAL: Coverage is based SOLELY on interval value comparison
            // CRITICAL: maintenance_plan_id IS the interval ID
            const isCoveredByHigher = cycleForService === currentCycle && 
              currentCycleMaintenances.some((m: any) => {
                // maintenance_plan_id IS the interval ID
                const performedInterval = intervals.find((i: any) => i.id === m.maintenance_plan_id)
                if (!performedInterval) return false
                
                // Verify same unit and category
                const sameUnit = performedInterval.type === interval.type
                const sameCategory = (performedInterval as any).maintenance_category === (interval as any).maintenance_category
                const categoryOk = (performedInterval as any).maintenance_category && (interval as any).maintenance_category 
                  ? sameCategory 
                  : true
                
                // CRITICAL: Coverage based SOLELY on interval value comparison
                // If performed interval value >= due interval value, it covers it
                // Works forward: performing 1500h covers all intervals <= 1500h, even future ones
                const higherOrEqual = Number(performedInterval.interval_value) >= Number(interval.interval_value)
                
                return sameUnit && categoryOk && higherOrEqual
              })

            if (isCoveredByHigher) {
              return { interval, status: 'covered', nextDueKm }
            }

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

          const actionableIntervals = intervalStatuses.filter(
            s => s.status !== 'not_applicable' && s.status !== 'completed' && s.status !== 'covered'
          )

          // Find last service from ANY preventive maintenance FIRST (regardless of actionable intervals)
          // This ensures we show last service even when all intervals are completed/covered
          if (preventiveHistory.length > 0) {
            const allPreventiveMaintenance = preventiveHistory
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            
            // Use the most recent preventive maintenance as default
            if (allPreventiveMaintenance.length > 0) {
              lastServiceDate = allPreventiveMaintenance[0].date
              lastServiceValue = allPreventiveMaintenance[0].kilometers
              // Find the interval value for this last service
              const lastServiceInterval = intervals.find(i => i.id === allPreventiveMaintenance[0].maintenance_plan_id)
              lastServiceIntervalValue = lastServiceInterval?.interval_value || null
            }
          }

          if (actionableIntervals.length > 0) {
            const overdueIntervals = actionableIntervals.filter(s => s.status === 'overdue')
            
            if (overdueIntervals.length > 0) {
              selectedInterval = overdueIntervals.reduce((max, item) => {
                const overdue = currentValue - ((item as any).nextDueKm || 0)
                const maxOverdue = currentValue - ((max as any).nextDueKm || 0)
                return overdue > maxOverdue ? item : max
              }).interval

              const overdueItem = overdueIntervals.find(item => item.interval.id === selectedInterval.id)
              const overdue = currentValue - ((overdueItem as any).nextDueKm || 0)
              kilometersOverdue = overdue

              // Update last service to be specific to this selected interval (if it exists)
              // CRITICAL: maintenance_plan_id IS the interval ID
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
                  // The interval value is from the selectedInterval (which is the interval we're checking)
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

                // Update last service to be specific to this selected interval (if it exists)
                // CRITICAL: maintenance_plan_id IS the interval ID
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
      
      // DEBUG: Log if asset not found in gerencial data
      if (!gerencialAssetsMap.has(asset.id)) {
        console.log(`[SUMMARY API] Asset ${asset.id} (${asset.asset_code}) not found in gerencial data`)
      } else {
        // DEBUG: Log diesel and hours for verification
        if (gerencialAsset.diesel_liters > 0 || gerencialAsset.hours_worked > 0) {
          console.log(`[SUMMARY API] Asset ${asset.id} (${asset.asset_code}):`, {
            diesel_liters: gerencialAsset.diesel_liters,
            hours_worked: gerencialAsset.hours_worked,
            diesel_cost: gerencialAsset.diesel_cost
          })
        }
      }

      // Get the nextDueHour/km for the selected interval to show cycle information
      let selectedIntervalDueValue: number | null = null
      if (selectedInterval) {
        const intervals = intervalsByModel.get(asset.model_id || '') || []
        const maxInterval = Math.max(...intervals.map(i => i.interval_value || 0))
        const currentValue = maintenanceUnit === 'hours' ? (asset.current_hours || 0) : (asset.current_kilometers || 0)
        
        if (maxInterval > 0) {
          // If it's overdue, calculate the actual due hour
          if (maintenanceUnit === 'hours' && hoursOverdue !== undefined && hoursOverdue > 0) {
            selectedIntervalDueValue = currentValue - hoursOverdue
          } else if (maintenanceUnit === 'hours' && hoursRemaining !== undefined) {
            selectedIntervalDueValue = currentValue + hoursRemaining
          } else if (maintenanceUnit === 'kilometers' && kilometersOverdue !== undefined && kilometersOverdue > 0) {
            selectedIntervalDueValue = currentValue - kilometersOverdue
          } else if (maintenanceUnit === 'kilometers' && kilometersRemaining !== undefined) {
            selectedIntervalDueValue = currentValue + kilometersRemaining
          }
        }
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

