import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient as createServerSupabase } from "@/lib/supabase-server"

const RequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  businessUnitId: z.string().uuid().optional().nullable(),
  plantId: z.string().uuid().optional().nullable(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = RequestSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ 
        error: "Invalid request", 
        details: parsed.error.flatten() 
      }, { status: 400 })
    }

    const { startDate, endDate, businessUnitId, plantId, page, pageSize } = parsed.data
    const supabase = await createServerSupabase()

    // Get organizational structure
    const [orgResult] = await Promise.all([
      supabase
        .from("business_units")
        .select(`
          id, name, code,
          plants:plants(
            id, name, code,
            assets:assets(
              id, asset_id, name, plant_id, model_id
            )
          )
        `)
        .order("name")
    ])

    if (orgResult.error) throw orgResult.error
    
    const businessUnits = orgResult.data || []
    let filteredPlants: any[] = []
    let filteredAssets: any[] = []

    // Apply filters and build asset list
    for (const bu of businessUnits) {
      if (businessUnitId && bu.id !== businessUnitId) continue
      
      for (const plant of bu.plants || []) {
        if (plantId && plant.id !== plantId) continue
        
        filteredPlants.push({
          ...plant,
          business_unit_id: bu.id,
          business_unit_name: bu.name
        })
        
        for (const asset of plant.assets || []) {
          filteredAssets.push({
            ...asset,
            plant_id: plant.id,
            plant_name: plant.name,
            business_unit_id: bu.id,
            business_unit_name: bu.name
          })
        }
      }
    }

    // Get equipment models for the assets
    const modelIds = [...new Set(filteredAssets.map(a => a.model_id).filter(Boolean))]
    
    let modelsMap = new Map()
    if (modelIds.length > 0) {
      const { data: models, error: modelsError } = await supabase
        .from("equipment_models")
        .select("id, name, manufacturer, category")
        .in("id", modelIds)
      
      if (modelsError) throw modelsError
      
      modelsMap = new Map((models || []).map(m => [m.id, m]))
    }

    // Enhance assets with model information
    filteredAssets = filteredAssets.map(asset => {
      const model = asset.model_id ? modelsMap.get(asset.model_id) : null
      return {
        ...asset,
        model_name: model?.name || 'Sin modelo',
        model_manufacturer: model?.manufacturer || '',
        model_category: model?.category || ''
      }
    })

    const assetIds = filteredAssets.map(a => a.id)
    const plantIds = filteredPlants.map(p => p.id)

    if (assetIds.length === 0) {
      return NextResponse.json({
        summary: {
          totalCost: 0,
          purchaseOrdersCost: 0,
          serviceOrdersCost: 0,
          laborCost: 0,
          partsCost: 0,
          additionalExpenses: 0,
          totalHours: 0,
          assetCount: 0,
          preventiveCost: 0,
          correctiveCost: 0
        },
        businessUnits: [],
        plants: [],
        assets: { data: [], total: 0, page, pageSize },
        filters: { businessUnits, plants: filteredPlants }
      })
    }

    // Get purchase orders in date range - simplified query
    let poQuery = supabase
      .from("purchase_orders")
      .select(`
        id, order_id, total_amount, actual_amount, plant_id, created_at, work_order_id
      `)
      .or(`payment_date.gte.${startDate},purchased_at.gte.${startDate},approval_date.gte.${startDate},created_at.gte.${startDate}`)
      .or(`payment_date.lte.${endDate},purchased_at.lte.${endDate},approval_date.lte.${endDate},created_at.lte.${endDate}`)

    if (plantIds.length > 0) {
      poQuery = poQuery.in('plant_id', plantIds)
    }

    // Get service orders in date range  
    const soQuery = supabase
      .from("service_orders")
      .select(`
        id, order_id, total_cost, labor_cost, parts_cost, completion_date, asset_id, work_order_id
      `)
      .gte("completion_date", startDate)
      .lte("completion_date", endDate)
      .in("asset_id", assetIds)

    // Get additional expenses
    const aeQuery = supabase
      .from("additional_expenses")
      .select("id, asset_id, amount, created_at, work_order_id")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("asset_id", assetIds)

    // Get work orders for type classification
    const woQuery = supabase
      .from("work_orders")
      .select("id, type, asset_id")
      .in("asset_id", assetIds)

    // Get equipment hours with flexible date range (extend 30 days before if no data in range)
    const extendedStartDate = new Date(startDate)
    extendedStartDate.setDate(extendedStartDate.getDate() - 30)
    
    const hoursQuery = supabase
      .from("completed_checklists")
      .select("asset_id, equipment_hours_reading, reading_timestamp")
      .gte("reading_timestamp", extendedStartDate.toISOString())
      .lte("reading_timestamp", endDate)
      .in("asset_id", assetIds)
      .not("equipment_hours_reading", "is", null)
      .order("reading_timestamp")

    const [poResult, soResult, aeResult, woResult, hoursResult] = await Promise.all([
      poQuery, soQuery, aeQuery, woQuery, hoursQuery
    ])

    if (poResult.error) throw poResult.error
    if (soResult.error) throw soResult.error  
    if (aeResult.error) throw aeResult.error
    if (woResult.error) throw woResult.error
    if (hoursResult.error) throw hoursResult.error

    const purchaseOrders = poResult.data || []
    const serviceOrders = soResult.data || []
    const additionalExpenses = aeResult.data || []
    const workOrders = woResult.data || []
    const hoursData = hoursResult.data || []

    // Create work order lookup
    const workOrderMap = new Map(workOrders.map(wo => [wo.id, wo]))

    // Calculate asset-level metrics
    const assetMetrics = new Map()
    
    // Initialize all assets
    filteredAssets.forEach(asset => {
      assetMetrics.set(asset.id, {
        id: asset.id,
        asset_code: asset.asset_id,
        asset_name: asset.name,
        model_name: asset.model_name,
        model_manufacturer: asset.model_manufacturer,
        model_category: asset.model_category,
        plant_id: asset.plant_id,
        plant_name: asset.plant_name,
        business_unit_id: asset.business_unit_id,
        business_unit_name: asset.business_unit_name,
        purchase_orders_cost: 0,
        service_orders_cost: 0,
        labor_cost: 0,
        parts_cost: 0,
        additional_expenses: 0,
        total_cost: 0,
        hours_worked: 0,
        preventive_cost: 0,
        corrective_cost: 0
      })
    })

    // Process service orders (primary cost source)
    serviceOrders.forEach(so => {
      const metrics = assetMetrics.get(so.asset_id)
      if (!metrics) return

      const totalCost = parseFloat(so.total_cost || '0')
      const laborCost = parseFloat(so.labor_cost || '0') 
      const partsCost = parseFloat(so.parts_cost || '0')

      metrics.service_orders_cost += totalCost
      metrics.labor_cost += laborCost
      metrics.parts_cost += partsCost
      metrics.total_cost += totalCost

      // Categorize by maintenance type
      const workOrder = so.work_order_id ? workOrderMap.get(so.work_order_id) : null
      const workOrderType = workOrder?.type || 'corrective'
      
      if (workOrderType === 'preventive') {
        metrics.preventive_cost += totalCost
      } else {
        metrics.corrective_cost += totalCost
      }
    })

    // Process purchase orders linked to assets
    purchaseOrders.forEach(po => {
      const amount = parseFloat(po.actual_amount || po.total_amount || '0')
      
      if (po.work_order_id) {
        const workOrder = workOrderMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          const metrics = assetMetrics.get(workOrder.asset_id)
          if (metrics) {
            metrics.purchase_orders_cost += amount
            metrics.total_cost += amount

            const workOrderType = workOrder.type || 'corrective'
            if (workOrderType === 'preventive') {
              metrics.preventive_cost += amount
            } else {
              metrics.corrective_cost += amount
            }
          }
        }
      }
    })

    // Process additional expenses
    additionalExpenses.forEach(ae => {
      const metrics = assetMetrics.get(ae.asset_id)
      if (!metrics) return

      const amount = parseFloat(ae.amount || '0')
      metrics.additional_expenses += amount
      metrics.total_cost += amount

      const workOrder = ae.work_order_id ? workOrderMap.get(ae.work_order_id) : null
      const workOrderType = workOrder?.type || 'corrective'
      
      if (workOrderType === 'preventive') {
        metrics.preventive_cost += amount
      } else {
        metrics.corrective_cost += amount
      }
    })

    // Calculate hours worked per asset with flexible date range
    const assetHours = new Map()
    
    // Group readings by asset
    hoursData.forEach(reading => {
      if (!assetHours.has(reading.asset_id)) {
        assetHours.set(reading.asset_id, [])
      }
      assetHours.get(reading.asset_id).push({
        hours: parseFloat(reading.equipment_hours_reading),
        timestamp: new Date(reading.reading_timestamp)
      })
    })

    // Calculate hours worked for each asset
    assetHours.forEach((readings, assetId) => {
      const metrics = assetMetrics.get(assetId)
      if (!metrics) return

      // Sort by timestamp
      readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      
      // Find readings within the actual date range
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)
      
      const rangeReadings = readings.filter(r => 
        r.timestamp >= startDateObj && r.timestamp <= endDateObj
      )
      
      if (rangeReadings.length >= 2) {
        // Use readings within the exact range
        const min = Math.min(...rangeReadings.map(r => r.hours))
        const max = Math.max(...rangeReadings.map(r => r.hours))
        metrics.hours_worked = Math.max(0, max - min)
      } else if (readings.length >= 2) {
        // Fallback: use all readings (including extended range)
        const min = Math.min(...readings.map(r => r.hours))
        const max = Math.max(...readings.map(r => r.hours))
        metrics.hours_worked = Math.max(0, max - min)
      } else {
        metrics.hours_worked = 0
      }
    })

    // Calculate plant-level aggregations
    const plantTotals = new Map()
    const buTotals = new Map()

    Array.from(assetMetrics.values()).forEach(asset => {
      // Plant totals
      if (!plantTotals.has(asset.plant_id)) {
        plantTotals.set(asset.plant_id, {
          id: asset.plant_id,
          name: asset.plant_name,
          business_unit_id: asset.business_unit_id,
          business_unit_name: asset.business_unit_name,
          total_cost: 0,
          purchase_orders_cost: 0,
          service_orders_cost: 0,
          labor_cost: 0,
          parts_cost: 0,
          additional_expenses: 0,
          hours_worked: 0,
          preventive_cost: 0,
          corrective_cost: 0,
          asset_count: 0
        })
      }

      const plantTotal = plantTotals.get(asset.plant_id)
      plantTotal.total_cost += asset.total_cost
      plantTotal.purchase_orders_cost += asset.purchase_orders_cost
      plantTotal.service_orders_cost += asset.service_orders_cost
      plantTotal.labor_cost += asset.labor_cost
      plantTotal.parts_cost += asset.parts_cost
      plantTotal.additional_expenses += asset.additional_expenses
      plantTotal.hours_worked += asset.hours_worked
      plantTotal.preventive_cost += asset.preventive_cost
      plantTotal.corrective_cost += asset.corrective_cost
      plantTotal.asset_count += 1

      // Business unit totals
      if (!buTotals.has(asset.business_unit_id)) {
        buTotals.set(asset.business_unit_id, {
          id: asset.business_unit_id,
          name: asset.business_unit_name,
          total_cost: 0,
          purchase_orders_cost: 0,
          service_orders_cost: 0,
          labor_cost: 0,
          parts_cost: 0,
          additional_expenses: 0,
          hours_worked: 0,
          preventive_cost: 0,
          corrective_cost: 0,
          asset_count: 0
        })
      }

      const buTotal = buTotals.get(asset.business_unit_id)
      buTotal.total_cost += asset.total_cost
      buTotal.purchase_orders_cost += asset.purchase_orders_cost
      buTotal.service_orders_cost += asset.service_orders_cost
      buTotal.labor_cost += asset.labor_cost
      buTotal.parts_cost += asset.parts_cost
      buTotal.additional_expenses += asset.additional_expenses
      buTotal.hours_worked += asset.hours_worked
      buTotal.preventive_cost += asset.preventive_cost
      buTotal.corrective_cost += asset.corrective_cost
      buTotal.asset_count += 1
    })

    // Add unlinked purchase orders to plant totals
    purchaseOrders.forEach(po => {
      if (!po.work_order_id && po.plant_id && plantTotals.has(po.plant_id)) {
        const amount = parseFloat(po.actual_amount || po.total_amount || '0')
        const plantTotal = plantTotals.get(po.plant_id)
        plantTotal.purchase_orders_cost += amount
        plantTotal.total_cost += amount

        // Also add to business unit total
        const buTotal = buTotals.get(plantTotal.business_unit_id)
        if (buTotal) {
          buTotal.purchase_orders_cost += amount
          buTotal.total_cost += amount
        }
      }
    })

    // Sort and paginate assets
    const assetList = Array.from(assetMetrics.values())
      .sort((a, b) => b.total_cost - a.total_cost)

    const totalAssets = assetList.length
    const startIdx = (page - 1) * pageSize
    const paginatedAssets = assetList.slice(startIdx, startIdx + pageSize)

    // Calculate overall summary
    const summary = {
      totalCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.total_cost, 0),
      purchaseOrdersCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.purchase_orders_cost, 0),
      serviceOrdersCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.service_orders_cost, 0),
      laborCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.labor_cost, 0),
      partsCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.parts_cost, 0),
      additionalExpenses: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.additional_expenses, 0),
      totalHours: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.hours_worked, 0),
      assetCount: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.asset_count, 0),
      preventiveCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.preventive_cost, 0),
      correctiveCost: Array.from(buTotals.values()).reduce((sum, bu) => sum + bu.corrective_cost, 0)
    }

    return NextResponse.json({
      summary,
      businessUnits: Array.from(buTotals.values()).sort((a, b) => b.total_cost - a.total_cost),
      plants: Array.from(plantTotals.values()).sort((a, b) => b.total_cost - a.total_cost),
      assets: {
        data: paginatedAssets,
        total: totalAssets,
        page,
        pageSize
      },
      filters: {
        businessUnits,
        plants: filteredPlants
      }
    })

  } catch (error: any) {
    console.error("Executive report error:", error)
    return NextResponse.json({ 
      error: error?.message || "Internal server error" 
    }, { status: 500 })
  }
}