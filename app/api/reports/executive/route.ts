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
    const { data: businessUnits, error: buError } = await supabase
      .from("business_units")
      .select(`
        id, name, code,
        plants:plants(
          id, name, code,
          assets:assets(
            id, asset_id, name, model_id,
            equipment_models:equipment_models(name, manufacturer, category)
          )
        )
      `)
      .order("name")

    if (buError) throw buError

    // Build asset lookup and apply filters
    let allAssets: any[] = []
    let filteredPlants: any[] = []

    for (const bu of businessUnits || []) {
      if (businessUnitId && bu.id !== businessUnitId) continue
      
      for (const plant of bu.plants || []) {
        if (plantId && plant.id !== plantId) continue
        
        filteredPlants.push({
          ...plant,
          business_unit_id: bu.id,
          business_unit_name: bu.name
        })
        
        for (const asset of plant.assets || []) {
          allAssets.push({
            ...asset,
            plant_id: plant.id,
            plant_name: plant.name,
            business_unit_id: bu.id,
            business_unit_name: bu.name,
            model_name: asset.equipment_models?.name || 'Sin modelo',
            model_manufacturer: asset.equipment_models?.manufacturer || '',
          })
        }
      }
    }

    const assetIds = allAssets.map(a => a.id)
    const plantIds = filteredPlants.map(p => p.id)

    if (assetIds.length === 0) {
      return NextResponse.json({
        summary: { totalCost: 0, purchaseOrdersCost: 0, serviceOrdersCost: 0, laborCost: 0, partsCost: 0, additionalExpenses: 0, totalHours: 0, assetCount: 0, preventiveCost: 0, correctiveCost: 0 },
        businessUnits: [], plants: [], assets: { data: [], total: 0, page, pageSize },
        filters: { businessUnits: businessUnits || [], plants: filteredPlants }
      })
    }

    // Get purchase orders in date range - APPROVED ONLY (using correct English status names)
    const { data: purchaseOrders, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        id, order_id, total_amount, actual_amount, created_at, plant_id, work_order_id, status, supplier, items
      `)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("status", ["approved", "validated", "received", "purchased"]) // Include validated status

    if (poError) throw poError

    // Get work orders for the purchase orders (to get asset_id and type)
    const poWorkOrderIds = purchaseOrders?.map(po => po.work_order_id).filter(Boolean) || []
    let workOrdersMap = new Map()
    
    if (poWorkOrderIds.length > 0) {
      const { data: workOrders, error: woError } = await supabase
        .from("work_orders")
        .select("id, type, asset_id")
        .in("id", poWorkOrderIds)
      
      if (woError) throw woError
      workOrdersMap = new Map(workOrders?.map(wo => [wo.id, wo]) || [])
    }

    // Service orders are not used for cost calculations since they're always linked to work orders that have POs
    // We only count purchase orders for costs

    // Get additional expenses
    const { data: additionalExpenses, error: aeError } = await supabase
      .from("additional_expenses")
      .select("id, asset_id, amount, created_at")
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("asset_id", assetIds)

    if (aeError) throw aeError

    // Get equipment hours
    const extendedStart = new Date(startDate)
    extendedStart.setDate(extendedStart.getDate() - 30)
    
    const { data: hoursData, error: hoursError } = await supabase
      .from("completed_checklists")
      .select("asset_id, equipment_hours_reading, reading_timestamp")
      .gte("reading_timestamp", extendedStart.toISOString())
      .lte("reading_timestamp", endDate)
      .in("asset_id", assetIds)
      .not("equipment_hours_reading", "is", null)

    if (hoursError) throw hoursError

    // Initialize asset metrics
    const assetMetrics = new Map()
    allAssets.forEach(asset => {
      assetMetrics.set(asset.id, {
        id: asset.id,
        asset_code: asset.asset_id,
        asset_name: asset.name,
        model_name: asset.model_name,
        model_manufacturer: asset.model_manufacturer,
        plant_name: asset.plant_name,
        business_unit_name: asset.business_unit_name,
        plant_id: asset.plant_id,
        business_unit_id: asset.business_unit_id,
        total_cost: 0,
        purchase_orders_cost: 0,
        additional_expenses: 0,
        hours_worked: 0,
        preventive_cost: 0,
        corrective_cost: 0,
        purchase_orders: [] as Array<{
          id: string,
          order_id: string,
          amount: number,
          status: string,
          supplier: string,
          created_at: string,
          work_order_type: string,
          items: any[]
        }>,
        additional_expenses_list: [] as Array<{
          id: string,
          amount: number,
          created_at: string
        }>
      
      })
    })

    // Process purchase orders - GROUP BY ASSET
    purchaseOrders?.forEach(po => {
      const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
      
      // If linked to work order -> get asset from work order
      if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          const metrics = assetMetrics.get(workOrder.asset_id)
          if (metrics) {
            metrics.purchase_orders_cost += finalAmount
            metrics.total_cost += finalAmount
            
            // Add detailed PO info
            metrics.purchase_orders.push({
              id: po.id,
              order_id: po.order_id || 'N/A',
              amount: finalAmount,
              status: po.status,
              supplier: po.supplier || 'N/A',
              created_at: po.created_at,
              work_order_type: workOrder.type,
              items: po.items || []
            })
            
            // Classify by maintenance type
            if (workOrder.type === 'preventive') {
              metrics.preventive_cost += finalAmount
            } else {
              metrics.corrective_cost += finalAmount
            }
          }
        }
      }
    })

    // Don't process service orders for costs - they're linked to work orders that have POs
    // Service orders are only used for additional details about the purchase orders
    // We'll fetch service order details when needed for the breakdown display

    // Process additional expenses
    additionalExpenses?.forEach(ae => {
      const metrics = assetMetrics.get(ae.asset_id)
      if (metrics) {
        const amount = parseFloat(ae.amount || '0')
        metrics.additional_expenses += amount
        metrics.total_cost += amount
        metrics.corrective_cost += amount
        
        // Add to additional expenses array
        metrics.additional_expenses_list.push({
          id: ae.id,
          amount: amount,
          created_at: ae.created_at
        })
      }
    })

    // Calculate hours worked
    const assetHours = new Map()
    hoursData?.forEach(reading => {
      if (!assetHours.has(reading.asset_id)) {
        assetHours.set(reading.asset_id, [])
      }
      assetHours.get(reading.asset_id).push(parseFloat(reading.equipment_hours_reading))
    })

    assetHours.forEach((readings, assetId) => {
      const metrics = assetMetrics.get(assetId)
      if (metrics && readings.length >= 2) {
        const min = Math.min(...readings)
        const max = Math.max(...readings)
        metrics.hours_worked = Math.max(0, max - min)
      }
    })

    // Calculate plant and business unit totals
    const plantTotals = new Map()
    const buTotals = new Map()

    Array.from(assetMetrics.values()).forEach(asset => {
      // Plant totals
      if (!plantTotals.has(asset.plant_id)) {
        plantTotals.set(asset.plant_id, {
          id: asset.plant_id, name: asset.plant_name, business_unit_id: asset.business_unit_id, business_unit_name: asset.business_unit_name,
          total_cost: 0, purchase_orders_cost: 0, service_orders_cost: 0, labor_cost: 0, parts_cost: 0, additional_expenses: 0, hours_worked: 0, preventive_cost: 0, corrective_cost: 0, asset_count: 0
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
          id: asset.business_unit_id, name: asset.business_unit_name,
          total_cost: 0, purchase_orders_cost: 0, service_orders_cost: 0, labor_cost: 0, parts_cost: 0, additional_expenses: 0, hours_worked: 0, preventive_cost: 0, corrective_cost: 0, asset_count: 0
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

    // Add unlinked purchase orders to plant totals only
    purchaseOrders?.forEach(po => {
      const workOrder = po.work_order_id ? workOrdersMap.get(po.work_order_id) : null
      if (!workOrder?.asset_id && po.plant_id && plantTotals.has(po.plant_id)) {
        const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
        const plantTotal = plantTotals.get(po.plant_id)
        plantTotal.purchase_orders_cost += finalAmount
        plantTotal.total_cost += finalAmount

        const buTotal = buTotals.get(plantTotal.business_unit_id)
        if (buTotal) {
          buTotal.purchase_orders_cost += finalAmount
          buTotal.total_cost += finalAmount
        }
      }
    })

    // Sort and paginate assets
    const assetList = Array.from(assetMetrics.values()).sort((a, b) => b.total_cost - a.total_cost)
    const totalAssets = assetList.length
    const paginatedAssets = assetList.slice((page - 1) * pageSize, page * pageSize)

    // Calculate summary
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
      assets: { data: paginatedAssets, total: totalAssets, page, pageSize },
      filters: { businessUnits: businessUnits || [], plants: filteredPlants }
    })

  } catch (error: any) {
    console.error("Executive report error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}