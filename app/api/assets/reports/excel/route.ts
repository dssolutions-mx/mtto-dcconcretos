import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'

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

    // Build date filter clause
    const dateFilter = dateFrom && dateTo
      ? `AND date >= '${dateFrom}' AND date <= '${dateTo}'`
      : ''

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

    // 2. Fetch completed checklists data if requested
    let checklistsData: any[] = []
    if (filters.includeCompletedChecklists) {
      const { data, error } = await supabase
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
        .order('completion_date', { ascending: false })

      if (error) throw error
      checklistsData = data || []
    }

    // 3. Fetch maintenance history if requested
    let maintenanceData: any[] = []
    if (filters.includeMaintenanceHistory) {
      const { data, error } = await supabase
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
        .order('date', { ascending: false })

      if (error) throw error
      maintenanceData = data || []
    }

    // Create Excel workbook
    const workbook = XLSX.utils.book_new()

    // 1. Summary Sheet
    const summaryData = assets.map((asset: any) => {
      const assetChecklists = checklistsData.filter(c => c.asset_id === asset.id)
      const assetMaintenance = maintenanceData.filter(m => m.asset_id === asset.id)
      
      // Calculate readings summary
      const latestChecklistReading = assetChecklists.length > 0 
        ? assetChecklists[0] 
        : null
      
      const oldestChecklistReading = assetChecklists.length > 0 
        ? assetChecklists[assetChecklists.length - 1] 
        : null

      const hoursDifference = latestChecklistReading && oldestChecklistReading
        ? (latestChecklistReading.equipment_hours_reading || 0) - (oldestChecklistReading.equipment_hours_reading || 0)
        : 0

      const kilometersDifference = latestChecklistReading && oldestChecklistReading
        ? (latestChecklistReading.equipment_kilometers_reading || 0) - (oldestChecklistReading.equipment_kilometers_reading || 0)
        : 0

      // Calculate maintenance costs
      const totalMaintenanceCost = assetMaintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0)
      const totalLaborHours = assetMaintenance.reduce((sum, m) => sum + (m.labor_hours || 0), 0)

      const summary: any = {
        'ID Activo': asset.asset_id,
        'Nombre': asset.name,
        'Modelo': asset.equipment_models?.name || 'N/A',
        'Fabricante': asset.equipment_models?.manufacturer || 'N/A',
        'Ubicación': asset.location,
        'Departamento': asset.department,
        'Estado': asset.status,
        'Horas Actuales': asset.current_hours || 0,
        'Kilómetros Actuales': asset.current_kilometers || 0,
        'Último Mantenimiento': asset.last_maintenance_date || 'N/A',
        'Horas Operadas (Período)': hoursDifference,
        'Kilómetros Recorridos (Período)': kilometersDifference,
        'Checklists Completados': assetChecklists.length,
        'Mantenimientos Realizados': assetMaintenance.length,
        'Costo Total Mantenimiento': totalMaintenanceCost,
        'Horas Totales Trabajo': totalLaborHours,
      }

      // Add custom parameters per asset
      const customValues: any = {}
      customParameters.forEach((param: any) => {
        if (param.name) {
          const assetParam = assetParameters?.find((ap: any) => 
            ap.assetId === asset.id && ap.parameterId === param.id
          )
          const value = parseFloat(assetParam?.value || '0')
          summary[`${param.name} (${param.unit})`] = value
          customValues[param.name.toLowerCase()] = value
        }
      })

      // Calculate operational efficiency metrics
      const production = customValues['producción total'] || customValues['production total'] || 0
      const fuelConsumption = customValues['consumo de diesel'] || customValues['fuel consumption'] || 0
      const materialProcessed = customValues['material procesado'] || customValues['material processed'] || 0
      
      // Efficiency calculations
      if (hoursDifference > 0) {
        // Production efficiency
        if (production > 0) {
          summary['Producción por Hora (m³/h)'] = (production / hoursDifference).toFixed(3)
          summary['Horas por m³ Producido'] = (hoursDifference / production).toFixed(3)
        }
        
        // Fuel efficiency
        if (fuelConsumption > 0) {
          summary['Consumo Diesel por Hora (L/h)'] = (fuelConsumption / hoursDifference).toFixed(3)
          summary['Horas por Litro Diesel'] = (hoursDifference / fuelConsumption).toFixed(3)
        }
        
        // Material processing efficiency
        if (materialProcessed > 0) {
          summary['Material por Hora (ton/h)'] = (materialProcessed / hoursDifference).toFixed(3)
          summary['Horas por Tonelada'] = (hoursDifference / materialProcessed).toFixed(3)
        }
        
        // Maintenance cost per hour
        if (totalMaintenanceCost > 0) {
          summary['Costo Mantenimiento por Hora ($/h)'] = (totalMaintenanceCost / hoursDifference).toFixed(2)
        }
      }
      
      // Cross-efficiency calculations
      if (production > 0 && fuelConsumption > 0) {
        summary['Litros Diesel por m³ (L/m³)'] = (fuelConsumption / production).toFixed(3)
        summary['m³ por Litro Diesel'] = (production / fuelConsumption).toFixed(3)
      }
      
      if (production > 0 && materialProcessed > 0) {
        summary['Material por m³ Producido (ton/m³)'] = (materialProcessed / production).toFixed(3)
        summary['m³ por Tonelada Material'] = (production / materialProcessed).toFixed(3)
      }
      
      if (fuelConsumption > 0 && materialProcessed > 0) {
        summary['Litros por Tonelada Material (L/ton)'] = (fuelConsumption / materialProcessed).toFixed(3)
        summary['Toneladas por Litro Diesel'] = (materialProcessed / fuelConsumption).toFixed(3)
      }
      
              // Cost per production unit
        if (production > 0) {
          const userFuelCost = fuelCost || 4.5 // Use user-defined cost or default
          const totalCost = totalMaintenanceCost + (fuelConsumption * userFuelCost)
          summary['Costo Total por m³ ($/m³)'] = (totalCost / production).toFixed(2)
          summary['Costo Mantenimiento por m³ ($/m³)'] = (totalMaintenanceCost / production).toFixed(2)
          if (fuelConsumption > 0) {
            summary['Costo Combustible por m³ ($/m³)'] = ((fuelConsumption * userFuelCost) / production).toFixed(2)
          }
        }
      
      // Utilization metrics
      if (asset.current_hours > 0) {
        summary['Utilización Total (%)'] = ((hoursDifference / asset.current_hours) * 100).toFixed(2)
      }
      
      // Productivity score (composite metric)
      let productivityScore = 0
      if (hoursDifference > 0 && production > 0) {
        const productionRate = production / hoursDifference
        const fuelEfficiency = fuelConsumption > 0 ? production / fuelConsumption : 0
        const maintenanceEfficiency = totalMaintenanceCost > 0 ? production / totalMaintenanceCost : production
        productivityScore = (productionRate * 0.4 + fuelEfficiency * 0.3 + maintenanceEfficiency * 0.3)
      }
      summary['Índice de Productividad'] = productivityScore.toFixed(3)

      return summary
    })

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen')

    // 2. Detailed Checklists Sheet
    if (filters.includeCompletedChecklists && checklistsData.length > 0) {
      const checklistsDetailData = checklistsData.map((checklist: any) => {
        const asset = assets.find((a: any) => a.id === checklist.asset_id)
        return {
          'ID Activo': asset?.asset_id || '',
          'Nombre Activo': asset?.name || '',
          'Fecha Checklist': checklist.completion_date,
          'Nombre Checklist': checklist.checklists?.name || '',
          'Frecuencia': checklist.checklists?.frequency || '',
          'Técnico': checklist.technician || '',
          'Estado': checklist.status || '',
          'Horas Leídas': checklist.equipment_hours_reading || 0,
          'Kilómetros Leídos': checklist.equipment_kilometers_reading || 0,
          'Horas Anteriores': checklist.previous_hours || 0,
          'Kilómetros Anteriores': checklist.previous_kilometers || 0,
          'Diferencia Horas': (checklist.equipment_hours_reading || 0) - (checklist.previous_hours || 0),
          'Diferencia Kilómetros': (checklist.equipment_kilometers_reading || 0) - (checklist.previous_kilometers || 0),
        }
      })
      
      const checklistsWorksheet = XLSX.utils.json_to_sheet(checklistsDetailData)
      XLSX.utils.book_append_sheet(workbook, checklistsWorksheet, 'Detalle Checklists')
    }

    // 3. Maintenance History Sheet
    if (filters.includeMaintenanceHistory && maintenanceData.length > 0) {
      const maintenanceDetailData = maintenanceData.map((maintenance: any) => {
        const asset = assets.find((a: any) => a.id === maintenance.asset_id)
        return {
          'ID Activo': asset?.asset_id || '',
          'Nombre Activo': asset?.name || '',
          'Fecha Mantenimiento': maintenance.date,
          'Tipo': maintenance.type || '',
          'Descripción': maintenance.description || '',
          'Técnico': maintenance.technician || '',
          'Horas Registradas': maintenance.hours || 0,
          'Kilómetros Registrados': maintenance.kilometers || 0,
          'Horas de Trabajo': maintenance.labor_hours || 0,
          'Costo Mano de Obra': maintenance.labor_cost || 0,
          'Costo Total': maintenance.total_cost || 0,
        }
      })
      
      const maintenanceWorksheet = XLSX.utils.json_to_sheet(maintenanceDetailData)
      XLSX.utils.book_append_sheet(workbook, maintenanceWorksheet, 'Historial Mantenimiento')
    }

    // 4. Analytics Sheet with calculations
    const analyticsData = assets.map((asset: any) => {
      const assetChecklists = checklistsData.filter(c => c.asset_id === asset.id)
      const assetMaintenance = maintenanceData.filter(m => m.asset_id === asset.id)

      // Calculate efficiency metrics
      const totalHours = asset.current_hours || 0
      const maintenanceHours = assetMaintenance.reduce((sum, m) => sum + (m.labor_hours || 0), 0)
      const maintenanceCost = assetMaintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0)
      
      const efficiency = totalHours > 0 ? ((totalHours - maintenanceHours) / totalHours) * 100 : 0
      const costPerHour = totalHours > 0 ? maintenanceCost / totalHours : 0

      // Find custom parameter values
      const productionParam = customParameters.find((p: any) => p.name.toLowerCase().includes('producción'))
      const fuelParam = customParameters.find((p: any) => p.name.toLowerCase().includes('diesel'))

      const production = productionParam ? parseFloat(productionParam.value) || 0 : 0
      const fuelConsumption = fuelParam ? parseFloat(fuelParam.value) || 0 : 0

      const productionPerHour = totalHours > 0 && production > 0 ? production / totalHours : 0
      const fuelEfficiency = totalHours > 0 && fuelConsumption > 0 ? fuelConsumption / totalHours : 0

      return {
        'ID Activo': asset.asset_id,
        'Nombre Activo': asset.name,
        'Horas Totales': totalHours,
        'Horas Mantenimiento': maintenanceHours,
        'Eficiencia Operacional (%)': efficiency.toFixed(2),
        'Costo por Hora ($)': costPerHour.toFixed(2),
        'Producción Total': production,
        'Producción por Hora': productionPerHour.toFixed(2),
        'Consumo Combustible': fuelConsumption,
        'Litros por Hora': fuelEfficiency.toFixed(2),
        'MTBF (Horas entre fallos)': assetMaintenance.length > 0 ? (totalHours / assetMaintenance.length).toFixed(2) : 'N/A',
        'Disponibilidad (%)': ((1 - (maintenanceHours / (totalHours + maintenanceHours))) * 100).toFixed(2),
      }
    })

    const analyticsWorksheet = XLSX.utils.json_to_sheet(analyticsData)
    XLSX.utils.book_append_sheet(workbook, analyticsWorksheet, 'Análisis')

    // 5. Operational Efficiency Sheet
    const efficiencyData = assets.map((asset: any) => {
      const assetChecklists = checklistsData.filter(c => c.asset_id === asset.id)
      const assetMaintenance = maintenanceData.filter(m => m.asset_id === asset.id)
      
      const latestChecklistReading = assetChecklists.length > 0 ? assetChecklists[0] : null
      const oldestChecklistReading = assetChecklists.length > 0 ? assetChecklists[assetChecklists.length - 1] : null
      const hoursDifference = latestChecklistReading && oldestChecklistReading
        ? (latestChecklistReading.equipment_hours_reading || 0) - (oldestChecklistReading.equipment_hours_reading || 0)
        : 0
      const totalMaintenanceCost = assetMaintenance.reduce((sum, m) => sum + (m.total_cost || 0), 0)
      
      // Get custom values
      const customValues: any = {}
      customParameters.forEach((param: any) => {
        if (param.name) {
          const assetParam = assetParameters?.find((ap: any) => 
            ap.assetId === asset.id && ap.parameterId === param.id
          )
          customValues[param.name.toLowerCase()] = parseFloat(assetParam?.value || '0')
        }
      })
      
      const production = customValues['producción total'] || 0
      const fuelConsumption = customValues['consumo de diesel'] || 0
      const materialProcessed = customValues['material procesado'] || 0
      
      return {
        'ID Activo': asset.asset_id,
        'Nombre Activo': asset.name,
        'Horas Operadas': hoursDifference,
        'Producción Total (m³)': production,
        'Consumo Diesel (L)': fuelConsumption,
        'Material Procesado (ton)': materialProcessed,
        'Producción por Hora (m³/h)': hoursDifference > 0 && production > 0 ? (production / hoursDifference).toFixed(3) : 0,
        'Consumo por Hora (L/h)': hoursDifference > 0 && fuelConsumption > 0 ? (fuelConsumption / hoursDifference).toFixed(3) : 0,
        'Litros por m³ (L/m³)': production > 0 && fuelConsumption > 0 ? (fuelConsumption / production).toFixed(3) : 0,
        'm³ por Litro (m³/L)': fuelConsumption > 0 && production > 0 ? (production / fuelConsumption).toFixed(3) : 0,
        'Material por Hora (ton/h)': hoursDifference > 0 && materialProcessed > 0 ? (materialProcessed / hoursDifference).toFixed(3) : 0,
        'Costo Mantenimiento por m³ ($/m³)': production > 0 ? (totalMaintenanceCost / production).toFixed(2) : 0,
        'Costo Combustible por m³ ($/m³)': production > 0 && fuelConsumption > 0 ? ((fuelConsumption * (fuelCost || 4.5)) / production).toFixed(2) : 0,
        'Costo Total por m³ ($/m³)': production > 0 ? ((totalMaintenanceCost + (fuelConsumption * (fuelCost || 4.5))) / production).toFixed(2) : 0,
        'Eficiencia Combustible (m³/L)': fuelConsumption > 0 ? (production / fuelConsumption).toFixed(3) : 0,
        'Productividad (m³/h)': hoursDifference > 0 ? (production / hoursDifference).toFixed(3) : 0,
        'Índice de Eficiencia': hoursDifference > 0 && production > 0 && fuelConsumption > 0 ? 
          ((production / hoursDifference) / (fuelConsumption / hoursDifference) * 100).toFixed(1) : 0
      }
    })
    
    const efficiencyWorksheet = XLSX.utils.json_to_sheet(efficiencyData)
    XLSX.utils.book_append_sheet(workbook, efficiencyWorksheet, 'Eficiencia Operacional')

    // 6. Custom Parameters Sheet
    if (customParameters.length > 0 && assetParameters.length > 0) {
      const customParamsData: any[] = []
      
      customParameters.forEach((param: any) => {
        const relatedAssetParams = assetParameters.filter((ap: any) => ap.parameterId === param.id)
        relatedAssetParams.forEach((assetParam: any) => {
          const asset = assets.find((a: any) => a.id === assetParam.assetId)
          if (asset) {
            customParamsData.push({
              'Parámetro': param.name,
              'Unidad': param.unit,
              'Activo': asset.name,
              'ID Activo': asset.asset_id,
              'Valor': assetParam.value || 0,
              'Descripción': param.description,
            })
          }
        })
      })

      if (customParamsData.length > 0) {
        const customParamsWorksheet = XLSX.utils.json_to_sheet(customParamsData)
        XLSX.utils.book_append_sheet(workbook, customParamsWorksheet, 'Parámetros Personalizados')
      }
    }

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return Excel file
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte-activos-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })

  } catch (error) {
    console.error('Error generating Excel report:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor al generar el reporte' },
      { status: 500 }
    )
  }
}