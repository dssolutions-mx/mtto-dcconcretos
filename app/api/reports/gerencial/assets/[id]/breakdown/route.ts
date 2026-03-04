import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createServerSupabase()
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const { id: assetId } = await params

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    // Fetch asset basic info and mapping names
    const [assetRes, mappingsRes] = await Promise.all([
      supabase
        .from('assets')
        .select('id, asset_id, name, plant_id, plants(id, code, name)')
        .eq('id', assetId)
        .single(),
      supabase
        .from('asset_name_mappings')
        .select('external_unit')
        .eq('asset_id', assetId)
        .eq('source_system', 'cotizador')
    ])

    if (assetRes.error) {
      return NextResponse.json({ error: assetRes.error.message }, { status: 500 })
    }

    const asset = assetRes.data
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Normalize date bounds (inclusive end-of-day)
    const startISO = startDate!.includes('T') ? startDate! : `${startDate}T00:00:00`
    const endISOInclusive = endDate!.includes('T') ? endDate! : `${endDate}T23:59:59`

    // Diesel transactions for this asset (only diesel, exclude urea and transfers)
    const dieselPromise = supabase
      .from('diesel_transactions')
      .select(`
        id, transaction_date, quantity_liters, transaction_type, unit_cost,
        diesel_warehouses!inner(name, product_type),
        horometer_reading, kilometer_reading, previous_horometer, previous_kilometer,
        notes
      `)
      .eq('diesel_warehouses.product_type', 'diesel')
      .eq('asset_id', assetId)
      .eq('transaction_type', 'consumption')
      .neq('is_transfer', true)
      .gte('transaction_date', startISO)
      .lte('transaction_date', endISOInclusive)
      .order('transaction_date', { ascending: false })

    // Maintenance breakdown (reuse existing endpoint for purchase orders)
    const paramsPO = new URLSearchParams({ startDate: startISO, endDate: endISOInclusive, assetId })
    const host = url.host
    const base = process.env.NEXT_PUBLIC_BASE_URL || (host.includes('localhost') ? `http://${host}` : `https://${host}`)
    const poPromise = fetch(`${base}/api/reports/executive/purchase-orders?${paramsPO.toString()}`)

    // Remisiones per-day from Cotizador sales_assets_daily
    // Note: This view is now a materialized view (mv_sales_assets_daily) for performance.
    // It refreshes automatically every hour at :30 past the hour, so data may be up to 1 hour old.
    // The view name remains the same (aliased).
    let remisionesDaily: any[] = []
    try {
      if (!process.env.COTIZADOR_SUPABASE_URL || !process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Missing cotizador env configuration')
      }

      const cotizador = createClient(
        process.env.COTIZADOR_SUPABASE_URL,
        process.env.COTIZADOR_SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      )

      // Map to cotizador plant IDs via plant code
      const { data: cotizadorPlants } = await cotizador
        .from('plants')
        .select('id, code')

      const plantCode = (asset as any).plants?.code as string | undefined
      const cotizadorPlantId = plantCode ? (cotizadorPlants || []).find(p => p.code === plantCode)?.id : undefined

      // Build assetNames filter list
      const names: string[] = []
      ;(mappingsRes.data || []).forEach(m => m.external_unit && names.push(m.external_unit))
      if (asset.asset_id) names.push(asset.asset_id)

      let salesQuery = cotizador
        .from('sales_assets_daily')
        .select('*')
        .gte('day', startDate)
        .lte('day', endDate)

      if (cotizadorPlantId) salesQuery = salesQuery.eq('plant_id', cotizadorPlantId)
      if (names.length > 0) salesQuery = salesQuery.in('asset_name', Array.from(new Set(names)))

      const { data: salesDaily, error: salesErr } = await salesQuery.order('day')
      if (salesErr) throw salesErr

      remisionesDaily = (salesDaily || []).map((r: any) => ({
        day: r.day,
        remisiones_count: Number(r.remisiones_count || 0),
        remisiones_concrete_count: Number(r.remisiones_concrete_count || 0),
        concrete_m3: Number(r.concrete_m3 || 0),
        subtotal_amount: Number(r.subtotal_amount || 0),
        total_amount_with_vat: Number(r.total_amount_with_vat || 0)
      }))
    } catch (e) {
      // If remisiones fails, keep empty array; do not fail the whole response
      remisionesDaily = []
    }

    // Checklist readings for hours/km progression (extended window for baseline)
    const extendedStart = new Date(startISO)
    extendedStart.setDate(extendedStart.getDate() - 30)
    const checklistPromise = supabase
      .from('completed_checklists')
      .select('completion_date, equipment_hours_reading, equipment_kilometers_reading')
      .eq('asset_id', assetId)
      .gte('completion_date', extendedStart.toISOString().slice(0, 10))
      .lte('completion_date', endDate)
      .or('equipment_hours_reading.not.is.null,equipment_kilometers_reading.not.is.null')
      .order('completion_date', { ascending: true })

    // Additional expenses for the asset in the window
    const additionalExpensesPromise = supabase
      .from('additional_expenses')
      .select('id, amount, created_at, adjustment_po_id')
      .eq('asset_id', assetId)
      .gte('created_at', startISO)
      .lte('created_at', endISOInclusive)
      .order('created_at', { ascending: false })

    const [dieselRes, poRes, additionalExpensesRes, checklistRes] = await Promise.all([
      dieselPromise, poPromise, additionalExpensesPromise, checklistPromise
    ])

    const diesel = dieselRes.data || []
    const dieselError = dieselRes.error
    if (dieselError) {
      console.warn('Diesel breakdown error:', dieselError)
    }

    let purchaseOrders: any[] = []
    if (poRes.ok) {
      const json = await poRes.json()
      purchaseOrders = json.purchase_orders || []
    }

    // Only show additional expenses that are pending conversion (no adjustment_po_id)
    const additional_expenses = (additionalExpensesRes.data || []).filter((ae: any) => !ae.adjustment_po_id)

    // Compute efficiency metrics (hours_worked, liters_per_hour, kilometers_worked, liters_per_km)
    // Use incremental deltas WITHIN the report period only (same logic as gerencial report)
    // This prevents inflating km by including checklist readings from 30 days before the period
    const totalLiters = diesel.reduce((sum: number, t: any) => sum + Number(t.quantity_liters || 0), 0)
    type ReadingEvent = { ts: number; val: number }
    const startMs = new Date(startISO).getTime()
    const endMs = new Date(endISOInclusive).getTime()

    const buildProgression = (
      readings: { ts: number; val: number }[],
      maxPerDay: number
    ): number => {
      if (readings.length < 2) return 0
      readings.sort((a, b) => a.ts - b.ts)
      let baselineIdx = -1
      for (let i = readings.length - 1; i >= 0; i--) {
        if (readings[i].ts < startMs) {
          baselineIdx = i
          break
        }
      }
      if (baselineIdx === -1) {
        for (let i = 0; i < readings.length; i++) {
          if (readings[i].ts >= startMs) {
            baselineIdx = i
            break
          }
        }
      }
      if (baselineIdx === -1 || baselineIdx >= readings.length - 1) return 0
      let total = 0
      for (let i = baselineIdx; i < readings.length - 1; i++) {
        const current = readings[i]
        const next = readings[i + 1]
        if (next.ts < startMs) continue
        if (current.ts >= endMs) break
        const delta = next.val - current.val
        if (delta < 0) continue
        const timeDeltaDays = (next.ts - current.ts) / (1000 * 60 * 60 * 24)
        if (timeDeltaDays < 1 / 24) continue
        const rate = timeDeltaDays > 0 ? delta / timeDeltaDays : 0
        if (rate > maxPerDay && timeDeltaDays < 60) continue
        let capped = delta
        if (timeDeltaDays > 0) {
          const maxReasonable = maxPerDay * timeDeltaDays
          if (delta > maxReasonable) capped = maxReasonable
        }
        total += capped
      }
      return total
    }

    // Hours: diesel + checklist (include previous_horometer for baseline)
    const hoursEvents: ReadingEvent[] = []
    diesel.forEach((t: any) => {
      const ts = new Date(t.transaction_date).getTime()
      if (t.previous_horometer != null) hoursEvents.push({ ts: ts - 1, val: Number(t.previous_horometer) })
      if (t.horometer_reading != null) hoursEvents.push({ ts, val: Number(t.horometer_reading) })
    })
    ;(checklistRes.data || []).forEach((c: any) => {
      if (c.equipment_hours_reading != null) {
        hoursEvents.push({ ts: new Date(c.completion_date).getTime(), val: Number(c.equipment_hours_reading) })
      }
    })
    const hours_worked = buildProgression(hoursEvents, 24) // max 24 hours/day
    const liters_per_hour = hours_worked > 0 && totalLiters > 0 ? totalLiters / hours_worked : null

    // Km: diesel + checklist (incremental deltas within period)
    const kmEvents: ReadingEvent[] = []
    diesel.forEach((t: any) => {
      const ts = new Date(t.transaction_date).getTime()
      if (t.previous_kilometer != null) kmEvents.push({ ts: ts - 1, val: Number(t.previous_kilometer) })
      if (t.kilometer_reading != null) kmEvents.push({ ts, val: Number(t.kilometer_reading) })
    })
    ;(checklistRes.data || []).forEach((c: any) => {
      if (c.equipment_kilometers_reading != null) {
        kmEvents.push({ ts: new Date(c.completion_date).getTime(), val: Number(c.equipment_kilometers_reading) })
      }
    })
    const kilometers_worked = buildProgression(kmEvents, 1000) // max 1000 km/day
    const liters_per_km = kilometers_worked > 0 && totalLiters > 0 ? totalLiters / kilometers_worked : null

    return NextResponse.json({
      asset: {
        id: asset.id,
        code: asset.asset_id,
        name: asset.name,
        plant: (asset as any).plants?.name || 'N/A'
      },
      diesel,
      remisionesDaily,
      maintenance: {
        purchase_orders: purchaseOrders,
        additional_expenses
      },
      efficiency: {
        hours_worked,
        liters_per_hour,
        kilometers_worked,
        liters_per_km
      }
    })
  } catch (error: any) {
    console.error('Gerencial asset breakdown error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}


