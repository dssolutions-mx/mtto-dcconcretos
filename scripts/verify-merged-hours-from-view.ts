/**
 * Compare merged operating hours (table pipeline vs unified view rowset).
 * Usage: npx tsx scripts/verify-merged-hours-from-view.ts [assetUuid] [YYYY-MM-DD-from] [YYYY-MM-DD-to]
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

import {
  buildMergedHoursReadingEventsForAsset,
  checklistReadingEventTimeMs,
  mergedHoursFromEvents,
} from '../lib/reports/merged-operating-hours'
import {
  fetchMeterViewRowsMatchingMergedTableWindows,
  splitMeterViewRowsForMergedHours,
} from '../lib/reports/merged-hours-view-parity'
import { resolveTrustedOperatingHours } from '../lib/reports/diesel-efficiency-hours-policy'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function cloneEvents(ev: Array<{ ts: number; val: number }>) {
  return ev.map((e) => ({ ...e }))
}

async function pickAssetWithDiesel(): Promise<string | null> {
  const { data, error } = await supabase
    .from('diesel_transactions')
    .select('asset_id')
    .not('asset_id', 'is', null)
    .not('horometer_reading', 'is', null)
    .eq('transaction_type', 'consumption')
    .eq('is_transfer', false)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.asset_id ?? null
}

async function main() {
  const argv = process.argv.slice(2)
  let assetId = argv[0]
  const dateFromStr = argv[1] ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dateToStr = argv[2] ?? new Date().toISOString().slice(0, 10)

  if (!assetId || !/^[0-9a-f-]{36}$/i.test(assetId)) {
    assetId = (await pickAssetWithDiesel()) || ''
    if (!assetId) {
      console.error('No asset id')
      process.exit(1)
    }
    console.log(`Auto asset_id=${assetId}\n`)
  }

  const dateFromStart = new Date(`${dateFromStr}T00:00:00.000Z`)
  const dateToExclusive = new Date(`${dateToStr}T00:00:00.000Z`)
  dateToExclusive.setUTCDate(dateToExclusive.getUTCDate() + 1)
  const dateToExclusiveStr = dateToExclusive.toISOString().slice(0, 10)
  const extendedStart = new Date(dateFromStart)
  extendedStart.setUTCDate(extendedStart.getUTCDate() - 30)
  const extendedStartDateStr = extendedStart.toISOString().slice(0, 10)
  const startMs = dateFromStart.getTime()
  const endMs = dateToExclusive.getTime()

  const { data: hoursData, error: he } = await supabase
    .from('completed_checklists')
    .select('asset_id, equipment_hours_reading, reading_timestamp, completion_date')
    .eq('asset_id', assetId)
    .gte('completion_date', extendedStartDateStr)
    .lt('completion_date', dateToExclusiveStr)
    .not('equipment_hours_reading', 'is', null)

  if (he) throw he

  const { data: dieselTxsExtended, error: de } = await supabase
    .from('diesel_transactions')
    .select(
      `
        asset_id,
        transaction_date,
        horometer_reading,
        diesel_warehouses!inner(product_type),
        diesel_products!inner(product_type)
      `
    )
    .eq('asset_id', assetId)
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('diesel_products.product_type', 'diesel')
    .neq('is_transfer', true)
    .eq('transaction_type', 'consumption')
    .gte('transaction_date', extendedStartDateStr)
    .lt('transaction_date', dateToExclusiveStr)
    .not('horometer_reading', 'is', null)

  if (de) throw de

  const txs = (dieselTxsExtended ?? []) as Array<{
    transaction_date: string
    horometer_reading?: number | null
  }>

  const chkEvents: Array<{ ts: number; val: number }> = []
  for (const h of hoursData ?? []) {
    if (!h.asset_id) continue
    const val = Number(h.equipment_hours_reading)
    const ts = checklistReadingEventTimeMs({
      reading_timestamp: h.reading_timestamp,
      completion_date: h.completion_date as string,
    })
    if (Number.isNaN(val) || Number.isNaN(ts)) continue
    chkEvents.push({ ts, val })
  }

  const eventsTable = buildMergedHoursReadingEventsForAsset({
    dieselTxs: txs,
    checklistReadingEvents: chkEvents,
  })

  const viewRows = await fetchMeterViewRowsMatchingMergedTableWindows(
    supabase,
    assetId,
    extendedStartDateStr,
    dateToExclusiveStr
  )
  const { dieselTxs: d2, checklistReadingEvents: c2 } = splitMeterViewRowsForMergedHours(viewRows)
  const eventsView = buildMergedHoursReadingEventsForAsset({
    dieselTxs: d2,
    checklistReadingEvents: c2,
  })

  const { data: periodTxsB, error: pe2 } = await supabase
    .from('diesel_transactions')
    .select(
      `
      hours_consumed,
      kilometers_consumed,
      transaction_type,
      asset_id,
      diesel_warehouses!inner(product_type),
      diesel_products!inner(product_type)
    `
    )
    .eq('asset_id', assetId)
    .eq('transaction_type', 'consumption')
    .eq('is_transfer', false)
    .gte('transaction_date', dateFromStr)
    .lt('transaction_date', dateToExclusiveStr)
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('diesel_products.product_type', 'diesel')

  if (pe2) throw pe2

  const consumed = (periodTxsB ?? []).reduce(
    (s, t: { hours_consumed?: number | null }) => s + Number(t.hours_consumed || 0),
    0
  )

  const mergedTable = mergedHoursFromEvents(cloneEvents(eventsTable), startMs, endMs)
  const mergedView = mergedHoursFromEvents(cloneEvents(eventsView), startMs, endMs)
  const finalTable = resolveTrustedOperatingHours(mergedTable, consumed).trusted
  const finalView = resolveTrustedOperatingHours(mergedView, consumed).trusted

  console.log('=== merged hours: table pipeline vs view rowset (same source_ids) ===')
  console.log(`asset=${assetId} report [${dateFromStr}, ${dateToExclusiveStr}) ext window checklist+diesel`)
  console.log(`events built: table=${eventsTable.length} view=${eventsView.length}`)
  console.log(`mergedHoursFromEvents: table=${mergedTable.toFixed(4)} view=${mergedView.toFixed(4)}`)
  console.log(`trusted hours (merged-first policy): table=${finalTable.toFixed(4)} view=${finalView.toFixed(4)}`)
  const hoursMatch = Math.abs(finalTable - finalView) < 0.01
  console.log(`HOURS FINAL MATCH: ${hoursMatch ? 'YES' : 'NO'} (eps 0.01)\n`)

  const { data: viewKmRows, error: vk } = await supabase
    .from('asset_meter_reading_events')
    .select('km_consumed')
    .eq('asset_id', assetId)
    .eq('source_kind', 'diesel_consumption')
    .gte('event_at', `${dateFromStr}T00:00:00.000Z`)
    .lt('event_at', dateToExclusive.toISOString())
    .not('km_consumed', 'is', null)

  if (vk) throw vk
  const viewKmSum = (viewKmRows ?? []).reduce(
    (s, r: { km_consumed?: number | null }) => s + Number(r.km_consumed ?? 0),
    0
  )
  const directKmSum = (periodTxsB ?? []).reduce(
    (s, t: { kilometers_consumed?: number | null }) => s + Number(t.kilometers_consumed || 0),
    0
  )
  console.log('=== diesel km_consumed sum (report window only, no merged km curve) ===')
  console.log(`  view sum km_consumed:   ${viewKmSum.toFixed(4)}`)
  console.log(`  table sum km_consumed:  ${directKmSum.toFixed(4)}`)
  console.log(`  KM SUM MATCH: ${Math.abs(viewKmSum - directKmSum) < 0.01 ? 'YES' : 'NO'}\n`)

  if (!hoursMatch) {
    console.log('Mismatch hints: view row count vs table diesel+checklist id list; diesel_products join on merged fetch.')
  }

  process.exit(hoursMatch && Math.abs(viewKmSum - directKmSum) < 0.01 ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
