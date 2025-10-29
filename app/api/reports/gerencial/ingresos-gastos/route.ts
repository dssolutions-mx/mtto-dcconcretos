import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

type Body = {
  month: string // YYYY-MM format
  businessUnitId?: string | null
  plantId?: string | null
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

    // Fetch diesel and maintenance costs using existing gerencial logic
    // We'll call the gerencial API internally and extract plant-level data
    const host = req.headers.get('host') || ''
    const base = process.env.NEXT_PUBLIC_BASE_URL || (host.includes('localhost') ? `http://${host}` : `https://${host}`)
    
    const gerencialResp = await fetch(`${base}/api/reports/gerencial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        businessUnitId,
        plantId,
        hideZeroActivity: false
      })
    })

    const gerencialData = gerencialResp.ok ? await gerencialResp.json() : null

    // Map gerencial plant data by plant ID (primary source)
    const gerencialPlantMap = new Map<string, any>()
    ;(gerencialData?.plants || []).forEach((plant: any) => {
      gerencialPlantMap.set(plant.id, plant)
    })

    // Fallback: Aggregate diesel/maintenance by plant from the assets list (if plant summary missing)
    const dieselManttoFallbackByPlant = new Map<string, { diesel_cost: number, maintenance_cost: number }>()
    const dieselManttoFallbackByCode = new Map<string, { diesel_cost: number, maintenance_cost: number }>()
    ;(gerencialData?.assets || []).forEach((asset: any) => {
      const pid = asset.plant_id
      const pcode = asset.plant_code
      const diesel = Number(asset.diesel_cost || 0)
      const mantto = Number(asset.maintenance_cost || 0)

      if (pid) {
        if (!dieselManttoFallbackByPlant.has(pid)) {
          dieselManttoFallbackByPlant.set(pid, { diesel_cost: 0, maintenance_cost: 0 })
        }
        const agg = dieselManttoFallbackByPlant.get(pid)!
        agg.diesel_cost += diesel
        agg.maintenance_cost += mantto
      }

      if (pcode) {
        if (!dieselManttoFallbackByCode.has(pcode)) {
          dieselManttoFallbackByCode.set(pcode, { diesel_cost: 0, maintenance_cost: 0 })
        }
        const agg2 = dieselManttoFallbackByCode.get(pcode)!
        agg2.diesel_cost += diesel
        agg2.maintenance_cost += mantto
      }
    })

    // Deep fallback (direct queries) if we still have no data for both diesel and maintenance
    const needDeepFallback = gerencialData == null || (
      (gerencialData.plants || []).length === 0 && (gerencialData.assets || []).length === 0
    )
    if (needDeepFallback) {
      // Query minimal data directly in mantenimiento to compute per-plant diesel and maintenance
      // 1) Build assets list with plant mapping
      const { data: assetsDirect } = await supabase
        .from('assets')
        .select('id, plant_id, plants(code)')
      const assetIds: string[] = (assetsDirect || []).map(a => a.id)

      // 2) Diesel price per product
      const { data: products } = await supabase
        .from('diesel_products')
        .select('id, price_per_liter')
      const priceByProduct = new Map<string, number>()
      ;(products || []).forEach(p => priceByProduct.set(p.id, Number(p.price_per_liter || 0)))

      // 3) Diesel transactions within month
      const { data: dieselTxs } = await supabase
        .from('diesel_transactions')
        .select('asset_id, plant_id, product_id, quantity_liters, unit_cost, transaction_type, transaction_date')
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr)
        .eq('transaction_type', 'consumption')
        .in('asset_id', assetIds)

      // 3b) Diesel entries within month for weighted average price per plant
      const { data: dieselEntries } = await supabase
        .from('diesel_transactions')
        .select('plant_id, product_id, quantity_liters, unit_cost, transaction_type, transaction_date')
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr)
        .eq('transaction_type', 'entry')

      // 4) Purchase orders + work orders for maintenance
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('id, total_amount, actual_amount, created_at, posting_date, purchased_at, work_order_id, status')
        .neq('status', 'pending_approval')
      const workOrderIds = (purchaseOrders || []).map(po => po.work_order_id).filter(Boolean)
      const { data: workOrders } = workOrderIds.length > 0 ? await supabase
        .from('work_orders')
        .select('id, asset_id, completed_at, planned_date, created_at, assets(plant_id, plants(code))')
        .in('id', workOrderIds) : { data: [] as any[] }
      const woById = new Map<string, any>((workOrders || []).map(w => [w.id, w]))

      // Build plant code map for deep fallback
      const plantDieselMantto = new Map<string, { diesel: number, mantto: number }>()

      // Build plant id -> code map for fast lookup
      const plantIdToCode = new Map<string, string>()
      ;(plants || []).forEach(p => {
        if (p.id && p.code) plantIdToCode.set(p.id, p.code)
      })

      // Compute weighted average diesel price per plant code for the month using entries
      const entriesAgg = new Map<string, { liters: number, cost: number }>()
      ;(dieselEntries || []).forEach(e => {
        const code = e.plant_id ? plantIdToCode.get(e.plant_id) : undefined
        if (!code) return
        if (!entriesAgg.has(code)) entriesAgg.set(code, { liters: 0, cost: 0 })
        const liters = Number(e.quantity_liters || 0)
        const unit = Number(e.unit_cost || 0)
        const entry = entriesAgg.get(code)!
        entry.liters += liters
        entry.cost += liters * unit
      })
      const avgPriceByPlantCode = new Map<string, number>()
      entriesAgg.forEach((v, code) => {
        if (v.liters > 0) avgPriceByPlantCode.set(code, v.cost / v.liters)
      })

      // Aggregate diesel
      ;(dieselTxs || []).forEach(tx => {
        // Prefer plant_id on transaction; fall back to asset mapping
        let plantCode = tx.plant_id ? plantIdToCode.get(tx.plant_id) : undefined
        if (!plantCode) {
          const asset = (assetsDirect || []).find(a => a.id === tx.asset_id)
          plantCode = (asset as any)?.plants?.code
        }
        if (!plantCode) return
        // Price: weighted avg for plant in month; fallback to tx.unit_cost; then to product default
        const price = (avgPriceByPlantCode.get(plantCode) != null)
          ? (avgPriceByPlantCode.get(plantCode) as number)
          : (tx.unit_cost != null ? Number(tx.unit_cost) : (priceByProduct.get(tx.product_id) || 0))
        const cost = Number(tx.quantity_liters || 0) * price
        if (!plantDieselMantto.has(plantCode)) plantDieselMantto.set(plantCode, { diesel: 0, mantto: 0 })
        plantDieselMantto.get(plantCode)!.diesel += cost
      })

      // Aggregate maintenance
      // Priority: purchased_at → work_order.completed_at → work_order.planned_date → work_order.created_at
      ;(purchaseOrders || []).forEach(po => {
        let dateToCheckStr: string
        
        // First priority: purchased_at
        if (po.purchased_at) {
          dateToCheckStr = po.purchased_at
        } else if (po.work_order_id) {
          const wo = woById.get(po.work_order_id)
          // Second priority: work_order.completed_at
          if (wo?.completed_at) {
            dateToCheckStr = wo.completed_at
          }
          // Third priority: work_order.planned_date
          else if (wo?.planned_date) {
            dateToCheckStr = wo.planned_date
          }
          // Fourth priority: work_order.created_at
          else if (wo?.created_at) {
            dateToCheckStr = wo.created_at
          }
          // Fallback to PO created_at
          else {
            dateToCheckStr = po.created_at
          }
        } else {
          // No work order - use PO created_at
          dateToCheckStr = po.created_at
        }
        
        const ts = new Date(dateToCheckStr).getTime()
        if (ts < new Date(dateFromStr).getTime() || ts > new Date(dateToStr).getTime()) return
        const finalAmount = po.actual_amount ? parseFloat(po.actual_amount) : parseFloat(po.total_amount || '0')
        const wo = po.work_order_id ? woById.get(po.work_order_id) : null
        const plantCode = (wo as any)?.assets?.plants?.code
        if (!plantCode) return
        if (!plantDieselMantto.has(plantCode)) plantDieselMantto.set(plantCode, { diesel: 0, mantto: 0 })
        plantDieselMantto.get(plantCode)!.mantto += finalAmount
      })

      // Merge deep fallback into code-based maps
      plantDieselMantto.forEach((v, code) => {
        if (!dieselManttoFallbackByCode.has(code)) dieselManttoFallbackByCode.set(code, { diesel_cost: 0, maintenance_cost: 0 })
        const entry = dieselManttoFallbackByCode.get(code)!
        entry.diesel_cost += v.diesel
        entry.maintenance_cost += v.mantto
      })
    }

    // Fetch manual financial adjustments for the period
    const { data: manualAdjustments } = await supabase
      .from('manual_financial_adjustments')
      .select('*')
      .eq('period_month', periodMonth)
      .in('plant_id', targetPlants.map(p => p.id))

    // Aggregate manual adjustments by plant and category
    const manualByPlant = new Map<string, { nomina: number, otros_indirectos: number }>()
    ;(manualAdjustments || []).forEach(adj => {
      if (!adj.plant_id) return
      if (!manualByPlant.has(adj.plant_id)) {
        manualByPlant.set(adj.plant_id, { nomina: 0, otros_indirectos: 0 })
      }
      const entry = manualByPlant.get(adj.plant_id)!
      if (adj.category === 'nomina') {
        entry.nomina += Number(adj.amount || 0)
      } else if (adj.category === 'otros_indirectos') {
        entry.otros_indirectos += Number(adj.amount || 0)
      }
    })

    // Build unified plant data
    const plantData = targetPlants.map(plant => {
      const viewRow = viewDataByPlantCode.get(plant.code)
      let gerencialPlant = gerencialPlantMap.get(plant.id)
      if (!gerencialPlant) {
        const fb = dieselManttoFallbackByPlant.get(plant.id)
        if (fb) {
          gerencialPlant = { diesel_cost: fb.diesel_cost, maintenance_cost: fb.maintenance_cost }
        } else {
          const fbCode = dieselManttoFallbackByCode.get(plant.code)
          if (fbCode) {
            gerencialPlant = { diesel_cost: fbCode.diesel_cost, maintenance_cost: fbCode.maintenance_cost }
          }
        }
      }
      const manual = manualByPlant.get(plant.id) || { nomina: 0, otros_indirectos: 0 }

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
      const diesel_total = Number(gerencialPlant?.diesel_cost || 0)
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

      // Optional: Bombeo data (if available in view)
      const ingresos_bombeo_vol = Number(viewRow?.ingresos_bombeo_vol || 0)
      const ingresos_bombeo_unit = Number(viewRow?.ingresos_bombeo_unit || 0)

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

        // Optional Bombeo
        ingresos_bombeo_vol,
        ingresos_bombeo_unit
      }
    })

    return NextResponse.json({
      month,
      plants: plantData,
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

