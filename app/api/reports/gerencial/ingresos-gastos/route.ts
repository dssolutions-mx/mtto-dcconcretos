import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

type Body = {
  month: string // YYYY-MM format
  businessUnitId?: string | null
  plantId?: string | null
}

/**
 * Calculate diesel costs using FIFO with weighted average fallback
 * Only entries from last 2 months typically have prices assigned
 */
async function calculateDieselCostsFIFO_IngresosGastos(
  supabase: any,
  dateFromStr: string,
  dateToStr: string,
  plantCodes: string[],
  priceByProduct: Map<string, number>
): Promise<Map<string, number>> {
  // Extend window to 3 months back to ensure we capture entries that might still be in inventory
  // This ensures FIFO can work properly even if entries occurred before the period
  const fifoStartDate = new Date(dateFromStr)
  fifoStartDate.setMonth(fifoStartDate.getMonth() - 3) // 3 months back for proper FIFO inventory tracking
  fifoStartDate.setHours(0, 0, 0, 0) // Start of day
  
  // Ensure end date includes full day (23:59:59.999)
  const dateToEnd = new Date(dateToStr)
  dateToEnd.setHours(23, 59, 59, 999) // End of day
  
  // Use full ISO strings for proper timestamptz comparison
  const fifoStartDateISO = fifoStartDate.toISOString()
  const dateToEndISO = dateToEnd.toISOString()
  
  // Get warehouse IDs for target plants
  const { data: warehouses, error: warehousesError } = await supabase
    .from('diesel_warehouses')
    .select('id, plant_id, plants(code)')
  
  if (warehousesError) {
    console.error('[FIFO] Error fetching warehouses:', warehousesError)
  }
  
  const warehouseToPlantCode = new Map<string, string>()
  const targetWarehouseIds: string[] = []
  ;(warehouses || []).forEach((wh: any) => {
    const code = (wh.plants as any)?.code
    if (code && plantCodes.includes(code)) {
      warehouseToPlantCode.set(wh.id, code)
      targetWarehouseIds.push(wh.id)
    }
  })

  // Early return if no warehouses found
  if (targetWarehouseIds.length === 0) {
    console.warn('[FIFO] No warehouses found for plant codes:', plantCodes)
    return new Map<string, number>()
  }

  // STEP 1: Fetch entries from last 45 days (when prices were added) to build FIFO inventory
  // FLEXIBLE APPROACH: We need entries from before AND during the period to build accurate inventory
  // However, only entries from last 45 days have prices, so we limit to that window
  const entriesStartDate = new Date(dateFromStr)
  entriesStartDate.setDate(entriesStartDate.getDate() - 45) // 45 days back (when prices were added)
  entriesStartDate.setHours(0, 0, 0, 0)
  const entriesStartDateISO = entriesStartDate.toISOString()
  
  const { data: allEntries, error: entriesError } = await supabase
    .from('diesel_transactions')
    .select(`
      id, 
      warehouse_id, 
      product_id, 
      quantity_liters, 
      unit_cost, 
      transaction_date
    `)
    .eq('transaction_type', 'entry')
    .gte('transaction_date', entriesStartDateISO)
    .lte('transaction_date', dateToEndISO)
    .in('warehouse_id', targetWarehouseIds)
    .not('unit_cost', 'is', null)
    .gt('unit_cost', 0)
    .order('transaction_date', { ascending: true })

  if (entriesError) {
    console.error('[FIFO] Error fetching entries:', entriesError)
  }

  const entriesWithPrice = (allEntries || []).filter(tx => tx.unit_cost && Number(tx.unit_cost) > 0)

  // STEP 2: Fetch consumptions - FLEXIBLE for calculation, STRICT for cost counting
  // We fetch consumptions from the SAME date range as entries to ensure proper FIFO processing
  // All consumptions after entries start must be processed to maintain accurate inventory state
  // Use UTC explicitly to avoid timezone issues
  const reportStartDateISO = `${dateFromStr}T00:00:00.000Z` // Oct 1 00:00:00 UTC
  const reportEndDateISO = `${dateToStr}T23:59:59.999Z` // Oct 31 23:59:59 UTC
  
  // CRITICAL: Fetch consumptions from the SAME start date as entries (45 days back)
  // This ensures consumptions can properly consume from entries in chronological order
  // Example: Sep 8 entry must be consumed by Sep 8+ consumptions, not left unused
  const consumptionQueryStart = new Date(dateFromStr)
  consumptionQueryStart.setDate(consumptionQueryStart.getDate() - 45) // Same as entries: 45 days back
  consumptionQueryStart.setHours(0, 0, 0, 0)
  const consumptionQueryStartISO = consumptionQueryStart.toISOString()
  
  const { data: allConsumptions, error: consumptionsError } = await supabase
    .from('diesel_transactions')
    .select(`
      id, 
      warehouse_id, 
      product_id, 
      quantity_liters, 
      transaction_date
    `)
    .eq('transaction_type', 'consumption')
    .gte('transaction_date', consumptionQueryStartISO) // FLEXIBLE: Include some before period for context
    .lte('transaction_date', reportEndDateISO)
    .in('warehouse_id', targetWarehouseIds)
    .order('transaction_date', { ascending: true })

  if (consumptionsError) {
    console.error('[FIFO] Error fetching consumptions:', consumptionsError)
  }

  const allConsumptionsFetched = allConsumptions || []
  
  // Helper function to convert UTC timestamp to GMT-6 (local timezone) and extract date
  const getLocalDateStr = (utcTimestamp: string): string => {
    // transaction_date is in UTC, convert to GMT-6 (UTC-6)
    const utcDate = new Date(utcTimestamp)
    // GMT-6 means subtract 6 hours from UTC
    // Example: 2025-10-02 23:31:00+00 UTC → 2025-10-02 17:31:00 GMT-6
    const localTimeMs = utcDate.getTime() - (6 * 60 * 60 * 1000)
    const localDate = new Date(localTimeMs)
    // Extract YYYY-MM-DD from the adjusted time using UTC methods
    // (since we've already adjusted the time, UTC methods give us the GMT-6 date)
    const year = localDate.getUTCFullYear()
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
    const day = String(localDate.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // STRICTLY filter consumptions to only those in the report period for counting
  // CRITICAL: Use transaction_date (NOT created_at) - transaction_date is when the consumption occurred
  // IMPORTANT: Convert UTC to GMT-6 before comparing dates
  const consumptionsInPeriod = allConsumptionsFetched.filter(cons => {
    // Ensure we're using transaction_date, not created_at
    if (!cons.transaction_date) {
      console.warn('[FIFO] Warning: Consumption missing transaction_date:', cons.id)
      return false
    }
    const consDateStr = getLocalDateStr(cons.transaction_date) // Convert UTC to GMT-6 and extract date
    return consDateStr >= dateFromStr && consDateStr <= dateToStr
  })


  // STEP 3: Process entries and consumptions chronologically together for proper FIFO
  // This ensures entries during the period add to inventory, and consumptions use oldest inventory first
  const consumptionCosts = new Map<string, number>() // warehouse_id -> total cost
  const plantDieselCosts = new Map<string, number>() // plant_code -> total cost

  // Group transactions by warehouse, then process chronologically
  const transactionsByWarehouse = new Map<string, Array<{
    type: 'entry' | 'consumption'
    date: string
    liters: number
    unitCost?: number
    productId?: string
  }>>()

  // Add entries - log details for debugging
  const entriesByWarehouse = new Map<string, number>()
  entriesWithPrice.forEach(entry => {
    const whId = entry.warehouse_id
    if (!whId || !warehouseToPlantCode.has(whId)) return
    
    if (!transactionsByWarehouse.has(whId)) {
      transactionsByWarehouse.set(whId, [])
    }
    
    entriesByWarehouse.set(whId, (entriesByWarehouse.get(whId) || 0) + 1)
    
    transactionsByWarehouse.get(whId)!.push({
      type: 'entry',
      date: entry.transaction_date,
      liters: Number(entry.quantity_liters || 0),
      unitCost: Number(entry.unit_cost || 0),
      productId: entry.product_id
    })
  })
  

  // Add consumptions - use ALL fetched consumptions for processing (to maintain inventory state)
  // But we'll STRICTLY filter costs to only October consumptions later
  allConsumptionsFetched.forEach(consumption => {
    const whId = consumption.warehouse_id
    if (!whId || !warehouseToPlantCode.has(whId)) return
    
    if (!transactionsByWarehouse.has(whId)) {
      transactionsByWarehouse.set(whId, [])
    }
    
    transactionsByWarehouse.get(whId)!.push({
      type: 'consumption',
      date: consumption.transaction_date,
      liters: Number(consumption.quantity_liters || 0),
      productId: consumption.product_id
    })
  })

  // Calculate weighted average price per warehouse for fallback (from all entries)
  const warehouseWeightedAvg = new Map<string, number>()
  transactionsByWarehouse.forEach((transactions, warehouseId) => {
    const entries = transactions.filter(t => t.type === 'entry' && t.unitCost && t.unitCost > 0)
    if (entries.length > 0) {
      const totalLiters = entries.reduce((sum, e) => sum + e.liters, 0)
      const totalCost = entries.reduce((sum, e) => sum + (e.liters * (e.unitCost || 0)), 0)
      if (totalLiters > 0) {
        warehouseWeightedAvg.set(warehouseId, totalCost / totalLiters)
      }
    }
  })

  transactionsByWarehouse.forEach((transactions, warehouseId) => {
    const plantCode = warehouseToPlantCode.get(warehouseId) || 'UNKNOWN'
    
    // Sort all transactions chronologically
    // CRITICAL: For identical timestamps, entries MUST come before consumptions
    // so that inventory is available when consumptions are processed
    transactions.sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (timeDiff !== 0) return timeDiff
      // Same timestamp: entries first (type 'entry' < 'consumption' alphabetically)
      if (a.type === 'entry' && b.type === 'consumption') return -1
      if (a.type === 'consumption' && b.type === 'entry') return 1
      return 0
    })
    
    // FIFO inventory: array of lots (oldest first)
    const inventoryLots: Array<{ liters: number, unitCost: number, date: string }> = []
    let totalConsumptionCost = 0

    // Process each transaction in chronological order
    transactions.forEach((tx) => {
      if (tx.type === 'entry') {
        // Add entry to inventory (add to end, but we'll maintain chronological order)
        if (tx.liters > 0 && tx.unitCost && tx.unitCost > 0) {
          inventoryLots.push({
            liters: tx.liters,
            unitCost: tx.unitCost,
            date: tx.date
          })
          // Keep inventory sorted by date (oldest first for FIFO)
          inventoryLots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        }
      } else if (tx.type === 'consumption') {
        // FLEXIBLE: Process ALL consumptions chronologically to maintain accurate inventory state
        // STRICT: Only count costs for consumptions within the report period
        // Convert UTC to GMT-6 for date comparison
        const txDateStr = getLocalDateStr(tx.date)
        const isInPeriod = txDateStr >= dateFromStr && txDateStr <= dateToStr
        
        let remainingLiters = tx.liters
        let consumptionCost = 0

        // FLEXIBLE: Process consumption to maintain inventory state (even if outside period)
        // Consume from oldest inventory lots first (FIFO)
        // Only use lots that existed before this consumption
        let lotIndex = 0
        while (remainingLiters > 0 && lotIndex < inventoryLots.length) {
          const lot = inventoryLots[lotIndex]
          
          // Only use lots that existed before this consumption
          if (lot.date > tx.date) {
            lotIndex++
            continue
          }
          
          // Skip fully consumed lots
          if (lot.liters <= 0.01) {
            lotIndex++
            continue
          }
          
          const consumeFromLot = Math.min(remainingLiters, lot.liters)
          const cost = consumeFromLot * lot.unitCost
          consumptionCost += cost
          remainingLiters -= consumeFromLot
          lot.liters -= consumeFromLot

          // If lot is fully consumed, remove it
          if (lot.liters <= 0.01) {
            inventoryLots.splice(lotIndex, 1)
            // Don't increment lotIndex since we removed the current element
          } else {
            // Lot partially consumed, move to next lot
            lotIndex++
          }
        }

        // Fallback: If remaining liters and no priced lots available
        // This should ONLY happen if FIFO lots are exhausted and we still have liters to price
        if (remainingLiters > 0) {
          const weightedAvgPrice = warehouseWeightedAvg.get(warehouseId) || 0
          if (weightedAvgPrice > 0) {
            const fallbackCost = remainingLiters * weightedAvgPrice
            consumptionCost += fallbackCost
          } else {
            // Last resort: product default price
            const fallbackPrice = tx.productId ? (priceByProduct.get(tx.productId) || 0) : 0
            if (fallbackPrice > 0) {
              const fallbackCost = remainingLiters * fallbackPrice
              consumptionCost += fallbackCost
            } else if (remainingLiters > 0.01) {
              // No price available at all - log error for troubleshooting
              console.error(`[FIFO] ${plantCode}: ${remainingLiters.toFixed(2)}L could not be priced - no FIFO lots, no weighted avg, no product price`)
            }
          }
        }

        // STRICT: Only count costs for consumptions within the report period
        // This ensures accurate monthly reporting while maintaining proper FIFO inventory state
        if (isInPeriod) {
          totalConsumptionCost += consumptionCost
        }
      }
    })

    consumptionCosts.set(warehouseId, totalConsumptionCost)
  })

  // Aggregate costs by plant code
  consumptionCosts.forEach((cost, warehouseId) => {
    const plantCode = warehouseToPlantCode.get(warehouseId)
    if (!plantCode) {
      console.warn(`[FIFO] Warehouse ${warehouseId} has no plant code mapping`)
      return
    }
    
    if (!plantDieselCosts.has(plantCode)) {
      plantDieselCosts.set(plantCode, 0)
    }
    plantDieselCosts.set(plantCode, plantDieselCosts.get(plantCode)! + cost)
  })

  return plantDieselCosts
}

