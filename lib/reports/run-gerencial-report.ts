import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { shouldIncludePurchaseOrderInExpenseReport } from '@/lib/reports/purchase-order-report-eligibility'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { calculateDieselCostsFIFO } from '@/lib/fifo-diesel-costs'
import { buildAssignmentHistoryMap, resolveAssetPlantAtTimestamp } from '@/lib/reporting/asset-plant-attribution'
import { reportsVerbose } from '@/lib/reports/debug'

export type GerencialReportBody = {
  dateFrom: string
  dateTo: string
  businessUnitId?: string | null
  plantId?: string | null
  hideZeroActivity?: boolean
}

export type GerencialReportOptions = {
  /** Pass `request.headers.get('host')` when invoked from a Route Handler. */
  requestHost?: string | null
  /**
   * Caller-supplied client (e.g. cookie session or service role). When omitted, uses
   * `createServerSupabase()` (requires Next.js request scope).
   */
  supabase?: SupabaseClient<Database>
}

/**
 * Full gerencial report payload (same JSON as POST /api/reports/gerencial).
 * In-process — avoids HTTP self-calls from other server routes.
 */
export async function runGerencialReport(
  body: GerencialReportBody,
  options?: GerencialReportOptions
): Promise<Record<string, unknown>> {
  try {
    const { dateFrom, dateTo, businessUnitId, plantId, hideZeroActivity } = body

    // Normalize dates to YYYY-MM-DD to avoid malformed timestamps when dateTo is full ISO
    const dateFromStr = typeof dateFrom === 'string' && dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom
    const dateToStr = typeof dateTo === 'string' && dateTo.includes('T') ? dateTo.split('T')[0] : dateTo

    // Compute exclusive end-of-day bound to avoid timezone-related drops
    // Use UTC explicitly to ensure consistent behavior across environments
    const dateFromStart = new Date(`${dateFromStr}T00:00:00.000Z`)
    const dateToExclusive = new Date(`${dateToStr}T00:00:00.000Z`)
    dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
    const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)

    const supabase = options?.supabase ?? (await createServerSupabase())

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
    if (plantId) plantsQuery = plantsQuery.eq('id', plantId)
    const { data: plants } = await plantsQuery

    // Get organizational structure with assets
    const buQuery = supabase
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

    // Build full org maps and raw asset list first.
    // Apply plant/BU filters only after historical attribution to avoid
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
          const assetCode: string | undefined = asset.asset_id || undefined
          const modelCategory: string | undefined = (asset as any).equipment_models?.category || undefined
          const equipmentType = (assetCode && assetCode.toUpperCase().startsWith('BP'))
            ? 'Bomba'
            : (modelCategory || 'Sin categoría')

          rawAssets.push({
            id: asset.id,
            asset_code: asset.asset_id,
            name: asset.name,
            current_plant_id: plant.id,
            current_plant_name: plant.name,
            current_plant_code: plant.code,
            current_business_unit_id: bu.id,
            current_business_unit_name: bu.name,
            model_category: modelCategory || null,
            equipment_type: equipmentType
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

        if (
          reportsVerbose &&
          (asset.asset_code === 'CR-16' || asset.id === '6be57c11-a350-4e96-bbca-f3772483ee22')
        ) {
          console.log(`[Gerencial] Asset CR-16: current_plant_id=${asset.current_plant_id}, attributedPlantId=${attributedPlantId}, attributedPlant.name=${attributedPlant.name}`)
          const history = assignmentHistoryMap.get(asset.id) || []
          console.log(`[Gerencial] Asset CR-16: assignment history entries=${history.length}`)
          history.forEach((h, idx) => {
            console.log(`[Gerencial] Asset CR-16: history[${idx}] previous=${h.previousPlantId}, new=${h.newPlantId}, at=${new Date(h.createdAtMs).toISOString()}`)
          })
        }

        return {
          ...asset,
          plant_id: attributedPlant.id,
          plant_name: attributedPlant.name,
          plant_code: attributedPlant.code,
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

    // Fetch diesel transactions with asset info (only diesel, not urea, exclude transfers)
    // CRITICAL: Exclude transfers (is_transfer = true) from consumption reports
    // Transfers are inventory movements between plants, not actual consumption
    const dieselQuery = supabase
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
        kilometer_reading,
        previous_kilometer,
        hours_consumed,
        kilometers_consumed,
        is_transfer,
        diesel_warehouses!inner(product_type)
      `)
      .eq('diesel_warehouses.product_type', 'diesel')
      .neq('is_transfer', true) // Explicitly exclude transfers (is_transfer = true)
      .gte('transaction_date', dateFromStr)
      .lt('transaction_date', dateToExclusiveStr)

    const { data: dieselTxs } = await dieselQuery

    // Fetch diesel products for pricing
    const productIds = Array.from(new Set((dieselTxs || []).map(t => t.product_id).filter(Boolean)))
    const { data: products } = await supabase
      .from('diesel_products')
      .select('id, price_per_liter')
      .in('id', productIds)

    const priceByProduct = new Map<string, number>()
    ;(products || []).forEach(p => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

    // Calculate FIFO diesel costs per transaction
    // Get plant codes for all plants in the report
    const plantCodes = Array.from(new Set((plants || [])
      .filter(p => !plantId || p.id === plantId)
      .filter(p => !businessUnitId || p.business_unit_id === businessUnitId)
      .map(p => p.code)
      .filter(Boolean))) as string[]
    
    // Calculate FIFO costs before processing diesel transactions
    const fifoResult = plantCodes.length > 0 ? await calculateDieselCostsFIFO(
      supabase,
      dateFromStr,
      dateToStr,
      plantCodes,
      priceByProduct
    ) : { plantCosts: new Map(), transactionCosts: new Map() }
    const fifoTransactionCosts = fifoResult.transactionCosts // Map of transaction_id -> FIFO cost

    // Fetch purchase orders, then apply the report expense eligibility rule below.
    const { data: purchaseOrders } = await supabase
      .from('purchase_orders')
      .select(`
        id, order_id, total_amount, actual_amount, created_at, posting_date, purchase_date, plant_id, work_order_id, status,
        po_purpose, fulfillment_source, received_to_inventory
      `)

    // Get work orders for the purchase orders (to get asset_id and type)
    const eligiblePurchaseOrders =
      purchaseOrders?.filter((po) =>
        shouldIncludePurchaseOrderInExpenseReport({
          status: po.status,
        })
      ) || []

    const poWorkOrderIds = eligiblePurchaseOrders.map(po => po.work_order_id).filter(Boolean) || []
    let workOrdersMap = new Map()
    
    if (poWorkOrderIds.length > 0) {
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id, type, asset_id, planned_date, completed_at, created_at,
          assets (
            id, plant_id
          )
        `)
        .in('id', poWorkOrderIds)
      
      workOrdersMap = new Map(workOrders?.map(wo => [wo.id, wo]) || [])
    }

    // Filter purchase orders by date range (inclusive start, inclusive end).
    // Priority: purchase_date → work_order.completed_at → work_order.planned_date → work_order.created_at → po.created_at
    // Compare by DATE ONLY (YYYY-MM-DD) to avoid timezone issues
    const filteredPurchaseOrders = eligiblePurchaseOrders.filter(po => {
      let dateToCheckStr: string
      
      // First priority: purchase_date
      if (po.purchase_date) {
        dateToCheckStr = po.purchase_date
      } else if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        // Second priority: work_order.completed_at
        if (workOrder?.completed_at) {
          dateToCheckStr = workOrder.completed_at
        }
        // Third priority: work_order.planned_date
        else if (workOrder?.planned_date) {
          dateToCheckStr = workOrder.planned_date
        }
        // Fourth priority: work_order.created_at
        else if (workOrder?.created_at) {
          dateToCheckStr = workOrder.created_at
        }
        // Fallback to PO created_at
        else {
          dateToCheckStr = po.created_at
        }
      } else {
        // No work order - use PO created_at
        dateToCheckStr = po.created_at
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
      
      const checkDateOnly = extractDateOnly(dateToCheckStr)
      const fromDateOnly = dateFromStr
      const toDateOnly = dateToStr
      
      // Compare as date strings (YYYY-MM-DD), ignoring time and timezone
      // This ensures "2025-10-01" is always > "2025-09-30" regardless of server timezone
      return checkDateOnly >= fromDateOnly && checkDateOnly <= toDateOnly
    }) || []

    // Get additional expenses
    // Exclude rejected expenses and those already converted to adjustment POs (to avoid double counting)
    const assetIds = assets.map(a => a.id)
    const { data: additionalExpenses } = await supabase
      .from('additional_expenses')
      .select('id, asset_id, amount, created_at, adjustment_po_id, status')
      .gte('created_at', dateFromStr)
      .lt('created_at', dateToExclusiveStr)
      .in('asset_id', assetIds)
      .is('adjustment_po_id', null)
      .neq('status', 'rejected')

    // Create plant code to maintenance plant ID map
    const plantCodeToIdMap = new Map<string, string>()
    ;(plants || []).forEach(p => {
      if (p.code) plantCodeToIdMap.set(p.code, p.id)
    })

    // Fetch sales from cotizador
    const host = options?.requestHost ?? ''
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
      console.warn('[Gerencial Report] Base URL mismatch detected:', {
        envBaseUrl,
        actualBaseUrl: base,
        host,
        note: 'Using actual host for internal API calls'
      })
    }
    
    if (reportsVerbose) {
      console.log('[Gerencial Report] Sales fetch configuration:', {
        host,
        baseUrl: base,
        envBaseUrl: envBaseUrl || '(not set)',
        dateFrom,
        dateTo
      })
    }
    
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

    // CRITICAL: DO NOT filter remisiones by plant!
    // Fetch ALL sales data regardless of plant filter to preserve remisiones history
    // when assets move between plants. Plant filtering will be applied later during asset matching.
    // const cotizadorPlantIds = [] // Intentionally empty - fetch all plants
    
    const salesApiUrl = `${base}/api/integrations/cotizador/sales/assets/weekly`
    const salesRequestPayload = { 
      dateFrom: dateFromStr, 
      dateTo: dateToStr, 
      plantIds: undefined // Always fetch ALL plants - remisiones should not be filtered by plant
    }
    
    if (reportsVerbose) {
      console.log('[Gerencial Report] Fetching sales data:', {
        url: salesApiUrl,
        payload: salesRequestPayload
      })
    }
    
    let salesRows: any[] = []
    try {
      const salesResp = await fetch(salesApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salesRequestPayload)
      })
      
      if (!salesResp.ok) {
        const errorText = await salesResp.text()
        let errorJson: any = null
        try {
          errorJson = JSON.parse(errorText)
        } catch {
          // Not JSON, use text as-is
        }
        
        console.error('[Gerencial Report] Sales API fetch failed:', {
          status: salesResp.status,
          statusText: salesResp.statusText,
          url: salesApiUrl,
          errorBody: errorJson || errorText,
          headers: Object.fromEntries(salesResp.headers.entries())
        })
        
        // Don't throw - continue with empty sales data but log the error
        salesRows = []
      } else {
        try {
          salesRows = await salesResp.json()
          if (reportsVerbose) {
            console.log('[Gerencial Report] Sales data fetched successfully:', {
              rowCount: salesRows?.length || 0,
              totalSales: salesRows?.reduce((sum: number, row: any) => sum + Number(row.subtotal_amount || 0), 0) || 0,
              totalM3: salesRows?.reduce((sum: number, row: any) => sum + Number(row.concrete_m3 || 0), 0) || 0
            })
          }
        } catch (parseError: any) {
          console.error('[Gerencial Report] Failed to parse sales API response:', {
            error: parseError?.message,
            status: salesResp.status,
            url: salesApiUrl
          })
          salesRows = []
        }
      }
    } catch (fetchError: any) {
      console.error('[Gerencial Report] Sales API fetch exception:', {
        error: fetchError?.message,
        stack: fetchError?.stack,
        url: salesApiUrl,
        baseUrl: base,
        host: host
      })
      // Continue with empty sales data
      salesRows = []
    }

    // Helper function for fuzzy matching asset codes
    const normalizeAssetCode = (code: string): string => {
      let normalized = code.toUpperCase().trim()

      // Step 0: Insert dash between letters and trailing digits (BP01 → BP-01, CR03 → CR-03)
      // Cotizador uses "BP01"/"BP02" while Maintenance uses "BP-01"/"BP-02"
      normalized = normalized.replace(/^([A-Z]{2,})(\d+)$/i, '$1-$2')

      // Step 0b: Normalize CR-EXT NN → CR-EXT-NN (space to dash for external units)
      normalized = normalized.replace(/^CR-EXT\s+(\d{1,2})$/i, 'CR-EXT-$1')

      // Step 1: Remove single-char variant suffixes only (CR-17-B → CR-17, CR-17-1 → CR-17)
      // Must NOT strip multi-digit numbers (CR-03, CR-14) - only -B, -1, -A style suffixes
      normalized = normalized.replace(/^([A-Z]{2,}-\d+)[-\s]+[0-9A-Z]$/i, '$1')
      
      // Step 2: Remove single letter directly after number (no dash) (CR-17B → CR-17, CR-15A → CR-15)
      // Only matches if letter comes directly after a digit without a dash
      normalized = normalized.replace(/(\d)([A-Z])$/i, '$1')
      
      // Note: We do NOT remove trailing digits to avoid corrupting multi-digit numbers
      // (e.g., CR-14 should stay CR-14, not become CR-1)
      
      return normalized
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
      
      // Exact match (BP-01, CR-03, etc.)
      assetNameToIdMap.set(asset.asset_code.toUpperCase(), asset.id)
      // Dashless canonical form (BP01 → BP-01, CR03 → CR-03) for Cotizador codes
      const dashless = asset.asset_code.replace(/([A-Z]{2,})-(\d+)/i, '$1$2').toUpperCase()
      if (dashless !== asset.asset_code.toUpperCase()) assetNameToIdMap.set(dashless, asset.id)
      
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
        kilometers_worked: 0,
        liters_per_km: 0,
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

    // Aggregate diesel by asset
    const dieselByAsset = new Map<string, any[]>()
    ;(dieselTxs || []).forEach(tx => {
      // CRITICAL: Double-check to exclude transfers (defense in depth)
      if (tx.is_transfer === true) {
        if (reportsVerbose) {
          console.warn(`[Gerencial Report] Skipping transfer transaction: ${tx.id}`)
        }
        return
      }
      if (tx.transaction_type !== 'consumption' || !tx.asset_id) return
      if (!dieselByAsset.has(tx.asset_id)) dieselByAsset.set(tx.asset_id, [])
      dieselByAsset.get(tx.asset_id)!.push(tx)

      const asset = assetMap.get(tx.asset_id)
      if (!asset) return
      const qty = Number(tx.quantity_liters || 0)
      
      // Use FIFO cost if available, otherwise fallback to transaction unit_cost or product default
      const fifoCost = fifoTransactionCosts.get(tx.id)
      let cost = 0
      if (fifoCost !== undefined) {
        // FIFO cost is already calculated for this transaction
        cost = fifoCost
      } else {
        // Fallback: use transaction unit_cost or product default price
        const price = Number(tx.unit_cost || 0) || priceByProduct.get(tx.product_id || '') || 0
        cost = qty * price
      }
      
      asset.diesel_liters += qty
      asset.diesel_cost += cost
    })

    // Efficiency: use diesel-only SUM of generated columns (matches breakdown modal)
    dieselByAsset.forEach((assetId, txs) => {
      const asset = assetMap.get(assetId)
      if (!asset) return
      const hours_worked = txs.reduce((sum: number, t: any) => sum + Number(t.hours_consumed || 0), 0)
      const kilometers_worked = txs.reduce((sum: number, t: any) => sum + Number(t.kilometers_consumed || 0), 0)
      asset.hours_worked = hours_worked
      asset.kilometers_worked = kilometers_worked
      asset.liters_per_hour = hours_worked > 0 && asset.diesel_liters > 0 ? asset.diesel_liters / hours_worked : 0
      asset.liters_per_km = kilometers_worked > 0 && asset.diesel_liters > 0 ? asset.diesel_liters / kilometers_worked : 0
    })

    // Separate POs by purpose to track cash vs inventory expenses
    const workOrderPOs = filteredPurchaseOrders.filter(po => 
      po.work_order_id && po.po_purpose !== 'inventory_restock'
    )
    const restockingPOs = filteredPurchaseOrders.filter(po => 
      po.po_purpose === 'inventory_restock' || (!po.work_order_id && !po.po_purpose)
    )
    
    // Track restocking POs for audit (excluded from expense reports)
    let totalRestockingExcluded = 0
    restockingPOs.forEach(po => {
      const amount = parseFloat(po.actual_amount || po.total_amount || '0')
      totalRestockingExcluded += amount
    })
    
    if (reportsVerbose) {
      console.log(`[Gerencial] Excluded ${restockingPOs.length} restocking POs totaling $${totalRestockingExcluded.toFixed(2)} from expenses`)
    }
    
    // Aggregate maintenance costs from work order POs only
    workOrderPOs.forEach(po => {
      const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
      
      // Determine cash vs inventory expense
      const isCashExpense = po.po_purpose !== 'work_order_inventory'
      const cashAmount = isCashExpense ? finalAmount : 0
      const inventoryAmount = !isCashExpense ? finalAmount : 0
      
      // If linked to work order -> get asset from work order
      if (po.work_order_id) {
        const workOrder = workOrdersMap.get(po.work_order_id)
        if (workOrder?.asset_id) {
          const asset = assetMap.get(workOrder.asset_id)
          if (asset) {
            // Total maintenance cost (cash + inventory)
            asset.maintenance_cost += finalAmount
            
            // Track cash vs inventory separately
            if (!asset.cash_expenses) asset.cash_expenses = 0
            if (!asset.inventory_expenses) asset.inventory_expenses = 0
            asset.cash_expenses += cashAmount
            asset.inventory_expenses += inventoryAmount
            
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

    // Additional expenses: DO NOT add to maintenance_cost
    // Los gastos adicionales al convertirse son ÓC de ajuste (is_adjustment=true).
    // Esas ÓC ya están contadas en workOrderPOs. Si sumáramos AEs con adjustment_po_id=null
    // y hubiera datos inconsistentes (adjustment_po_id no seteado), contaremos el costo dos veces.
    // Regla: solo se cuenta en purchase_orders. Los gastos adicionales NO se suman al costo total.
    // (Se siguen trayendo para auditoría/desglose si se necesitan en el futuro.)

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
      // CRITICAL: Match by asset code/name first, prefer current plant but allow any plant
      // This preserves remisiones when assets move between plants
      if (!assetId) {
        const namesToTry = [assetName, normalizeAssetCode(assetName)].filter((v, i, a) => a.indexOf(v) === i)
        for (const tryName of namesToTry) {
          let matchingAsset = Array.from(assetMap.values()).find(a => 
            a.plant_id === maintenancePlantId && 
            a.asset_code && 
            a.asset_code.toUpperCase() === tryName
          )
          if (!matchingAsset) {
            matchingAsset = Array.from(assetMap.values()).find(a => 
              a.asset_code && 
              a.asset_code.toUpperCase() === tryName
            )
          }
          if (matchingAsset) {
            assetId = matchingAsset.id
            matchMethod = 'exact_code'
            break
          }
        }
      }

      // Strategy 2: Fuzzy matching (CR-15 → CR-15-1, CR-24-B → CR-24, CR-17B → CR-17)
      if (!assetId) {
        const normalizedName = normalizeAssetCode(assetName)
        
        // Only skip if normalization shortened the code significantly (more than 2 chars)
        // This prevents over-normalization while still allowing suffix removal
        if (normalizedName.length >= assetName.length - 2) {
          const candidates = normalizedCodeToAssets.get(normalizedName)
          
          if (candidates && candidates.length > 0) {
            // First priority: assets that start with the original asset name (prefix match)
            // This ensures "CR-15" matches "CR-15-1" before "CR-19"
            const prefixMatch = candidates.find(c => {
              const code = (c.asset_code || '').toUpperCase()
              return code && code.startsWith(assetName)
            })
            
            if (prefixMatch) {
              assetId = prefixMatch.id
              matchMethod = 'fuzzy'
            } else {
              // Second priority: assets in the same plant (preferred, but not required)
              const plantMatch = candidates.find(c => c.plant_id === maintenancePlantId)
              if (plantMatch) {
                assetId = plantMatch.id
                matchMethod = 'fuzzy'
              } else if (candidates.length > 0) {
                // Last resort: use first candidate from any plant (preserves remisiones when assets move)
                assetId = candidates[0].id
                matchMethod = 'fuzzy'
              }
            }
          }
        }
      }

      // Strategy 3: Partial prefix matching
      // First try direct prefix match (CR-15 → CR-15-1), then iteratively remove characters
      if (!assetId) {
        // Step 3a: Try direct prefix match - find assets that start with the original name
        // This handles cases like "CR-15" → "CR-15-1" when Strategy 2 didn't catch it
        // Prefer current plant but allow any plant (for moved assets)
        let directPrefixMatch = Array.from(assetMap.values()).find(a => 
          a.plant_id === maintenancePlantId && 
          a.asset_code && 
          a.asset_code.toUpperCase().startsWith(assetName) &&
          a.asset_code.toUpperCase() !== assetName // Don't match exact (already tried in Strategy 1)
        )
        // If not found in current plant, try any plant
        if (!directPrefixMatch) {
          directPrefixMatch = Array.from(assetMap.values()).find(a => 
            a.asset_code && 
            a.asset_code.toUpperCase().startsWith(assetName) &&
            a.asset_code.toUpperCase() !== assetName
          )
        }
        
        if (directPrefixMatch) {
          assetId = directPrefixMatch.id
          matchMethod = 'partial_prefix'
        } else {
          // Step 3b: Iteratively remove trailing characters
          // Example: "CR-17B" → try "CR-17" → try "CR-1" → try "CR"
          let testName = assetName
          while (testName.length > 5 && !assetId) {
            // Remove last character
            testName = testName.slice(0, -1)
            
            // Try exact match first - prefer current plant but allow any plant
            let exactMatch = Array.from(assetMap.values()).find(a => 
              a.plant_id === maintenancePlantId && 
              a.asset_code && 
              a.asset_code.toUpperCase() === testName
            )
            // If not found in current plant, try any plant
            if (!exactMatch) {
              exactMatch = Array.from(assetMap.values()).find(a => 
                a.asset_code && 
                a.asset_code.toUpperCase() === testName
              )
            }
            
            if (exactMatch) {
              assetId = exactMatch.id
              matchMethod = 'partial_prefix'
              break
            }
            
            // Try normalized match, but prefer assets that start with testName (prefix match)
            const normalizedTest = normalizeAssetCode(testName)
            const candidates = normalizedCodeToAssets.get(normalizedTest)
            if (candidates && candidates.length > 0) {
              // Prefer assets that start with testName (prefix match)
              const prefixMatch = candidates.find(c => {
                const code = (c.asset_code || '').toUpperCase()
                return code && code.startsWith(testName)
              })
              
              if (prefixMatch) {
                assetId = prefixMatch.id
                matchMethod = 'partial_prefix'
                break
              }
              
              // Then prefer assets in the same plant (but not required)
              const plantMatch = candidates.find(c => c.plant_id === maintenancePlantId)
              if (plantMatch) {
                assetId = plantMatch.id
                matchMethod = 'partial_prefix'
                break
              }
              
              // Last resort: use first candidate from any plant (preserves remisiones when assets move)
              if (candidates.length > 0) {
                assetId = candidates[0].id
                matchMethod = 'partial_prefix'
                break
              }
            }
          }
        }
      }

      if (assetId && assetMap.has(assetId)) {
        const asset = assetMap.get(assetId)
        asset.sales_subtotal += Number(sale.subtotal_amount || 0)
        asset.sales_with_vat += Number(sale.total_amount_with_vat || 0)
        asset.concrete_m3 += Number(sale.concrete_m3 || 0)
        asset.total_m3 += Number(sale.total_m3 || 0)
        asset.remisiones_count += Number(sale.remisiones_count || 0)
        
        // Track fuzzy and partial prefix matches for debugging
        if (matchMethod === 'fuzzy' || matchMethod === 'partial_prefix') {
          asset._fuzzy_matches = asset._fuzzy_matches || []
          asset._fuzzy_matches.push(sale.asset_name)
          
          // Log successful matches for debugging
          if (reportsVerbose) {
            if (matchMethod === 'fuzzy') {
              const normalizedName = normalizeAssetCode(assetName)
              console.log(`[Asset Matching] Fuzzy match: "${assetName}" → "${asset.asset_code}" (normalized: "${normalizedName}")`)
            } else if (matchMethod === 'partial_prefix') {
              console.log(`[Asset Matching] Partial prefix match: "${assetName}" → "${asset.asset_code}"`)
            }
          }
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

    // Aggregate standalone POs (no work order) - exclude inventory_restock
    // These go to plant totals by po.plant_id
    const standalonePOs = filteredPurchaseOrders.filter(po =>
      !po.work_order_id && po.po_purpose !== 'inventory_restock' && po.plant_id
    )

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
          kilometers_worked: 0,
          liters_per_km: 0,
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
      plant.kilometers_worked += asset.kilometers_worked || 0
      plant.maintenance_cost += asset.maintenance_cost
      plant.preventive_cost += asset.preventive_cost || 0
      plant.corrective_cost += asset.corrective_cost || 0
      plant.sales_subtotal += asset.sales_subtotal
      plant.sales_with_vat += asset.sales_with_vat
      plant.concrete_m3 += asset.concrete_m3
      plant.total_m3 += asset.total_m3
    })

    // Add standalone POs to plant totals
    standalonePOs.forEach(po => {
      const plantId = po.plant_id
      if (!plantId) return
      let plant = plantMap.get(plantId)
      if (!plant) {
        const plantInfo = (plants || []).find((p: { id: string }) => p.id === plantId)
        if (!plantInfo) return
        plant = {
          id: plantId,
          name: (plantInfo as any).name,
          business_unit_id: (plantInfo as any).business_unit_id,
          business_unit_name: (businessUnits || []).find((bu: { id: string }) => bu.id === (plantInfo as any).business_unit_id)?.name || '',
          asset_count: 0,
          diesel_liters: 0,
          diesel_cost: 0,
          hours_worked: 0,
          liters_per_hour: 0,
          kilometers_worked: 0,
          liters_per_km: 0,
          maintenance_cost: 0,
          preventive_cost: 0,
          corrective_cost: 0,
          sales_subtotal: 0,
          sales_with_vat: 0,
          concrete_m3: 0,
          total_m3: 0
        }
        plantMap.set(plantId, plant)
      }
      const amount = parseFloat(po.actual_amount || po.total_amount || '0')
      plant.maintenance_cost += amount
      plant.corrective_cost += amount
    })

    // Compute plant liters_per_hour and liters_per_km
    plantMap.forEach(plant => {
      if ((plant.hours_worked || 0) > 0) {
        plant.liters_per_hour = plant.diesel_liters / plant.hours_worked
      }
      if ((plant.kilometers_worked || 0) > 0) {
        plant.liters_per_km = plant.diesel_liters / plant.kilometers_worked
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
          kilometers_worked: 0,
          liters_per_km: 0,
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
      bu.kilometers_worked += plant.kilometers_worked || 0
      bu.maintenance_cost += plant.maintenance_cost
      bu.preventive_cost += plant.preventive_cost
      bu.corrective_cost += plant.corrective_cost
      bu.sales_subtotal += plant.sales_subtotal
      bu.sales_with_vat += plant.sales_with_vat
      bu.concrete_m3 += plant.concrete_m3
      bu.total_m3 += plant.total_m3
    })

    // Compute BU liters_per_hour and liters_per_km
    buMap.forEach(bu => {
      if ((bu.hours_worked || 0) > 0) {
        bu.liters_per_hour = bu.diesel_liters / bu.hours_worked
      }
      if ((bu.kilometers_worked || 0) > 0) {
        bu.liters_per_km = bu.diesel_liters / bu.kilometers_worked
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

    if (reportsVerbose) {
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
    }

    // Build assets array for response; optionally hide zero-activity assets
    const assetsArrayAll = Array.from(assetMap.values())
    const assetsArray = hideZeroActivity
      ? assetsArrayAll.filter((a: any) => (a.hours_worked || 0) > 0 || (a.diesel_liters || 0) > 0)
      : assetsArrayAll

    // Calculate cash flow summary
    const cashFlowSummary = {
      cash_expenses: assetsArrayAll.reduce((sum, a) => sum + (a.cash_expenses || 0), 0),
      inventory_expenses: assetsArrayAll.reduce((sum, a) => sum + (a.inventory_expenses || 0), 0),
      total_expenses: assetsArrayAll.reduce((sum, a) => sum + (a.maintenance_cost || 0), 0),
      restocking_excluded: totalRestockingExcluded,
      restocking_pos_count: restockingPOs.length
    }

    return {
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
      cash_flow_summary: cashFlowSummary,
      debug: {
        salesMatched,
        salesUnmatched,
        unmatchedAssets: unmatchedList
      }
    }
  } catch (e: unknown) {
    console.error('Gerencial report error:', e)
    const message = e instanceof Error ? e.message : 'Unexpected error'
    throw new Error(message)
  }
}
