import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assetIds, dateFrom, dateTo, filters, customParameters, assetParameters, fuelCost } = body

    if (!assetIds || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un ID de activo' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Can be ignored in server components
            }
          },
        },
      }
    )

    // 1. Fetch asset basic information
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select(`
        id,
        name,
        asset_id,
        current_hours,
        current_kilometers,
        status,
        location,
        department,
        last_maintenance_date,
        equipment_models(name, manufacturer)
      `)
      .in('id', assetIds)

    if (assetsError) throw assetsError

    // 2. Fetch completed checklists data for trend analysis
    // Extended window: 30 days before period start to get baseline readings
    const extendedStart = dateFrom ? new Date(dateFrom) : new Date('1900-01-01')
    extendedStart.setDate(extendedStart.getDate() - 30)
    const dateToExclusive = dateTo ? new Date(dateTo) : new Date('2100-12-31')
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
    
    // Fetch checklists - use reading_timestamp if available, otherwise completion_date
    // We'll filter in memory to handle cases where reading_timestamp might be null
    const { data: checklistsDataRaw, error: checklistsError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        asset_id,
        completion_date,
        reading_timestamp,
        equipment_hours_reading,
        equipment_kilometers_reading,
        previous_hours,
        previous_kilometers,
        technician,
        status,
        checklists(name, frequency)
      `)
      .in('asset_id', assetIds)
      .gte('completion_date', extendedStart.toISOString().slice(0, 10))
      .lte('completion_date', dateToExclusive.toISOString().slice(0, 10))
      .order('completion_date', { ascending: true })
    
    if (checklistsError) throw checklistsError
    
    // Filter in memory to include extended period for readings with reading_timestamp
    const checklistsData = (checklistsDataRaw || []).filter((c: any) => {
      const timestamp = c.reading_timestamp || c.completion_date
      if (!timestamp) return false
      const ts = new Date(timestamp).getTime()
      return ts >= extendedStart.getTime() && ts < dateToExclusive.getTime()
    })

    if (checklistsError) throw checklistsError

    // 2b. Fetch diesel transactions for hours calculation (same logic as gerencial/asset-maintenance-summary)
    const { data: dieselTxs, error: dieselError } = await supabase
      .from('diesel_transactions')
      .select(`
        id,
        asset_id,
        transaction_date,
        horometer_reading,
        diesel_warehouses!inner(product_type)
      `)
      .eq('diesel_warehouses.product_type', 'diesel')
      .neq('is_transfer', true)
      .in('asset_id', assetIds)
      .gte('transaction_date', extendedStart.toISOString().slice(0, 10))
      .lte('transaction_date', dateTo || '2100-12-31')
      .not('horometer_reading', 'is', null)
      .order('transaction_date', { ascending: true })

    if (dieselError) throw dieselError

    // 2c. Build validation map from diesel readings (for filtering incorrect checklist readings)
    type ReadingEvent = { ts: number, val: number }
    const dieselValidationByAsset = new Map<string, number[]>()
    const dieselValidationByAssetRaw = new Map<string, Array<{ val: number, date: string }>>()
    
    ;(dieselTxs || []).forEach((t: any) => {
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

    // 3. Fetch maintenance history
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_history')
      .select(`
        id,
        asset_id,
        date,
        type,
        hours,
        kilometers,
        description,
        technician,
        labor_hours,
        labor_cost,
        total_cost
      `)
      .in('asset_id', assetIds)
      .gte('date', dateFrom || '1900-01-01')
      .lte('date', dateTo || '2100-12-31')
      .order('date', { ascending: true })

    if (maintenanceError) throw maintenanceError

    // 4. Process data for analytics
    const analytics = {
      summary: {
        totalAssets: assets.length,
        totalHours: assets.reduce((sum: number, asset: any) => sum + (asset.current_hours || 0), 0),
        totalKilometers: assets.reduce((sum: number, asset: any) => sum + (asset.current_kilometers || 0), 0),
        totalChecklists: checklistsData.length,
        totalMaintenances: maintenanceData.length,
        totalMaintenanceCost: maintenanceData.reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0),
        averageHoursPerAsset: assets.length > 0 ? assets.reduce((sum: number, asset: any) => sum + (asset.current_hours || 0), 0) / assets.length : 0,
        averageKilometersPerAsset: assets.length > 0 ? assets.reduce((sum: number, asset: any) => sum + (asset.current_kilometers || 0), 0) / assets.length : 0,
      },
      assetDetails: assets.map((asset: any) => {
        const assetChecklists = checklistsData.filter((c: any) => c.asset_id === asset.id)
        const assetMaintenance = maintenanceData.filter((m: any) => m.asset_id === asset.id)
        
        // Calculate usage trends (for display)
        const hoursReadings = assetChecklists
          .filter((c: any) => c.equipment_hours_reading)
          .map((c: any) => ({
            date: c.completion_date || c.reading_timestamp,
            hours: c.equipment_hours_reading
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const kilometersReadings = assetChecklists
          .filter((c: any) => c.equipment_kilometers_reading)
          .map((c: any) => ({
            date: c.completion_date || c.reading_timestamp,
            kilometers: c.equipment_kilometers_reading
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // Calculate operational hours using advanced incremental delta logic (same as gerencial/asset-maintenance-summary)
        const dateFromStart = dateFrom ? new Date(dateFrom) : new Date('1900-01-01')
        const dateToExclusive = dateTo ? new Date(dateTo) : new Date('2100-12-31')
        dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
        const startMs = dateFromStart.getTime()
        const endMs = dateToExclusive.getTime()

        // Collect all readings (diesel + checklist) for this asset
        const events: ReadingEvent[] = []
        
        // Diesel transaction events (only use horometer_reading, filter unrealistic jumps)
        const assetDieselTxs = (dieselTxs || []).filter((t: any) => t.asset_id === asset.id)
        const dieselReadingsRaw: Array<{ ts: number, val: number }> = []
        assetDieselTxs.forEach((t: any) => {
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
        // Use reading_timestamp if available, otherwise fallback to completion_date
        const chkEvents: ReadingEvent[] = assetChecklists
          .filter((c: any) => c.equipment_hours_reading && (c.reading_timestamp || c.completion_date))
          .map((c: any) => {
            const timestamp = c.reading_timestamp || c.completion_date
            return {
              ts: new Date(timestamp).getTime(),
              val: Number(c.equipment_hours_reading)
            }
          })
          .filter((e: ReadingEvent) => !Number.isNaN(e.ts) && !Number.isNaN(e.val))
        
        const validationDieselValues = dieselValidationByAsset.get(asset.id) || []
        
        if (validationDieselValues.length > 0 || dieselReadings.length > 0) {
          // Use extended diesel readings if available, otherwise use period diesel readings
          const dieselValues = validationDieselValues.length > 0 ? validationDieselValues : dieselReadings.map(e => e.val)
          const dieselMin = Math.min(...dieselValues)
          const dieselMax = Math.max(...dieselValues)
          const dieselRange = dieselMax - dieselMin
          // Allow checklist readings within 2x the diesel range
          const allowedMin = dieselMin - dieselRange * 2
          const allowedMax = dieselMax + dieselRange * 2
          
          chkEvents.forEach(e => {
            // Only include if within reasonable range of diesel readings
            if (e.val >= allowedMin && e.val <= allowedMax) {
              events.push(e)
            }
          })
        } else {
          // No diesel readings - use all checklist readings (fallback)
          events.push(...chkEvents)
        }

        // Calculate operational hours using incremental deltas
        let operationalHours = 0
        if (events.length >= 2) {
          // Sort all events chronologically
          events.sort((a, b) => a.ts - b.ts)
          
          // Remove duplicates (same timestamp and value)
          const uniqueEvents: ReadingEvent[] = []
          events.forEach((e, idx) => {
            if (idx === 0 || e.ts !== events[idx - 1].ts || e.val !== events[idx - 1].val) {
              uniqueEvents.push(e)
            }
          })
          
          // Find baseline: last reading before period start, or first reading in period
          let baselineIdx = 0
          for (let i = 0; i < uniqueEvents.length; i++) {
            if (uniqueEvents[i].ts >= startMs) {
              baselineIdx = Math.max(0, i - 1)
              break
            }
          }
          
          // Debug log for asset with ID matching CR-16
          if (asset.id === '6be57c11-a350-4e96-bbca-f3772483ee22') {
            console.log(`[Analytics] Asset ${asset.asset_id}: Total events: ${events.length}, Unique: ${uniqueEvents.length}, Baseline idx: ${baselineIdx}`)
            console.log(`[Analytics] Period: ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()}`)
            console.log(`[Analytics] Diesel readings: ${dieselReadings.length}, Checklist events: ${chkEvents.length}`)
            console.log(`[Analytics] Validation diesel values: ${validationDieselValues.length}`)
          }
          
          // Calculate incremental deltas
          const MAX_HOURS_PER_DAY = 24
          for (let i = baselineIdx; i < uniqueEvents.length - 1; i++) {
            const current = uniqueEvents[i]
            const next = uniqueEvents[i + 1]
            
            // Only count deltas within the report period
            if (next.ts < startMs) continue
            if (current.ts >= endMs) break
            
            const delta = next.val - current.val
            
            // Skip negative deltas (resets)
            if (delta < 0) continue
            
            const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
            
            // Skip if time delta is too small (< 1 hour) - likely duplicate
            if (timeDeltaDays < 1/24) continue
            
            const hoursPerDay = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
            
            // Skip unrealistic jumps (>24h/day and gap <60 days)
            if (hoursPerDay > MAX_HOURS_PER_DAY && timeDeltaDays < 60) continue
            
            // For very large time gaps, cap at reasonable rate (24h/day max)
            let cappedDelta = delta
            if (timeDeltaDays > 0) {
              const maxReasonableDelta = MAX_HOURS_PER_DAY * timeDeltaDays
              if (delta > maxReasonableDelta) {
                cappedDelta = maxReasonableDelta
              }
            }
            
            operationalHours += cappedDelta
          }
          
          // Debug log for CR-16
          if (asset.id === '6be57c11-a350-4e96-bbca-f3772483ee22') {
            console.log(`[Analytics] Asset ${asset.asset_id}: Calculated operationalHours: ${operationalHours}`)
          }
        } else if (events.length > 0 && asset.id === '6be57c11-a350-4e96-bbca-f3772483ee22') {
          console.warn(`[Analytics] Asset ${asset.asset_id}: Only ${events.length} event(s), need at least 2 for calculation`)
        }

        // Calculate efficiency metrics
        const totalHours = asset.current_hours || 0
        const maintenanceHours = assetMaintenance.reduce((sum: number, m: any) => sum + (m.labor_hours || 0), 0)
        const maintenanceCost = assetMaintenance.reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0)
        
        const efficiency = totalHours > 0 ? ((totalHours - maintenanceHours) / totalHours) * 100 : 0
        const costPerHour = totalHours > 0 ? maintenanceCost / totalHours : 0
        const availability = totalHours + maintenanceHours > 0 ? ((totalHours / (totalHours + maintenanceHours)) * 100) : 100

        // Calculate MTBF (Mean Time Between Failures)
        const mtbf = assetMaintenance.length > 0 ? totalHours / assetMaintenance.length : totalHours

        // Get custom parameter values for operational calculations
        const productionParam = assetParameters.find((p: any) => 
          p.assetId === asset.id && customParameters.find((cp: any) => cp.id === p.parameterId && cp.name.toLowerCase().includes('producción'))
        )
        const fuelParam = assetParameters.find((p: any) => 
          p.assetId === asset.id && customParameters.find((cp: any) => cp.id === p.parameterId && cp.name.toLowerCase().includes('diesel'))
        )
        const materialParam = assetParameters.find((p: any) => 
          p.assetId === asset.id && customParameters.find((cp: any) => cp.id === p.parameterId && cp.name.toLowerCase().includes('material'))
        )

        const production = parseFloat(productionParam?.value || '0')
        const fuelConsumption = parseFloat(fuelParam?.value || '0')
        const materialProcessed = parseFloat(materialParam?.value || '0')

        // Operational efficiency calculations
        const productionPerHour = operationalHours > 0 && production > 0 ? production / operationalHours : 0
        const fuelPerHour = operationalHours > 0 && fuelConsumption > 0 ? fuelConsumption / operationalHours : 0
        const fuelEfficiency = fuelConsumption > 0 && production > 0 ? production / fuelConsumption : 0
        const fuelConsumptionPerUnit = production > 0 && fuelConsumption > 0 ? fuelConsumption / production : 0
        const materialPerHour = operationalHours > 0 && materialProcessed > 0 ? materialProcessed / operationalHours : 0
        
        // Cost calculations
        const userFuelCost = fuelCost || 4.5 // Use user-defined cost or default
        const fuelCostPerUnit = production > 0 && fuelConsumption > 0 ? (fuelConsumption * userFuelCost) / production : 0
        const maintenanceCostPerUnit = production > 0 ? maintenanceCost / production : 0
        const totalOperationalCost = maintenanceCost + (fuelConsumption * userFuelCost)
        const totalCostPerUnit = production > 0 ? totalOperationalCost / production : 0

        // Calculate trend data for the last 30 days of readings
        const last30DaysHours = hoursReadings.slice(-30)
        const last30DaysKilometers = kilometersReadings.slice(-30)
        
        // Calculate daily usage averages
        let dailyHoursUsage = 0
        let dailyKilometersUsage = 0
        
        if (last30DaysHours.length > 1) {
          const firstReading = last30DaysHours[0]
          const lastReading = last30DaysHours[last30DaysHours.length - 1]
          const daysDiff = Math.max(1, Math.ceil((new Date(lastReading.date).getTime() - new Date(firstReading.date).getTime()) / (1000 * 60 * 60 * 24)))
          dailyHoursUsage = (lastReading.hours - firstReading.hours) / daysDiff
        }
        
        if (last30DaysKilometers.length > 1) {
          const firstReading = last30DaysKilometers[0]
          const lastReading = last30DaysKilometers[last30DaysKilometers.length - 1]
          const daysDiff = Math.max(1, Math.ceil((new Date(lastReading.date).getTime() - new Date(firstReading.date).getTime()) / (1000 * 60 * 60 * 24)))
          dailyKilometersUsage = (lastReading.kilometers - firstReading.kilometers) / daysDiff
        }

        return {
          id: asset.id,
          asset_id: asset.asset_id,
          name: asset.name,
          model: asset.equipment_models?.name || 'N/A',
          manufacturer: asset.equipment_models?.manufacturer || 'N/A',
          location: asset.location,
          department: asset.department,
          status: asset.status,
          current_hours: asset.current_hours || 0,
          current_kilometers: asset.current_kilometers || 0,
          last_maintenance_date: asset.last_maintenance_date,
          metrics: {
            efficiency: parseFloat(efficiency.toFixed(2)),
            availability: parseFloat(availability.toFixed(2)),
            costPerHour: parseFloat(costPerHour.toFixed(2)),
            mtbf: parseFloat(mtbf.toFixed(2)),
            dailyHoursUsage: parseFloat(dailyHoursUsage.toFixed(2)),
            dailyKilometersUsage: parseFloat(dailyKilometersUsage.toFixed(2)),
          },
          operationalMetrics: {
            operationalHours: parseFloat(operationalHours.toFixed(2)),
            production: production,
            fuelConsumption: fuelConsumption,
            materialProcessed: materialProcessed,
            productionPerHour: parseFloat(productionPerHour.toFixed(3)),
            fuelPerHour: parseFloat(fuelPerHour.toFixed(3)),
            materialPerHour: parseFloat(materialPerHour.toFixed(3)),
            fuelEfficiency: parseFloat(fuelEfficiency.toFixed(3)),
            fuelConsumptionPerUnit: parseFloat(fuelConsumptionPerUnit.toFixed(3)),
            fuelCostPerUnit: parseFloat(fuelCostPerUnit.toFixed(2)),
            maintenanceCostPerUnit: parseFloat(maintenanceCostPerUnit.toFixed(2)),
            totalCostPerUnit: parseFloat(totalCostPerUnit.toFixed(2)),
            totalOperationalCost: parseFloat(totalOperationalCost.toFixed(2)),
          },
          trends: {
            hours: hoursReadings,
            kilometers: kilometersReadings,
          },
          maintenance: {
            count: assetMaintenance.length,
            totalCost: maintenanceCost,
            totalHours: maintenanceHours,
            byType: assetMaintenance.reduce((acc: any, m: any) => {
              const type = m.type || 'Sin especificar'
              acc[type] = (acc[type] || 0) + 1
              return acc
            }, {}),
            recent: assetMaintenance.slice(-5).map((m: any) => ({
              date: m.date,
              type: m.type,
              cost: m.total_cost || 0,
              hours: m.labor_hours || 0,
              description: m.description
            }))
          },
          checklists: {
            count: assetChecklists.length,
            byStatus: assetChecklists.reduce((acc: any, c: any) => {
              const status = c.status || 'Sin especificar'
              acc[status] = (acc[status] || 0) + 1
              return acc
            }, {}),
            byFrequency: assetChecklists.reduce((acc: any, c: any) => {
              const frequency = c.checklists?.frequency || 'Sin especificar'
              acc[frequency] = (acc[frequency] || 0) + 1
              return acc
            }, {}),
          }
        }
      }),
      customParameters: customParameters.filter((p: any) => p.name),
      assetParameters: assetParameters || [],
      trends: {
        // Overall fleet trends
        hoursOverTime: assets.map((asset: any) => {
          const assetChecklists = checklistsData.filter((c: any) => c.asset_id === asset.id)
          return {
            assetId: asset.asset_id,
            assetName: asset.name,
            readings: assetChecklists
              .filter((c: any) => c.equipment_hours_reading)
              .map((c: any) => ({
                date: c.completion_date,
                hours: c.equipment_hours_reading
              }))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          }
        }).filter(asset => asset.readings.length > 0),
        kilometersOverTime: assets.map((asset: any) => {
          const assetChecklists = checklistsData.filter((c: any) => c.asset_id === asset.id)
          return {
            assetId: asset.asset_id,
            assetName: asset.name,
            readings: assetChecklists
              .filter((c: any) => c.equipment_kilometers_reading)
              .map((c: any) => ({
                date: c.completion_date,
                kilometers: c.equipment_kilometers_reading
              }))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          }
        }).filter(asset => asset.readings.length > 0),
        maintenanceCostsOverTime: maintenanceData
          .filter((m: any) => m.total_cost)
          .map((m: any) => {
            const asset = assets.find((a: any) => a.id === m.asset_id)
            return {
              date: m.date,
              cost: m.total_cost,
              assetId: asset?.asset_id || '',
              assetName: asset?.name || '',
              type: m.type
            }
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      },
      insights: {
        // Generate insights based on the data
        highestCostAsset: assets.reduce((highest: any, current: any) => {
          const currentCost = maintenanceData
            .filter((m: any) => m.asset_id === current.id)
            .reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0)
          const highestCost = maintenanceData
            .filter((m: any) => m.asset_id === highest.id)
            .reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0)
          return currentCost > highestCost ? current : highest
        }),
        mostEfficientAsset: assets.reduce((mostEfficient: any, current: any) => {
          const currentMaintenanceHours = maintenanceData
            .filter((m: any) => m.asset_id === current.id)
            .reduce((sum: number, m: any) => sum + (m.labor_hours || 0), 0)
          const currentEfficiency = current.current_hours > 0 
            ? ((current.current_hours - currentMaintenanceHours) / current.current_hours) * 100 
            : 0
          
          const mostEfficientMaintenanceHours = maintenanceData
            .filter((m: any) => m.asset_id === mostEfficient.id)
            .reduce((sum: number, m: any) => sum + (m.labor_hours || 0), 0)
          const mostEfficientEfficiency = mostEfficient.current_hours > 0 
            ? ((mostEfficient.current_hours - mostEfficientMaintenanceHours) / mostEfficient.current_hours) * 100 
            : 0
          
          return currentEfficiency > mostEfficientEfficiency ? current : mostEfficient
        }),
        alertsAndRecommendations: assets.map((asset: any) => {
          const assetMaintenance = maintenanceData.filter((m: any) => m.asset_id === asset.id)
          const maintenanceCost = assetMaintenance.reduce((sum: number, m: any) => sum + (m.total_cost || 0), 0)
          const alerts = []
          
          // High maintenance cost alert
          if (maintenanceCost > 10000) {
            alerts.push({
              type: 'high_cost',
              severity: 'warning',
              message: `Alto costo de mantenimiento: $${maintenanceCost.toFixed(2)}`,
              recommendation: 'Revisar estrategia de mantenimiento preventivo'
            })
          }
          
          // Low efficiency alert
          const maintenanceHours = assetMaintenance.reduce((sum: number, m: any) => sum + (m.labor_hours || 0), 0)
          const efficiency = asset.current_hours > 0 ? ((asset.current_hours - maintenanceHours) / asset.current_hours) * 100 : 0
          if (efficiency < 80) {
            alerts.push({
              type: 'low_efficiency',
              severity: 'error',
              message: `Baja eficiencia operacional: ${efficiency.toFixed(1)}%`,
              recommendation: 'Evaluar condición del equipo y optimizar mantenimientos'
            })
          }
          
          // No recent maintenance
          const lastMaintenance = assetMaintenance.length > 0 
            ? assetMaintenance[assetMaintenance.length - 1]
            : null
          if (!lastMaintenance || new Date(lastMaintenance.date) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
            alerts.push({
              type: 'overdue_maintenance',
              severity: 'warning',
              message: 'Sin mantenimiento en los últimos 90 días',
              recommendation: 'Programar inspección de mantenimiento preventivo'
            })
          }
          
          return {
            assetId: asset.asset_id,
            assetName: asset.name,
            alerts
          }
        }).filter(asset => asset.alerts.length > 0)
      }
    }

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error generating analytics report:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor al generar el análisis' },
      { status: 500 }
    )
  }
}