export async function POST(req: NextRequest) {
  try {
    const { month, businessUnitId, plantId } = (await req.json()) as Body

    // Convert month to date range (full month)
    const [year, monthNum] = month.split('-').map(Number)
    const dateFrom = new Date(year, monthNum - 1, 1)
    const dateTo = new Date(year, monthNum, 0) // Last day of month
    const dateFromStr = dateFrom.toISOString().slice(0, 10)
    const dateToStr = dateTo.toISOString().slice(0, 10)
    // minimal

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

    // Filter plants if specific plant requested
    const targetPlants = plantId 
      ? (plants || []).filter(p => p.id === plantId)
      : businessUnitId
        ? (plants || []).filter(p => p.business_unit_id === businessUnitId)
        : plants || []

    if (targetPlants.length === 0) {
      return NextResponse.json({
        error: 'No plants found for the selected filters',
        plants: []
      })
    }

    // Fetch vw_plant_financial_analysis_unified for the month from COTIZADOR project
    const periodMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`

    const cotizadorSupabase = createClient(
      process.env.COTIZADOR_SUPABASE_URL!,
      process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    let viewData: any[] | null = null
    try {
      const { data: viewRows, error: viewError } = await cotizadorSupabase
        .from('vw_plant_financial_analysis_unified')
        .select('*')
        .eq('period_start', periodMonth)

      if (viewError) {
        console.error('View fetch error (cotizador):', viewError)
      }
      viewData = viewRows || []
    } catch (err) {
      console.error('Error querying vw_plant_financial_analysis_unified from cotizador:', err)
      viewData = []
    }

    // Build view data map by plant code (the view uses plant codes)
    const viewDataByPlantCode = new Map<string, any>()
    ;(viewData || []).forEach(row => {
      if (row.plant_code) {
        viewDataByPlantCode.set(row.plant_code, row)
      }
    })

    // Fetch bombeo data from vw_pumping_analysis_unified for the month
    // The view has daily data (period_start = period_end for each day)
    // We need to filter by date range and aggregate by plant_code
    const plantCodes = targetPlants.map(p => p.code).filter(Boolean)
    let pumpingData: any[] | null = null
    
    if (plantCodes.length > 0) {
      try {
        // Filter by date range (all days in the month) and selected plant codes
        const { data: pumpingRows, error: pumpingError } = await cotizadorSupabase
          .from('vw_pumping_analysis_unified')
          .select('plant_code, volumen_bombeo_m3, subtotal_total')
          .gte('period_start', dateFromStr)
          .lte('period_start', dateToStr)
          .in('plant_code', plantCodes)

        if (pumpingError) {
          console.error('Pumping view fetch error (cotizador):', pumpingError)
        }
        pumpingData = pumpingRows || []
      } catch (err) {
        console.error('Error querying vw_pumping_analysis_unified from cotizador:', err)
        pumpingData = []
      }
    } else {
      pumpingData = []
    }

    // Aggregate pumping data by plant_code (sum volumes and revenues for monthly totals)
    // This handles daily data correctly by summing all days in the month
    const pumpingDataByPlantCode = new Map<string, { volumen_bombeo_m3: number, subtotal_total: number }>()
    ;(pumpingData || []).forEach(row => {
      if (row.plant_code && plantCodes.includes(row.plant_code)) {
        const existing = pumpingDataByPlantCode.get(row.plant_code) || { volumen_bombeo_m3: 0, subtotal_total: 0 }
        pumpingDataByPlantCode.set(row.plant_code, {
          volumen_bombeo_m3: existing.volumen_bombeo_m3 + Number(row.volumen_bombeo_m3 || 0),
          subtotal_total: existing.subtotal_total + Number(row.subtotal_total || 0)
        })
      }
    })

    // Fetch diesel and maintenance costs using existing gerencial logic
    // We'll call the gerencial API internally and extract plant-level data
    const host = req.headers.get('host') || ''
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    
    // For internal server-to-server calls, always use the actual request host/port
    // This prevents port mismatches (e.g., server on 3001 but env says 3000)
    let base: string
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      // Extract port from host (e.g., "localhost:3001" -> "3001")
      const port = host.split(':')[1] || '3000'
      // Use 127.0.0.1 for more reliable server-to-server calls in local development
      base = `http://127.0.0.1:${port}`
    } else {
      // Production: use host from request
      base = `https://${host}`
    }
    
    // Warn if env base URL doesn't match actual host (common in local dev)
    if (envBaseUrl && envBaseUrl !== base) {
      console.warn('[Ingresos Gastos Report] Base URL mismatch detected:', {
        envBaseUrl,
        actualBaseUrl: base,
        host,
        note: 'Using actual host for internal API calls'
      })
    }
    
    const gerencialApiUrl = `${base}/api/reports/gerencial`
    const gerencialRequestPayload = {
      dateFrom: dateFromStr,
      dateTo: dateToStr,
      businessUnitId,
      plantId,
      hideZeroActivity: false
    }
    
    console.log('[Ingresos Gastos Report] Fetching gerencial data:', {
      url: gerencialApiUrl,
      payload: gerencialRequestPayload
    })
    
    let gerencialData: any = null
    try {
      const gerencialResp = await fetch(gerencialApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gerencialRequestPayload)
      })
      
      if (!gerencialResp.ok) {
        const errorText = await gerencialResp.text()
        let errorJson: any = null
        try {
          errorJson = JSON.parse(errorText)
        } catch {
          // Not JSON, use text as-is
        }
        
        console.error('[Ingresos Gastos Report] Gerencial API fetch failed:', {
          status: gerencialResp.status,
          statusText: gerencialResp.statusText,
          url: gerencialApiUrl,
          errorBody: errorJson || errorText
        })
        
        gerencialData = null
      } else {
        try {
          gerencialData = await gerencialResp.json()
          console.log('[Ingresos Gastos Report] Gerencial data fetched successfully:', {
            hasData: !!gerencialData,
            businessUnitsCount: gerencialData?.businessUnits?.length || 0,
            plantsCount: gerencialData?.plants?.length || 0
          })
        } catch (parseError: any) {
          console.error('[Ingresos Gastos Report] Failed to parse gerencial API response:', {
            error: parseError?.message,
            status: gerencialResp.status,
            url: gerencialApiUrl
          })
          gerencialData = null
        }
      }
    } catch (fetchError: any) {
      console.error('[Ingresos Gastos Report] Gerencial API fetch exception:', {
        error: fetchError?.message,
        stack: fetchError?.stack,
        url: gerencialApiUrl,
        baseUrl: base,
        host: host
      })
      gerencialData = null
    }

    // Calculate diesel costs using FIFO (primary method)
    // Get product prices for fallback when entries lack prices
    const { data: products } = await supabase
      .from('diesel_products')
      .select('id, price_per_liter')
    const priceByProduct = new Map<string, number>()
    ;(products || []).forEach(p => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

    // Calculate FIFO diesel costs for all target plants
    // Reuse plantCodes already defined above for bombeo query
    const fifoDieselCosts = await calculateDieselCostsFIFO_IngresosGastos(
      supabase,
      dateFromStr,
      dateToStr,
      plantCodes,
      priceByProduct
    )
    // console.log('[Ingresos-Gastos] FIFO results:', Object.fromEntries(fifoDieselCosts))

    // Map gerencial plant data by plant CODE for maintenance costs (diesel comes from FIFO)
    const gerencialPlantMapByCode = new Map<string, any>()
    ;(gerencialData?.plants || []).forEach((plant: any) => {
      // Find plant code from plants list to match with view
      const matchingPlant = (plants || []).find(p => p.id === plant.id)
      if (matchingPlant?.code) {
        gerencialPlantMapByCode.set(matchingPlant.code, {
          maintenance_cost: plant.maintenance_cost || 0
        })
      }
    })

    // Aggregate maintenance costs by plant CODE from assets (if plant summary missing)
    const maintenanceByCode = new Map<string, number>()
    ;(gerencialData?.assets || []).forEach((asset: any) => {
      const pcode = asset.plant_code
      if (!pcode) return
      
      const mantto = Number(asset.maintenance_cost || 0)
      if (!maintenanceByCode.has(pcode)) {
        maintenanceByCode.set(pcode, 0)
      }
      maintenanceByCode.set(pcode, maintenanceByCode.get(pcode)! + mantto)
    })

    // Combine FIFO diesel + maintenance costs by plant code
    const dieselManttoByCode = new Map<string, { diesel_cost: number, maintenance_cost: number }>()
    
    // Add FIFO diesel costs
    fifoDieselCosts.forEach((dieselCost, plantCode) => {
      if (!dieselManttoByCode.has(plantCode)) {
        dieselManttoByCode.set(plantCode, { diesel_cost: 0, maintenance_cost: 0 })
      }
      dieselManttoByCode.get(plantCode)!.diesel_cost = dieselCost
      // minimal
    })
    
    // Initialize all plants from view data with zero costs if not already set
    viewDataByPlantCode.forEach((viewRow, plantCode) => {
      if (!dieselManttoByCode.has(plantCode)) {
        dieselManttoByCode.set(plantCode, { diesel_cost: 0, maintenance_cost: 0 })
      }
    })

    // Add maintenance costs (from gerencial plant summary or asset aggregation)
    gerencialPlantMapByCode.forEach((plant, plantCode) => {
      if (!dieselManttoByCode.has(plantCode)) {
        dieselManttoByCode.set(plantCode, { diesel_cost: 0, maintenance_cost: 0 })
      }
      dieselManttoByCode.get(plantCode)!.maintenance_cost = plant.maintenance_cost || 0
    })

    maintenanceByCode.forEach((manttoCost, plantCode) => {
      if (!dieselManttoByCode.has(plantCode)) {
        dieselManttoByCode.set(plantCode, { diesel_cost: 0, maintenance_cost: 0 })
      }
      // Only use if not already set from plant summary
      if (dieselManttoByCode.get(plantCode)!.maintenance_cost === 0) {
        dieselManttoByCode.get(plantCode)!.maintenance_cost = manttoCost
      }
    })

    // Deep fallback for maintenance: If gerencialData doesn't have maintenance, query directly
    // Diesel is already calculated via FIFO above, so we only need maintenance here
    const missingMaintenancePlants = plantCodes.filter(code => 
      !dieselManttoByCode.has(code) || dieselManttoByCode.get(code)!.maintenance_cost === 0
    )
    
    if (missingMaintenancePlants.length > 0 && gerencialData == null) {
      // Build assets list with plant mapping
      const { data: assetsDirect } = await supabase
        .from('assets')
        .select('id, plant_id, plants(code)')
      const assetIds: string[] = (assetsDirect || []).map(a => a.id)

      // Purchase orders + work orders for maintenance
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('id, total_amount, actual_amount, created_at, posting_date, purchase_date, work_order_id, status')
        .neq('status', 'pending_approval')
      const workOrderIds = (purchaseOrders || []).map(po => po.work_order_id).filter(Boolean)
      const { data: workOrders } = workOrderIds.length > 0 ? await supabase
        .from('work_orders')
        .select('id, asset_id, completed_at, planned_date, created_at, assets(plant_id, plants(code))')
        .in('id', workOrderIds) : { data: [] as any[] }
      const woById = new Map<string, any>((workOrders || []).map(w => [w.id, w]))

      // Aggregate maintenance by plant code
      const plantManttoFallback = new Map<string, number>()
      
      ;(purchaseOrders || []).forEach(po => {
        let dateToCheckStr: string
        
        // Priority: purchase_date → work_order.completed_at → work_order.planned_date → work_order.created_at
        if (po.purchase_date) {
          dateToCheckStr = po.purchase_date
        } else if (po.work_order_id) {
          const wo = woById.get(po.work_order_id)
          if (wo?.completed_at) {
            dateToCheckStr = wo.completed_at
          } else if (wo?.planned_date) {
            dateToCheckStr = wo.planned_date
          } else if (wo?.created_at) {
            dateToCheckStr = wo.created_at
          } else {
            dateToCheckStr = po.created_at
          }
        } else {
          dateToCheckStr = po.created_at
        }
        
        const ts = new Date(dateToCheckStr).getTime()
        if (ts < new Date(dateFromStr).getTime() || ts > new Date(dateToStr).getTime()) return
        const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
        const wo = po.work_order_id ? woById.get(po.work_order_id) : null
        const plantCode = (wo as any)?.assets?.plants?.code
        if (!plantCode || !missingMaintenancePlants.includes(plantCode)) return
        
        if (!plantManttoFallback.has(plantCode)) {
          plantManttoFallback.set(plantCode, 0)
        }
        plantManttoFallback.set(plantCode, plantManttoFallback.get(plantCode)! + finalAmount)
      })

      // Merge maintenance fallback
      plantManttoFallback.forEach((manttoCost, plantCode) => {
        if (!dieselManttoByCode.has(plantCode)) {
          dieselManttoByCode.set(plantCode, { diesel_cost: 0, maintenance_cost: 0 })
        }
        if (dieselManttoByCode.get(plantCode)!.maintenance_cost === 0) {
          dieselManttoByCode.get(plantCode)!.maintenance_cost = manttoCost
        }
      })
    }

    // Fetch manual financial adjustments for the period
    // Include both direct assignments and distributed entries
    const { data: manualAdjustments } = await supabase
      .from('manual_financial_adjustments')
      .select(`
        *,
        distributions:manual_financial_adjustment_distributions(
          id,
          plant_id,
          business_unit_id,
          department,
          amount
        )
      `)
      .eq('period_month', periodMonth)

    // Aggregate manual adjustments by plant CODE (to match with view and gerencial data)
    const manualByPlantCode = new Map<string, { nomina: number, otros_indirectos: number }>()
    const targetPlantIds = targetPlants.map(p => p.id)
    const targetPlantCodes = targetPlants.map(p => p.code).filter(Boolean) as string[]
    
    // Build plant code to BU mapping
    const plantCodeToBU = new Map<string, string>()
    ;(plants || []).forEach(p => {
      if (p.code && p.business_unit_id) {
        plantCodeToBU.set(p.code, p.business_unit_id)
      }
    })

    // Build department to plant mapping from profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('departamento, plant_id')
      .not('departamento', 'is', null)
      .not('plant_id', 'is', null)
    
    const departmentToPlants = new Map<string, string[]>()
    ;(profilesData || []).forEach(profile => {
      if (profile.departamento && profile.plant_id) {
        if (!departmentToPlants.has(profile.departamento)) {
          departmentToPlants.set(profile.departamento, [])
        }
        if (!departmentToPlants.get(profile.departamento)!.includes(profile.plant_id)) {
          departmentToPlants.get(profile.departamento)!.push(profile.plant_id)
        }
      }
    })

    ;(manualAdjustments || []).forEach(adj => {
      const category = adj.category
      const amount = Number(adj.amount || 0)

      // Handle direct plant assignments
      if (adj.plant_id && targetPlantIds.includes(adj.plant_id)) {
        const matchingPlant = (plants || []).find(p => p.id === adj.plant_id)
        if (matchingPlant?.code) {
          if (!manualByPlantCode.has(matchingPlant.code)) {
            manualByPlantCode.set(matchingPlant.code, { nomina: 0, otros_indirectos: 0 })
          }
          const entry = manualByPlantCode.get(matchingPlant.code)!
          if (category === 'nomina') {
            entry.nomina += amount
          } else if (category === 'otros_indirectos') {
            entry.otros_indirectos += amount
          }
        }
      }

      // Handle distributed entries
      if (adj.is_distributed && adj.distributions && Array.isArray(adj.distributions)) {
        adj.distributions.forEach((dist: any) => {
          const distAmount = Number(dist.amount || 0)
          
          // Direct plant distribution
          if (dist.plant_id && targetPlantIds.includes(dist.plant_id)) {
            const matchingPlant = (plants || []).find(p => p.id === dist.plant_id)
            if (matchingPlant?.code) {
              if (!manualByPlantCode.has(matchingPlant.code)) {
                manualByPlantCode.set(matchingPlant.code, { nomina: 0, otros_indirectos: 0 })
              }
              const entry = manualByPlantCode.get(matchingPlant.code)!
              if (category === 'nomina') {
                entry.nomina += distAmount
              } else if (category === 'otros_indirectos') {
                entry.otros_indirectos += distAmount
              }
            }
          }
          
          // Business unit distribution - distribute to all plants in the BU
          if (dist.business_unit_id) {
            const buPlants = (plants || []).filter(p => 
              p.business_unit_id === dist.business_unit_id && targetPlantIds.includes(p.id)
            )
            if (buPlants.length > 0) {
              // Distribute equally among plants in the BU
              const amountPerPlant = distAmount / buPlants.length
              buPlants.forEach(plant => {
                if (plant.code) {
                  if (!manualByPlantCode.has(plant.code)) {
                    manualByPlantCode.set(plant.code, { nomina: 0, otros_indirectos: 0 })
                  }
                  const entry = manualByPlantCode.get(plant.code)!
                  if (category === 'nomina') {
                    entry.nomina += amountPerPlant
                  } else if (category === 'otros_indirectos') {
                    entry.otros_indirectos += amountPerPlant
                  }
                }
              })
            }
          }
          
          // Department distribution - distribute to plants where that department exists
          if (dist.department) {
            const departmentPlants = departmentToPlants.get(dist.department) || []
            const targetDepartmentPlants = departmentPlants.filter(pid => targetPlantIds.includes(pid))
            if (targetDepartmentPlants.length > 0) {
              // Distribute equally among plants with that department
              const amountPerPlant = distAmount / targetDepartmentPlants.length
              targetDepartmentPlants.forEach(plantId => {
                const matchingPlant = (plants || []).find(p => p.id === plantId)
                if (matchingPlant?.code) {
                  if (!manualByPlantCode.has(matchingPlant.code)) {
                    manualByPlantCode.set(matchingPlant.code, { nomina: 0, otros_indirectos: 0 })
                  }
                  const entry = manualByPlantCode.get(matchingPlant.code)!
                  if (category === 'nomina') {
                    entry.nomina += amountPerPlant
                  } else if (category === 'otros_indirectos') {
                    entry.otros_indirectos += amountPerPlant
                  }
                }
              })
            }
          }
        })
      }
    })

    // Log summary of diesel costs before building response
    // minimal summary only when needed

    // Build unified plant data - match everything by plant CODE since view uses codes
    const plantData = targetPlants.map(plant => {
      const viewRow = viewDataByPlantCode.get(plant.code)
      
      // Get diesel/maintenance from gerencial data - prefer plant summary, fallback to asset aggregation
      let gerencialPlant = gerencialPlantMapByCode.get(plant.code)
      if (!gerencialPlant && dieselManttoByCode.has(plant.code)) {
        const agg = dieselManttoByCode.get(plant.code)!
        gerencialPlant = { diesel_cost: agg.diesel_cost, maintenance_cost: agg.maintenance_cost }
      }
      
      const manual = manualByPlantCode.get(plant.code) || { nomina: 0, otros_indirectos: 0 }

      // From view: Ingresos and MP data
      const volumen_concreto = Number(viewRow?.volumen_concreto_m3 || 0)
      const fc_ponderada = Number(viewRow?.fc_ponderada_kg_cm2 || 0)
      const edad_ponderada = Number(viewRow?.edad_ponderada_dias || 0)
      const pv_unitario = Number(viewRow?.pv_unitario || 0)
      const ventas_total = Number(viewRow?.ventas_total_concreto || 0)

      const costo_mp_unitario = Number(viewRow?.costo_mp_unitario || 0)
      const consumo_cem_m3 = Number(viewRow?.consumo_cem_per_m3_kg || 0)
      const costo_cem_m3 = Number(viewRow?.costo_cem_per_m3 || 0)
      const costo_cem_pct = costo_mp_unitario > 0 ? (costo_cem_m3 / costo_mp_unitario) * 100 : 0
      const costo_mp_total = viewRow?.costo_mp_total_concreto != null
        ? Number(viewRow.costo_mp_total_concreto)
        : (costo_mp_unitario * volumen_concreto)
      const costo_mp_pct = viewRow?.costo_mp_percent != null
        ? Number(viewRow.costo_mp_percent)
        : (ventas_total > 0 ? (costo_mp_total / ventas_total) * 100 : 0)

      // Spread
      const spread_unitario = viewRow?.spread_unitario != null
        ? Number(viewRow.spread_unitario)
        : (pv_unitario - costo_mp_unitario)
      const spread_unitario_pct = viewRow?.spread_unitario_percent != null
        ? Number(viewRow.spread_unitario_percent)
        : (pv_unitario > 0 ? (spread_unitario / pv_unitario) * 100 : 0)

      // From gerencial: Diesel and Maintenance
      // Diesel ALWAYS comes from FIFO calculation (dieselManttoByCode), never from gerencial API
      // The gerencial API doesn't provide diesel costs with FIFO - we calculate it ourselves
      const diesel_total = Number(dieselManttoByCode.get(plant.code)?.diesel_cost || 0)
      // minimal per-plant logging removed
      const diesel_unitario = volumen_concreto > 0 ? diesel_total / volumen_concreto : 0
      const diesel_pct = ventas_total > 0 ? (diesel_total / ventas_total) * 100 : 0

      const mantto_total = Number(gerencialPlant?.maintenance_cost || 0)
      const mantto_unitario = volumen_concreto > 0 ? mantto_total / volumen_concreto : 0
      const mantto_pct = ventas_total > 0 ? (mantto_total / ventas_total) * 100 : 0

      // From manual: Nómina and Otros Indirectos
      const nomina_total = manual.nomina
      const nomina_unitario = volumen_concreto > 0 ? nomina_total / volumen_concreto : 0
      const nomina_pct = ventas_total > 0 ? (nomina_total / ventas_total) * 100 : 0

      const otros_indirectos_total = manual.otros_indirectos
      const otros_indirectos_unitario = volumen_concreto > 0 ? otros_indirectos_total / volumen_concreto : 0
      const otros_indirectos_pct = ventas_total > 0 ? (otros_indirectos_total / ventas_total) * 100 : 0

      // Total Costo OP
      const total_costo_op = diesel_total + mantto_total + nomina_total + otros_indirectos_total
      const total_costo_op_pct = ventas_total > 0 ? (total_costo_op / ventas_total) * 100 : 0

      // EBITDA
      const ebitda = ventas_total - costo_mp_total - total_costo_op
      const ebitda_pct = ventas_total > 0 ? (ebitda / ventas_total) * 100 : 0

      // Bombeo data from vw_pumping_analysis_unified
      const pumpingData = pumpingDataByPlantCode.get(plant.code)
      const ingresos_bombeo_vol = pumpingData ? pumpingData.volumen_bombeo_m3 : 0
      const ingresos_bombeo_total = pumpingData ? pumpingData.subtotal_total : 0
      const ingresos_bombeo_unit = ingresos_bombeo_vol > 0 ? ingresos_bombeo_total / ingresos_bombeo_vol : 0

      // EBITDA con bombeo (EBITDA + bombeo total)
      const ebitda_con_bombeo = ebitda + ingresos_bombeo_total
      const total_ingresos_con_bombeo = ventas_total + ingresos_bombeo_total
      const ebitda_con_bombeo_pct = total_ingresos_con_bombeo > 0 ? (ebitda_con_bombeo / total_ingresos_con_bombeo) * 100 : 0

      return {
        plant_id: plant.id,
        plant_name: plant.name,
        plant_code: plant.code,
        business_unit_id: plant.business_unit_id,

        // Ingresos Concreto
        volumen_concreto,
        fc_ponderada,
        edad_ponderada,
        pv_unitario,
        ventas_total,

        // Costo Materia Prima
        costo_mp_unitario,
        consumo_cem_m3,
        costo_cem_m3,
        costo_cem_pct,
        costo_mp_total,
        costo_mp_pct,

        // Spread
        spread_unitario,
        spread_unitario_pct,

        // Costo Operativo
        diesel_total,
        diesel_unitario,
        diesel_pct,
        mantto_total,
        mantto_unitario,
        mantto_pct,
        nomina_total,
        nomina_unitario,
        nomina_pct,
        otros_indirectos_total,
        otros_indirectos_unitario,
        otros_indirectos_pct,
        total_costo_op,
        total_costo_op_pct,

        // EBITDA
        ebitda,
        ebitda_pct,

        // Bombeo
        ingresos_bombeo_vol,
        ingresos_bombeo_unit,
        ingresos_bombeo_total,

        // EBITDA con bombeo
        ebitda_con_bombeo,
        ebitda_con_bombeo_pct
      }
    })

    // Filter out plants with no data (ventas_total === 0 and all operational costs zero)
    const filteredPlantData = plantData.filter(plant => {
      const hasData = plant.ventas_total > 0 || 
        plant.diesel_total > 0 || 
        plant.mantto_total > 0 || 
        plant.nomina_total > 0 || 
        plant.otros_indirectos_total > 0
      return hasData
    })

    return NextResponse.json({
      month,
      plants: filteredPlantData,
      filters: {
        businessUnits: businessUnits || [],
        plants: plants || []
      }
    })
  } catch (e: any) {
    console.error('Ingresos-Gastos API error:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}

