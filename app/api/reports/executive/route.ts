import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient as createServerSupabase } from "@/lib/supabase-server"
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from "@/lib/reporting/asset-plant-attribution"

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
    
    // Parse dates same way as gerencial report for consistency
    // startDate and endDate come as ISO strings, extract date part if needed
    const dateFromStr = startDate.includes('T') ? startDate.split('T')[0] : startDate
    const dateToStr = endDate.includes('T') ? endDate.split('T')[0] : endDate
    
    // Compute exclusive end-of-day bound (same as gerencial)
    // Use UTC explicitly to ensure consistent behavior across environments
    const dateFromStart = new Date(`${dateFromStr}T00:00:00.000Z`)
    const dateToExclusive = new Date(`${dateToStr}T00:00:00.000Z`)
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1) // Add 1 day for exclusive end
    
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

    // Build full org maps and raw asset list first.
    // We apply BU/plant filters only after historical attribution to avoid
    // misclassifying moved assets based on their current location.
    const plantById = new Map<string, { id: string; name: string; business_unit_id: string; business_unit_name: string }>()
    const rawAssets: any[] = []
    const filteredPlants: any[] = []

    for (const bu of businessUnits || []) {
      for (const plant of bu.plants || []) {
        const plantInfo = {
          id: plant.id,
          name: plant.name,
          code: plant.code,
          business_unit_id: bu.id,
          business_unit_name: bu.name,
        }
        plantById.set(plant.id, plantInfo)
        if (!businessUnitId || bu.id === businessUnitId) {
          filteredPlants.push(plantInfo)
        }

        for (const asset of plant.assets || []) {
          rawAssets.push({
            ...asset,
            current_plant_id: plant.id,
            current_plant_name: plant.name,
            current_business_unit_id: bu.id,
            current_business_unit_name: bu.name,
            model_name: asset.equipment_models?.name || "Sin modelo",
            model_manufacturer: asset.equipment_models?.manufacturer || "",
          })
        }
      }
    }

    const rawAssetIds = rawAssets.map((a) => a.id)
    const attributionDate = `${dateToStr}T23:59:59.999Z`
    let assignmentRows: any[] = []
    if (rawAssetIds.length > 0) {
      const { data, error: assignmentError } = await supabase
        .from("asset_assignment_history")
        .select("asset_id, previous_plant_id, new_plant_id, created_at")
        .in("asset_id", rawAssetIds)
        .order("created_at", { ascending: true })
      if (assignmentError) throw assignmentError
      assignmentRows = data || []
    }
    const assignmentHistoryMap = buildAssignmentHistoryMap(assignmentRows)

    const allAssets = rawAssets
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

    const assetIds = allAssets.map(a => a.id)
    const attributedAssetPlantById = new Map(allAssets.map((a) => [a.id, a.plant_id]))

    if (assetIds.length === 0) {
      return NextResponse.json({
        summary: { totalCost: 0, purchaseOrdersCost: 0, serviceOrdersCost: 0, laborCost: 0, partsCost: 0, additionalExpenses: 0, totalHours: 0, assetCount: 0, preventiveCost: 0, correctiveCost: 0 },
        businessUnits: [], plants: [], assets: { data: [], total: 0, page, pageSize },
        filters: { businessUnits: businessUnits || [], plants: filteredPlants }
      })
    }

    // Get purchase orders (exclude only pending_approval)
    const { data: purchaseOrders, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        id, order_id, total_amount, actual_amount, created_at, purchase_date, plant_id, work_order_id, status, supplier, items, is_adjustment, po_purpose
      `)
      .neq("status", "pending_approval")

    if (poError) throw poError

    // Get work orders for the purchase orders (to get asset_id, type, planned_date, and completed_at)
    const poWorkOrderIds = purchaseOrders?.map(po => po.work_order_id).filter(Boolean) || []
    let workOrdersMap = new Map()
    const assetToPlantMap = new Map<string, string>()
    
    if (poWorkOrderIds.length > 0) {
      const { data: workOrders, error: woError } = await supabase
        .from("work_orders")
        .select("id, type, asset_id, planned_date, completed_at, created_at, plant_id")
        .in("id", poWorkOrderIds)
      
      if (woError) throw woError
      
      workOrdersMap = new Map(workOrders?.map(wo => [wo.id, wo]) || [])
      
      // Build asset to plant mapping for filtering using attributed asset plant as of report end.
      workOrders?.forEach(wo => {
        if (wo.asset_id) {
          const attributedPlantId = attributedAssetPlantById.get(wo.asset_id)
          if (attributedPlantId) {
            assetToPlantMap.set(wo.asset_id, attributedPlantId)
          }
        }
      })
    }

    // Filter purchase orders by the correct date (work order planned_date or PO created_at) and plant
    const filteredPurchaseOrders = purchaseOrders?.filter(po => {
      // Check plant filtering first
      let purchaseOrderPlantId = po.plant_id
      
      // If PO doesn't have plant_id but has work order, get plant from work order asset
      if (!purchaseOrderPlantId && po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          purchaseOrderPlantId = assetToPlantMap.get(workOrder.asset_id)
        }
      }
      
      // Apply plant filters
      if (plantId && purchaseOrderPlantId !== plantId) {
        return false
      }
      if (businessUnitId && filteredPlants.length > 0) {
        const plantIds = filteredPlants.map(p => p.id)
        if (!plantIds.includes(purchaseOrderPlantId)) {
          return false
        }
      }
      
      // Check date filtering - priority: purchase_date → work_order.completed_at → work_order.planned_date → work_order.created_at
      let dateToCheck: string
      
      // First priority: purchase_date
      if (po.purchase_date) {
        dateToCheck = po.purchase_date
      } else if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        // Second priority: work_order.completed_at
        if (workOrder?.completed_at) {
          dateToCheck = workOrder.completed_at
        } 
        // Third priority: work_order.planned_date
        else if (workOrder?.planned_date) {
          dateToCheck = workOrder.planned_date
        }
        // Fourth priority: work_order.created_at
        else if (workOrder?.created_at) {
          dateToCheck = workOrder.created_at
        }
        // Fallback to PO created_at if work order doesn't have any date
        else {
          dateToCheck = po.created_at
        }
      } else {
        // Direct purchase/service orders without work order - use PO created_at
        dateToCheck = po.created_at
      }
      
      // Extract date-only string (YYYY-MM-DD) from timestamptz, ignoring time/timezone
      const extractDateOnly = (dateStr: string): string => {
        if (!dateStr) return ''
        // Handle ISO timestamptz: "2025-10-01T00:00:00+00" -> "2025-10-01"
        if (dateStr.includes('T')) {
          return dateStr.split('T')[0]
        }
        // Handle date-only string: "2025-10-01" -> "2025-10-01"
        return dateStr.slice(0, 10)
      }
      
      // Compare by DATE ONLY (YYYY-MM-DD) to avoid timezone issues
      const checkDateOnly = extractDateOnly(dateToCheck)
      
      // Compare as date strings (YYYY-MM-DD), ignoring time and timezone
      // This ensures "2025-10-01" is always > "2025-09-30" regardless of server timezone
      return checkDateOnly >= dateFromStr && checkDateOnly <= dateToStr
    }) || []

    // Service orders are not used for cost calculations since they're always linked to work orders that have POs
    // We only count purchase orders for costs

    // Get additional expenses (both linked to assets and unlinked for audit)
    // Exclude those that have been converted to purchase orders (adjustment_po_id) to avoid double counting
    let additionalExpensesQuery = supabase
      .from("additional_expenses")
      .select("id, asset_id, amount, created_at, description, status, work_order_id, adjustment_po_id")
      .gte("created_at", dateFromStart.toISOString())
      .lt("created_at", dateToExclusive.toISOString()) // Exclusive end, same as gerencial
      .neq("status", "rejected")
      .is("adjustment_po_id", null) // Exclude expenses already converted to POs
    
    if (assetIds.length > 0) {
      additionalExpensesQuery = additionalExpensesQuery.or(`asset_id.in.(${assetIds.join(',')}),asset_id.is.null`)
    } else {
      additionalExpensesQuery = additionalExpensesQuery.is("asset_id", null)
    }
    
    const { data: additionalExpenses, error: aeError } = await additionalExpensesQuery

    if (aeError) throw aeError

    // Separate linked and unlinked additional expenses
    const linkedAdditionalExpenses = assetIds.length > 0 
      ? (additionalExpenses || []).filter(ae => ae.asset_id && assetIds.includes(ae.asset_id))
      : []
    const unlinkedAdditionalExpenses = (additionalExpenses || []).filter(ae => !ae.asset_id || (assetIds.length > 0 && !assetIds.includes(ae.asset_id)))

    // Get equipment hours
    // For hours calculation, we need a flexible window:
    // - Extended start (30 days before) to get baseline readings
    // - Extended end (inclusive of the end date) to include readings on the last day
    // This allows us to calculate hours worked within the period even if readings
    // fall just before the start or on the last day
    const extendedStart = new Date(dateFromStart)
    extendedStart.setDate(extendedStart.getDate() - 30)
    
    // For hours, we want to include readings through the end date (inclusive)
    // Add a small buffer to include all of the last day
    const extendedEnd = new Date(dateToExclusive)
    extendedEnd.setMilliseconds(extendedEnd.getMilliseconds() - 1) // Include the last millisecond before exclusive end
    
    const { data: hoursData, error: hoursError } = await supabase
      .from("completed_checklists")
      .select("asset_id, equipment_hours_reading, reading_timestamp")
      .gte("reading_timestamp", extendedStart.toISOString())
      .lte("reading_timestamp", extendedEnd.toISOString()) // Inclusive end for hours calculation
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
        service_orders_cost: 0,
        labor_cost: 0,
        parts_cost: 0,
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

    // Separate POs by purpose - exclude restocking from expenses
    const workOrderPOs = filteredPurchaseOrders.filter(po => 
      po.work_order_id && po.po_purpose !== 'inventory_restock'
    )
    const restockingPOs = filteredPurchaseOrders.filter(po => 
      po.po_purpose === 'inventory_restock' || (!po.work_order_id && !po.po_purpose)
    )
    
    console.log(`[Executive] Excluded ${restockingPOs.length} restocking POs from expenses`)
    
    // Process work order POs - GROUP BY ASSET (using filtered list)
    workOrderPOs.forEach(po => {
      const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
      const isCashExpense = po.po_purpose !== 'work_order_inventory'
      const cashAmount = isCashExpense ? finalAmount : 0
      const inventoryAmount = !isCashExpense ? finalAmount : 0
      
      // If linked to work order -> get asset from work order
      if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          const metrics = assetMetrics.get(workOrder.asset_id)
          if (metrics) {
            metrics.purchase_orders_cost += finalAmount
            metrics.total_cost += finalAmount
            
            // Track cash vs inventory separately
            if (!metrics.cash_expenses) metrics.cash_expenses = 0
            if (!metrics.inventory_expenses) metrics.inventory_expenses = 0
            metrics.cash_expenses += cashAmount
            metrics.inventory_expenses += inventoryAmount
            
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

    // Process additional expenses - for DISPLAY only, NOT for cost totals
    // Los gastos adicionales al convertirse son ÓC de ajuste (is_adjustment=true).
    // Esas ÓC ya están en purchase_orders_cost. Sumarlos aquí causaría doble conteo.
    // Regla: solo se cuenta en purchase_orders. additional_expenses no se suma a total_cost.
    linkedAdditionalExpenses.forEach(ae => {
      const metrics = assetMetrics.get(ae.asset_id)
      if (metrics) {
        const amount = parseFloat(ae.amount || '0')
        metrics.additional_expenses += amount  // Display/breakdown only
        // NO: metrics.total_cost += amount
        // NO: metrics.corrective_cost += amount
        
        metrics.additional_expenses_list.push({
          id: ae.id,
          amount: amount,
          created_at: ae.created_at,
          description: ae.description,
          status: ae.status,
          work_order_id: ae.work_order_id
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

    // Add unlinked purchase orders to plant totals (standalone POs, WO without asset)
    // Exclude inventory_restock - those are not maintenance expense
    // Match Gerencial: create plant entry if not exists (plants with no assets but standalone POs)
    filteredPurchaseOrders.forEach(po => {
      if (po.po_purpose === 'inventory_restock') return
      const workOrder = po.work_order_id ? workOrdersMap.get(po.work_order_id) : null
      if (!workOrder?.asset_id) {
        let purchaseOrderPlantId = po.plant_id
        if (purchaseOrderPlantId && plantTotals.has(purchaseOrderPlantId)) {
          const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
          const plantTotal = plantTotals.get(purchaseOrderPlantId)
          plantTotal.purchase_orders_cost += finalAmount
          plantTotal.total_cost += finalAmount
          const buTotal = buTotals.get(plantTotal.business_unit_id)
          if (buTotal) {
            buTotal.purchase_orders_cost += finalAmount
            buTotal.total_cost += finalAmount
          }
        } else if (purchaseOrderPlantId) {
          // Plant with no assets but has standalone PO - create plant total (same as Gerencial)
          const plantInfo = filteredPlants.find((p: { id: string }) => p.id === purchaseOrderPlantId)
          if (plantInfo) {
            if (!plantTotals.has(purchaseOrderPlantId)) {
              plantTotals.set(purchaseOrderPlantId, {
                id: plantInfo.id, name: plantInfo.name, business_unit_id: plantInfo.business_unit_id, business_unit_name: plantInfo.business_unit_name,
                total_cost: 0, purchase_orders_cost: 0, service_orders_cost: 0, labor_cost: 0, parts_cost: 0, additional_expenses: 0, hours_worked: 0, preventive_cost: 0, corrective_cost: 0, asset_count: 0
              })
            }
            const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
            const plantTotal = plantTotals.get(purchaseOrderPlantId)
            plantTotal.purchase_orders_cost += finalAmount
            plantTotal.total_cost += finalAmount
            if (!buTotals.has(plantInfo.business_unit_id)) {
              buTotals.set(plantInfo.business_unit_id, {
                id: plantInfo.business_unit_id, name: plantInfo.business_unit_name,
                total_cost: 0, purchase_orders_cost: 0, service_orders_cost: 0, labor_cost: 0, parts_cost: 0, additional_expenses: 0, hours_worked: 0, preventive_cost: 0, corrective_cost: 0, asset_count: 0
              })
            }
            const buTotal = buTotals.get(plantInfo.business_unit_id)
            buTotal.purchase_orders_cost += finalAmount
            buTotal.total_cost += finalAmount
          }
        }
      }
    })

    // Sort and paginate assets
    const assetList = Array.from(assetMetrics.values()).sort((a, b) => b.total_cost - a.total_cost)
    const totalAssets = assetList.length
    const paginatedAssets = assetList.slice((page - 1) * pageSize, page * pageSize)

    // Calculate summary
    // totalCost = purchaseOrdersCost + serviceOrdersCost + laborCost + partsCost
    // Los gastos adicionales NO se suman al total (al convertirse son ÓC de ajuste, ya incluidas en POs)
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
    
    // Validation: totalCost = PO + service + labor + parts (additionalExpenses no se suma)
    const calculatedComponentsTotal = summary.purchaseOrdersCost + summary.serviceOrdersCost + 
                                     summary.laborCost + summary.partsCost
    if (Math.abs(summary.totalCost - calculatedComponentsTotal) > 0.01) {
      console.warn('Executive Report Summary Mismatch:', {
        totalCost: summary.totalCost,
        calculatedComponentsTotal,
        difference: summary.totalCost - calculatedComponentsTotal,
        components: {
          purchaseOrdersCost: summary.purchaseOrdersCost,
          serviceOrdersCost: summary.serviceOrdersCost,
          laborCost: summary.laborCost,
          partsCost: summary.partsCost,
          additionalExpenses: summary.additionalExpenses
        }
      })
    }

    return NextResponse.json({
      summary,
      businessUnits: Array.from(buTotals.values()).sort((a, b) => b.total_cost - a.total_cost),
      plants: Array.from(plantTotals.values()).sort((a, b) => b.total_cost - a.total_cost),
      assets: { data: paginatedAssets, total: totalAssets, page, pageSize },
      filters: { businessUnits: businessUnits || [], plants: filteredPlants },
      unlinkedAdditionalExpenses: unlinkedAdditionalExpenses.map(ae => ({
        id: ae.id,
        amount: parseFloat(ae.amount || '0'),
        created_at: ae.created_at,
        description: ae.description,
        status: ae.status,
        work_order_id: ae.work_order_id,
        asset_id: ae.asset_id
      }))
    })

  } catch (error: any) {
    console.error("Executive report error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}