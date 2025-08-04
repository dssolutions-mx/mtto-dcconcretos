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
    const { data: checklistsData, error: checklistsError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        asset_id,
        completion_date,
        equipment_hours_reading,
        equipment_kilometers_reading,
        previous_hours,
        previous_kilometers,
        technician,
        status,
        checklists(name, frequency)
      `)
      .in('asset_id', assetIds)
      .gte('completion_date', dateFrom || '1900-01-01')
      .lte('completion_date', dateTo || '2100-12-31')
      .order('completion_date', { ascending: true })

    if (checklistsError) throw checklistsError

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
        
        // Calculate usage trends
        const hoursReadings = assetChecklists
          .filter((c: any) => c.equipment_hours_reading)
          .map((c: any) => ({
            date: c.completion_date,
            hours: c.equipment_hours_reading
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        const kilometersReadings = assetChecklists
          .filter((c: any) => c.equipment_kilometers_reading)
          .map((c: any) => ({
            date: c.completion_date,
            kilometers: c.equipment_kilometers_reading
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

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

        // Calculate operational hours (hours difference in the period)
        const operationalHours = hoursReadings.length > 1 
          ? (hoursReadings[hoursReadings.length - 1].hours - hoursReadings[0].hours) 
          : 0

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