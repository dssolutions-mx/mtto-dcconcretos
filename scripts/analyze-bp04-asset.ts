/**
 * Analyze BP-04 asset: diesel transactions and checklist readings for km/hours
 * Run: npx tsx scripts/analyze-bp04-asset.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyze() {
  console.log('\n' + '='.repeat(80))
  console.log('BP-04 Asset Analysis')
  console.log('='.repeat(80))

  // 1. Find BP-04 asset
  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .select('id, asset_id, name, current_hours, current_kilometers')
    .or('asset_id.eq.BP-04,name.ilike.%BP-04%')
    .limit(1)
    .maybeSingle()

  if (assetErr || !asset) {
    console.error('Asset not found:', assetErr?.message)
    process.exit(1)
  }
  console.log('\n📋 Asset:', asset.name, `(${asset.asset_id})`, 'id:', asset.id)
  console.log('   Current km:', asset.current_kilometers ?? 'NULL')

  const assetId = asset.id

  // 2. Diesel transactions 2026 (diesel only)
  const { data: diesel, error: dieselErr } = await supabase
    .from('diesel_transactions')
    .select(`
      id, transaction_date, quantity_liters,
      horometer_reading, previous_horometer,
      kilometer_reading, previous_kilometer,
      diesel_warehouses!inner(product_type, name)
    `)
    .eq('asset_id', assetId)
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('transaction_type', 'consumption')
    .neq('is_transfer', true)
    .gte('transaction_date', '2026-01-01')
    .lte('transaction_date', '2026-12-31')
    .order('transaction_date', { ascending: true })

  if (dieselErr) {
    console.error('Diesel error:', dieselErr)
    process.exit(1)
  }

  console.log('\n📊 Diesel transactions (2026, diesel only):', diesel?.length ?? 0)
  const totalLiters = diesel?.reduce((s, t) => s + Number(t.quantity_liters || 0), 0) ?? 0
  console.log('   Total liters:', totalLiters)

  const withKm = diesel?.filter((t: any) => t.kilometer_reading != null || t.previous_kilometer != null) ?? []
  console.log('   Tx with km readings:', withKm.length)

  if (withKm.length > 0) {
    console.log('\n   Diesel km readings (chronological):')
    const sorted = [...withKm].sort(
      (a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    )
    sorted.forEach((t: any, i: number) => {
      const d = (t.transaction_date || '').slice(0, 10)
      const prev = t.previous_kilometer ?? '-'
      const curr = t.kilometer_reading ?? '-'
      const delta = t.previous_kilometer != null && t.kilometer_reading != null
        ? t.kilometer_reading - t.previous_kilometer
        : '-'
      console.log(`      ${i + 1}. ${d}  prev=${prev} → curr=${curr}  delta=${delta}`)
    })

    const firstPrev = sorted[0]?.previous_kilometer
    const lastCurr = sorted[sorted.length - 1]?.kilometer_reading
    if (firstPrev != null && lastCurr != null) {
      const simpleProg = lastCurr - firstPrev
      console.log('\n   Simple progression (last.curr - first.prev):', simpleProg, 'km')
    }
  }

  // 3. Checklist km readings
  const { data: checklists, error: chkErr } = await supabase
    .from('completed_checklists')
    .select('completion_date, equipment_hours_reading, equipment_kilometers_reading')
    .eq('asset_id', assetId)
    .or('equipment_hours_reading.not.is.null,equipment_kilometers_reading.not.is.null')
    .gte('completion_date', '2025-12-01')
    .lte('completion_date', '2026-12-31')
    .order('completion_date', { ascending: true })

  if (chkErr) {
    console.error('Checklist error:', chkErr)
  } else {
    const withChkKm = checklists?.filter((c: any) => c.equipment_kilometers_reading != null) ?? []
    console.log('\n📋 Checklist km readings (Dec 2025 - Dec 2026):', withChkKm.length)
    if (withChkKm.length > 0) {
      withChkKm.slice(0, 5).forEach((c: any, i: number) => {
        console.log(`      ${i + 1}. ${(c.completion_date || '').slice(0, 10)}  km=${c.equipment_kilometers_reading}`)
      })
      if (withChkKm.length > 5) console.log(`      ... and ${withChkKm.length - 5} more`)
      const first = withChkKm[0]?.equipment_kilometers_reading
      const last = withChkKm[withChkKm.length - 1]?.equipment_kilometers_reading
      if (first != null && last != null) {
        console.log('\n   Checklist span (first→last):', first, '→', last, '=', last - first, 'km')
      }
    }
  }

  // 4. Merged timeline (diesel + checklist)
  type R = { ts: number; km: number | null; source: string }
  const all: R[] = []
  diesel?.forEach((t: any) => {
    const ts = new Date(t.transaction_date).getTime()
    if (t.previous_kilometer != null) all.push({ ts: ts - 1, km: t.previous_kilometer, source: 'diesel_prev' })
    if (t.kilometer_reading != null) all.push({ ts, km: t.kilometer_reading, source: 'diesel_curr' })
  })
  checklists?.forEach((c: any) => {
    if (c.equipment_kilometers_reading != null) {
      all.push({
        ts: new Date(c.completion_date).getTime(),
        km: c.equipment_kilometers_reading,
        source: 'checklist'
      })
    }
  })
  all.sort((a, b) => a.ts - b.ts)

  const readingsWithKm = all.filter((r) => r.km != null)
  if (readingsWithKm.length >= 2) {
    const first = readingsWithKm[0]
    const last = readingsWithKm[readingsWithKm.length - 1]
    const span = (last.km ?? 0) - (first.km ?? 0)
    console.log('\n📐 MERGED (diesel + checklist) first→last:')
    console.log('   First:', new Date(first.ts).toISOString().slice(0, 10), 'km=', first.km, '(' + first.source + ')')
    console.log('   Last:', new Date(last.ts).toISOString().slice(0, 10), 'km=', last.km, '(' + last.source + ')')
    console.log('   Span:', span, 'km  ← this was the OLD (inflated) calculation')
  }

  console.log('\n' + '='.repeat(80))
}

analyze().catch((e) => {
  console.error(e)
  process.exit(1)
})
