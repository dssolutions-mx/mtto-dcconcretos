import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

type Body = {
  dateFrom: string
  dateTo: string
  businessUnitId?: string | null
  plantId?: string | null
  hideZeroActivity?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { dateFrom, dateTo, businessUnitId, plantId, hideZeroActivity } = (await req.json()) as Body

    // Compute exclusive end-of-day bound to avoid timezone-related drops
    const dateFromStart = new Date(`${dateFrom}T00:00:00`)
    const dateToExclusive = new Date(`${dateTo}T00:00:00`)
    dateToExclusive.setDate(dateToExclusive.getDate() + 1)
    const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)

    const supabase = await createServerSupabase()

    // Fetch business units and plants for filters
    const { data: businessUnits } = await supabase
      .from('business_units')
      .select('id, name, code')
      .order('name')

    let plantsQuery = supabase
      .from('plants')
      .select('id, name, code, business_unit_id')
      .order('name')
    
    if (businessUnitId) plantsQuery = plantsQuery.eq('business_unit_id', businessUnitId)
    const { data: plants } = await plantsQuery

    // Get organizational structure with assets
    let buQuery = supabase
      .from('business_units')
      .select(`
        id, name, code,
        plants:plants(
          id, name, code, business_unit_id,
          assets:assets(
            id, asset_id, name, plant_id, model_id,
            equipment_models(name, manufacturer, category)
          )
        )
      `)
      .order('name')

    const { data: businessUnitsRaw, error: buError } = await buQuery
    if (buError) {
      console.error('Business units error:', buError)
      throw buError
    }

    // Build flat asset list with hierarchy info
    const assets: any[] = []
    const allBusinessUnits = businessUnitsRaw || []
    
    for (const bu of allBusinessUnits) {
      if (businessUnitId && bu.id !== businessUnitId) continue
      
      for (const plant of (bu.plants || [])) {
        if (plantId && plant.id !== plantId) continue
        
        for (const asset of (plant.assets || [])) {
          // Determine equipment type: 1.b) By assets.asset_id starting with BP (bombas)
          const assetCode: string | undefined = asset.asset_id || undefined
          const modelCategory: string | undefined = (asset as any).equipment_models?.category || undefined
          const equipmentType = (assetCode && assetCode.toUpperCase().startsWith('BP'))
            ? 'Bomba'
            : (modelCategory || 'Sin categoría')

          assets.push({
            id: asset.id,
            asset_code: asset.asset_id,
            name: asset.name,
            plant_id: asset.plant_id,
            plant_name: plant.name,
            plant_code: plant.code,
            business_unit_id: bu.id,
            business_unit_name: bu.name,
            model_category: modelCategory || null,
            equipment_type: equipmentType
          })
        }
      }
    }

    // Fetch diesel transactions with asset info
    let dieselQuery = supabase
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
        previous_horometer
      `)
      .gte('transaction_date', dateFrom)
      .lt('transaction_date', dateToExclusiveStr)

    const { data: dieselTxs } = await dieselQuery

    // Fetch checklist equipment hours (extend window to capture progression)
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

    // Fetch diesel products for pricing
    const productIds = Array.from(new Set((dieselTxs || []).map(t => t.product_id).filter(Boolean)))
    const { data: products } = await supabase
      .from('diesel_products')
      .select('id, price_per_liter')
      .in('id', productIds)

    const priceByProduct = new Map<string, number>()
    ;(products || []).forEach(p => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

    // Calculate effective price per product
    const avgPriceByProduct = new Map<string, number>()
    productIds.forEach(pid => {
      const productTxs = (dieselTxs || []).filter(t => t.product_id === pid && t.transaction_type === 'entry')
      const avg = productTxs.length > 0
        ? productTxs.reduce((acc, t) => acc + Number(t.unit_cost || 0), 0) / productTxs.length
        : 0
      avgPriceByProduct.set(pid, priceByProduct.get(pid) || avg || 0)
    })

    // Fetch purchase orders (same as executive report)
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select(`
        id, order_id, total_amount, actual_amount, created_at, plant_id, work_order_id, status
      `)
      .in('status', ['approved', 'validated', 'received', 'purchased'])

    // Get work orders for the purchase orders (to get asset_id and type)
    const poWorkOrderIds = purchaseOrders?.map(po => po.work_order_id).filter(Boolean) || []
    let workOrdersMap = new Map()
    
    if (poWorkOrderIds.length > 0) {
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id, type, asset_id, planned_date,
          assets (
            id, plant_id
          )
        `)
        .in('id', poWorkOrderIds)
      
      workOrdersMap = new Map(workOrders?.map(wo => [wo.id, wo]) || [])
    }

    // Filter purchase orders by date range (inclusive start, exclusive end)
    const filteredPurchaseOrders = purchaseOrders?.filter(po => {
      let dateToCheckStr: string
      if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.planned_date) {
          dateToCheckStr = workOrder.planned_date
        } else {
          dateToCheckStr = po.created_at
        }
      } else {
        dateToCheckStr = po.created_at
      }
      const ts = new Date(dateToCheckStr).getTime()
      return ts >= dateFromStart.getTime() && ts < dateToExclusive.getTime()
    }) || []

    // Get additional expenses
    const assetIds = assets.map(a => a.id)
    const { data: additionalExpenses } = await supabase
      .from('additional_expenses')
      .select('id, asset_id, amount, created_at')
      .gte('created_at', dateFrom)
      .lt('created_at', dateToExclusiveStr)
      .in('asset_id', assetIds)

    // Create plant code to maintenance plant ID map
    const plantCodeToIdMap = new Map<string, string>()
    ;(plants || []).forEach(p => {
      if (p.code) plantCodeToIdMap.set(p.code, p.id)
    })

    // Fetch sales from cotizador
    const host = req.headers.get('host') || ''
    const base = process.env.NEXT_PUBLIC_BASE_URL || (host.includes('localhost') ? `http://${host}` : `https://${host}`)
    
    // Get cotizador plant IDs that match our maintenance plant codes
    const cotizadorSupabase = createClient(
      process.env.COTIZADOR_SUPABASE_URL!,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: cotizadorPlants } = await cotizadorSupabase
      .from('plants')
      .select('id, code')

    // Map cotizador plant IDs to maintenance plant IDs by code
    const cotizadorPlantIdToMaintenancePlantId = new Map<string, string>()
    ;(cotizadorPlants || []).forEach(cp => {
      const maintenancePlantId = plantCodeToIdMap.get(cp.code)
      if (maintenancePlantId) {
        cotizadorPlantIdToMaintenancePlantId.set(cp.id, maintenancePlantId)
      }
    })

    // Build list of cotizador plant IDs to query
    let cotizadorPlantIds: string[] = []
    if (plantId) {
      // Find cotizador plant ID for this maintenance plant
      const plantCode = (plants || []).find(p => p.id === plantId)?.code
      if (plantCode) {
        const cotizadorPlant = (cotizadorPlants || []).find(cp => cp.code === plantCode)
        if (cotizadorPlant) cotizadorPlantIds = [cotizadorPlant.id]
      }
    } else if (businessUnitId && plants) {
      const buPlants = plants.filter(p => p.business_unit_id === businessUnitId)
      buPlants.forEach(p => {
        const cotizadorPlant = (cotizadorPlants || []).find(cp => cp.code === p.code)
        if (cotizadorPlant) cotizadorPlantIds.push(cotizadorPlant.id)
      })
    }

    const salesResp = await fetch(`${base}/api/integrations/cotizador/sales/assets/weekly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dateFrom, 
        dateTo, 
        plantIds: cotizadorPlantIds.length > 0 ? cotizadorPlantIds : undefined 
      })
    })
    const salesRows = salesResp.ok ? await salesResp.json() : []

    // Helper function for fuzzy matching asset codes
    const normalizeAssetCode = (code: string): string => {
      // Remove common suffixes like -1, -A, -B, etc.
      return code.toUpperCase().replace(/[-\s]+(1|2|3|A|B|C|D)$/i, '').trim()
    }

    // Create asset name mappings for quick lookup
    const { data: assetMappings } = await supabase
      .from('asset_name_mappings')
      .select('asset_id, external_unit, source_system')
      .eq('source_system', 'cotizador')

    const assetNameToIdMap = new Map<string, string>()
    ;(assetMappings || []).forEach(mapping => {
      if (mapping.external_unit && mapping.asset_id) {
        assetNameToIdMap.set(mapping.external_unit.toUpperCase(), mapping.asset_id)
      }
    })

    // Build fuzzy matching index: normalized code → list of actual assets
    const normalizedCodeToAssets = new Map<string, any[]>()
    assets.forEach(asset => {
      if (!asset.asset_code) return
      
      // Exact match
      assetNameToIdMap.set(asset.asset_code.toUpperCase(), asset.id)
      
      // Fuzzy match
      const normalized = normalizeAssetCode(asset.asset_code)
      if (!normalizedCodeToAssets.has(normalized)) {
        normalizedCodeToAssets.set(normalized, [])
      }
      normalizedCodeToAssets.get(normalized)!.push(asset)
    })

    // Aggregate data by asset
    const assetMap = new Map<string, any>()
    assets.forEach(asset => {
      assetMap.set(asset.id, {
        id: asset.id,
        asset_code: asset.asset_code,
        asset_name: asset.name,
        plant_id: asset.plant_id,
        plant_name: asset.plant_name,
        plant_code: asset.plant_code,
        business_unit_id: asset.business_unit_id,
        business_unit_name: asset.business_unit_name,
        model_category: (asset as any).model_category || null,
        equipment_type: (asset as any).equipment_type || 'Sin categoría',
        diesel_liters: 0,
        diesel_cost: 0,
        hours_worked: 0,
        liters_per_hour: 0,
        maintenance_cost: 0,
        preventive_cost: 0,
        corrective_cost: 0,
        sales_subtotal: 0,
        sales_with_vat: 0,
        concrete_m3: 0,
        total_m3: 0,
        remisiones_count: 0
      })
    })

    // Aggregate diesel by asset and compute hours (LPH)
    const dieselByAsset = new Map<string, any[]>()
    type ReadingEvent = { ts: number, val: number }
    const checklistEventsByAsset = new Map<string, ReadingEvent[]>()
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

      const asset = assetMap.get(tx.asset_id)
      if (!asset) return
      const qty = Number(tx.quantity_liters || 0)
      const price = avgPriceByProduct.get(tx.product_id) || Number(tx.unit_cost || 0)
      asset.diesel_liters += qty
      asset.diesel_cost += qty * price
    })

    // Compute hours_worked and liters_per_hour per asset based on combined readings
    dieselByAsset.forEach((txs, assetId) => {
      const asset = assetMap.get(assetId)
      if (!asset) return
      const events: ReadingEvent[] = []
      // Checklist events
      const chkEvents = checklistEventsByAsset.get(assetId) || []
      events.push(...chkEvents)
      // Diesel transaction events (use transaction_date timestamp)
      txs.forEach((t: any) => {
        const tts = new Date(t.transaction_date).getTime()
        if (!Number.isNaN(tts)) {
          if (t.previous_horometer != null) {
            const v = Number(t.previous_horometer)
            if (!Number.isNaN(v)) events.push({ ts: tts - 1, val: v })
          }
          if (t.horometer_reading != null) {
            const v = Number(t.horometer_reading)
            if (!Number.isNaN(v)) events.push({ ts: tts, val: v })
          }
        }
      })

      if (events.length === 0) return
      // Choose baseline: earliest reading within [start, end) if available; otherwise last reading before start
      const startMs = dateFromStart.getTime()
      const endMs = dateToExclusive.getTime()
      const withinWindow = events.filter(e => e.ts >= startMs && e.ts < endMs).sort((a, b) => a.ts - b.ts)
      let baseline: ReadingEvent | null = null
      if (withinWindow.length > 0) {
        baseline = withinWindow[0]
      } else {
        const beforeStart = events.filter(e => e.ts < startMs).sort((a, b) => b.ts - a.ts)
        if (beforeStart.length > 0) baseline = beforeStart[0]
      }
      if (!baseline) return
      const upToEnd = events.filter(e => e.ts < endMs).sort((a, b) => a.ts - b.ts)
      if (upToEnd.length === 0) return
      const last = upToEnd[upToEnd.length - 1]
      const hours = Math.max(0, last.val - baseline.val)
      if (hours > 0) {
        asset.hours_worked = hours
        asset.liters_per_hour = asset.diesel_liters > 0 ? asset.diesel_liters / hours : 0
      }
    })

    // Aggregate maintenance costs from purchase orders (same as executive report)
    filteredPurchaseOrders.forEach(po => {
      const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
      
      // If linked to work order -> get asset from work order
      if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          const asset = assetMap.get(workOrder.asset_id)
          if (asset) {
            asset.maintenance_cost += finalAmount
            
            // Classify by maintenance type
            if (workOrder.type === 'preventive') {
              asset.preventive_cost += finalAmount
            } else {
              asset.corrective_cost += finalAmount
            }
          }
        }
      }
    })

    // Add additional expenses to corrective costs
    ;(additionalExpenses || []).forEach(ae => {
      const asset = assetMap.get(ae.asset_id)
      if (asset) {
        const amount = parseFloat(ae.amount || '0')
        asset.maintenance_cost += amount
        asset.corrective_cost += amount
      }
    })

    // Aggregate sales by asset using name mapping and plant matching
    let salesMatched = 0
    let salesUnmatched = 0
    const unmatchedAssets: Array<{
      asset_name: string
      plant_id: string
      plant_name: string
      concrete_m3: number
      subtotal_amount: number
      remisiones_count: number
      reason: string
    }> = []

    salesRows.forEach((sale: any) => {
      // First map cotizador plant to maintenance plant
      const maintenancePlantId = cotizadorPlantIdToMaintenancePlantId.get(sale.plant_id)
      if (!maintenancePlantId) {
        salesUnmatched++
        const cotizadorPlant = (cotizadorPlants || []).find(p => p.id === sale.plant_id)
        unmatchedAssets.push({
          asset_name: sale.asset_name || 'N/A',
          plant_id: sale.plant_id,
          plant_name: cotizadorPlant?.code || 'Unknown',
          concrete_m3: Number(sale.concrete_m3 || 0),
          subtotal_amount: Number(sale.subtotal_amount || 0),
          remisiones_count: Number(sale.remisiones_count || 0),
          reason: 'Plant not mapped'
        })
        return
      }

      // Try to match asset by name (multiple strategies)
      const assetName = (sale.asset_name || '').toUpperCase()
      let assetId = assetNameToIdMap.get(assetName)
      let matchMethod = 'exact'

      // Strategy 1: Exact mapping from asset_name_mappings or exact code match
      if (!assetId) {
        const matchingAsset = Array.from(assetMap.values()).find(a => 
          a.plant_id === maintenancePlantId && 
          a.asset_code && 
          a.asset_code.toUpperCase() === assetName
        )
        if (matchingAsset) {
          assetId = matchingAsset.id
          matchMethod = 'exact_code'
        }
      }

      // Strategy 2: Fuzzy matching (CR-15 → CR-15-1, CR-24-B → CR-24)
      if (!assetId) {
        const normalizedName = normalizeAssetCode(assetName)
        const candidates = normalizedCodeToAssets.get(normalizedName)
        
        if (candidates && candidates.length > 0) {
          // Prefer assets in the same plant
          const plantMatch = candidates.find(c => c.plant_id === maintenancePlantId)
          const match = plantMatch || candidates[0]
          assetId = match.id
          matchMethod = 'fuzzy'
        }
      }

      if (assetId && assetMap.has(assetId)) {
        const asset = assetMap.get(assetId)
        asset.sales_subtotal += Number(sale.subtotal_amount || 0)
        asset.sales_with_vat += Number(sale.total_amount_with_vat || 0)
        asset.concrete_m3 += Number(sale.concrete_m3 || 0)
        asset.total_m3 += Number(sale.total_m3 || 0)
        asset.remisiones_count += Number(sale.remisiones_count || 0)
        if (matchMethod === 'fuzzy') {
          asset._fuzzy_matches = asset._fuzzy_matches || []
          asset._fuzzy_matches.push(sale.asset_name)
        }
        salesMatched++
      } else {
        // Create virtual unmatched asset
        salesUnmatched++
        const plantInfo = (plants || []).find(p => p.id === maintenancePlantId)
        const virtualAssetId = `unmatched_${sale.asset_name}_${maintenancePlantId}`
        
        if (!assetMap.has(virtualAssetId)) {
          assetMap.set(virtualAssetId, {
            id: virtualAssetId,
            asset_code: sale.asset_name,
            asset_name: `${sale.asset_name} (Sin mapear)`,
            plant_id: maintenancePlantId,
            plant_name: plantInfo?.name || 'Unknown',
            plant_code: plantInfo?.code,
            business_unit_id: plantInfo?.business_unit_id,
            business_unit_name: (businessUnits || []).find(bu => bu.id === plantInfo?.business_unit_id)?.name,
            diesel_liters: 0,
            diesel_cost: 0,
            maintenance_cost: 0,
            preventive_cost: 0,
            corrective_cost: 0,
            sales_subtotal: 0,
            sales_with_vat: 0,
            concrete_m3: 0,
            total_m3: 0,
            remisiones_count: 0,
            _is_unmatched: true
          })
        }
        
        const virtualAsset = assetMap.get(virtualAssetId)
        virtualAsset.sales_subtotal += Number(sale.subtotal_amount || 0)
        virtualAsset.sales_with_vat += Number(sale.total_amount_with_vat || 0)
        virtualAsset.concrete_m3 += Number(sale.concrete_m3 || 0)
        virtualAsset.total_m3 += Number(sale.total_m3 || 0)
        virtualAsset.remisiones_count += Number(sale.remisiones_count || 0)
        
        unmatchedAssets.push({
          asset_name: sale.asset_name || 'N/A',
          plant_id: maintenancePlantId,
          plant_name: plantInfo?.name || 'Unknown',
          concrete_m3: Number(sale.concrete_m3 || 0),
          subtotal_amount: Number(sale.subtotal_amount || 0),
          remisiones_count: Number(sale.remisiones_count || 0),
          reason: 'Asset not found - showing as virtual asset'
        })
      }
    })

    // Aggregate by plant
    const plantMap = new Map<string, any>()
    assetMap.forEach(asset => {
      if (!asset.plant_id) return
      if (!plantMap.has(asset.plant_id)) {
        plantMap.set(asset.plant_id, {
          id: asset.plant_id,
          name: asset.plant_name,
          business_unit_id: asset.business_unit_id,
          business_unit_name: asset.business_unit_name,
          asset_count: 0,
          diesel_liters: 0,
          diesel_cost: 0,
          hours_worked: 0,
          liters_per_hour: 0,
          maintenance_cost: 0,
          preventive_cost: 0,
          corrective_cost: 0,
          sales_subtotal: 0,
          sales_with_vat: 0,
          concrete_m3: 0,
          total_m3: 0
        })
      }
      const plant = plantMap.get(asset.plant_id)
      plant.asset_count++
      plant.diesel_liters += asset.diesel_liters
      plant.diesel_cost += asset.diesel_cost
      plant.hours_worked += asset.hours_worked || 0
      plant.maintenance_cost += asset.maintenance_cost
      plant.preventive_cost += asset.preventive_cost || 0
      plant.corrective_cost += asset.corrective_cost || 0
      plant.sales_subtotal += asset.sales_subtotal
      plant.sales_with_vat += asset.sales_with_vat
      plant.concrete_m3 += asset.concrete_m3
      plant.total_m3 += asset.total_m3
    })

    // Compute plant liters_per_hour
    plantMap.forEach(plant => {
      if ((plant.hours_worked || 0) > 0) {
        plant.liters_per_hour = plant.diesel_liters / plant.hours_worked
      }
    })

    // Aggregate by business unit
    const buMap = new Map<string, any>()
    plantMap.forEach(plant => {
      if (!plant.business_unit_id) return
      if (!buMap.has(plant.business_unit_id)) {
        buMap.set(plant.business_unit_id, {
          id: plant.business_unit_id,
          name: plant.business_unit_name,
          asset_count: 0,
          diesel_liters: 0,
          diesel_cost: 0,
          hours_worked: 0,
          liters_per_hour: 0,
          maintenance_cost: 0,
          preventive_cost: 0,
          corrective_cost: 0,
          sales_subtotal: 0,
          sales_with_vat: 0,
          concrete_m3: 0,
          total_m3: 0
        })
      }
      const bu = buMap.get(plant.business_unit_id)
      bu.asset_count += plant.asset_count
      bu.diesel_liters += plant.diesel_liters
      bu.diesel_cost += plant.diesel_cost
      bu.hours_worked += plant.hours_worked || 0
      bu.maintenance_cost += plant.maintenance_cost
      bu.preventive_cost += plant.preventive_cost
      bu.corrective_cost += plant.corrective_cost
      bu.sales_subtotal += plant.sales_subtotal
      bu.sales_with_vat += plant.sales_with_vat
      bu.concrete_m3 += plant.concrete_m3
      bu.total_m3 += plant.total_m3
    })

    // Compute BU liters_per_hour
    buMap.forEach(bu => {
      if ((bu.hours_worked || 0) > 0) {
        bu.liters_per_hour = bu.diesel_liters / bu.hours_worked
      }
    })

    // Calculate summary
    const totalSales = Array.from(buMap.values()).reduce((s, bu) => s + bu.sales_subtotal, 0)
    const totalSalesWithVat = Array.from(buMap.values()).reduce((s, bu) => s + bu.sales_with_vat, 0)
    const totalDieselCost = Array.from(buMap.values()).reduce((s, bu) => s + bu.diesel_cost, 0)
    const totalMaintenanceCost = Array.from(buMap.values()).reduce((s, bu) => s + bu.maintenance_cost, 0)
    const totalPreventiveCost = Array.from(buMap.values()).reduce((s, bu) => s + bu.preventive_cost, 0)
    const totalCorrectiveCost = Array.from(buMap.values()).reduce((s, bu) => s + bu.corrective_cost, 0)
    const totalConcreteM3 = Array.from(buMap.values()).reduce((s, bu) => s + bu.concrete_m3, 0)
    const totalRemisiones = Array.from(assetMap.values()).reduce((s, a: any) => s + (a.remisiones_count || 0), 0)
    const totalDieselL = Array.from(buMap.values()).reduce((s, bu) => s + bu.diesel_liters, 0)
    const totalHours = Array.from(buMap.values()).reduce((s, bu) => s + (bu.hours_worked || 0), 0)
    const totalCost = totalDieselCost + totalMaintenanceCost
    const costRevenueRatio = totalSales > 0 ? (totalCost / totalSales) * 100 : 0

    // Group unmatched assets by name for easier analysis
    const unmatchedSummary = unmatchedAssets.reduce((acc, item) => {
      if (!acc[item.asset_name]) {
        acc[item.asset_name] = {
          asset_name: item.asset_name,
          total_concrete_m3: 0,
          total_sales: 0,
          total_remisiones: 0,
          plants: new Set<string>(),
          reason: item.reason
        }
      }
      acc[item.asset_name].total_concrete_m3 += item.concrete_m3
      acc[item.asset_name].total_sales += item.subtotal_amount
      acc[item.asset_name].total_remisiones += item.remisiones_count
      acc[item.asset_name].plants.add(item.plant_name)
      return acc
    }, {} as Record<string, any>)

    const unmatchedList = Object.values(unmatchedSummary).map(item => ({
      ...item,
      plants: Array.from(item.plants)
    })).sort((a, b) => b.total_sales - a.total_sales)

    console.log('Gerencial Report Summary:', {
      totalAssets: assets.length,
      totalBusinessUnits: buMap.size,
      totalPlants: plantMap.size,
      totalSales,
      totalDieselCost,
      totalMaintenanceCost,
      totalPreventiveCost,
      totalCorrectiveCost,
      dieselTxCount: (dieselTxs || []).length,
      purchaseOrdersCount: filteredPurchaseOrders.length,
      additionalExpensesCount: (additionalExpenses || []).length,
      salesRowsCount: salesRows.length,
      salesMatched,
      salesUnmatched,
      plantMappings: cotizadorPlantIdToMaintenancePlantId.size,
      unmatchedAssetNames: unmatchedList.length
    })

    if (unmatchedList.length > 0) {
      console.log('\n=== UNMATCHED ASSETS (Top 10) ===')
      unmatchedList.slice(0, 10).forEach(item => {
        console.log(`  ${item.asset_name}:`)
        console.log(`    Sales: $${item.total_sales.toLocaleString()}`)
        console.log(`    Concrete: ${item.total_concrete_m3.toFixed(1)} m³`)
        console.log(`    Remisiones: ${item.total_remisiones}`)
        console.log(`    Plants: ${item.plants.join(', ')}`)
        console.log(`    Reason: ${item.reason}`)
      })
      console.log('=================================\n')
    }

    // Build assets array for response; optionally hide zero-activity assets
    const assetsArrayAll = Array.from(assetMap.values())
    const assetsArray = hideZeroActivity
      ? assetsArrayAll.filter((a: any) => (a.hours_worked || 0) > 0 || (a.diesel_liters || 0) > 0)
      : assetsArrayAll

    return NextResponse.json({
      summary: {
        totalSales,
        totalSalesWithVat,
        totalDieselCost,
        totalMaintenanceCost,
        totalPreventiveCost,
        totalCorrectiveCost,
        totalConcreteM3,
        totalDieselL,
        totalRemisiones,
        costRevenueRatio
      },
      businessUnits: Array.from(buMap.values()),
      plants: Array.from(plantMap.values()),
      assets: assetsArray,
      filters: {
        businessUnits: businessUnits || [],
        plants: plants || []
      },
      debug: {
        salesMatched,
        salesUnmatched,
        unmatchedAssets: unmatchedList
      }
    })
  } catch (e: any) {
    console.error('Gerencial report error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
