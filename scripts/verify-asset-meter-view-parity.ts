/**
 * Compare unified view `asset_meter_reading_events` to direct table queries
 * used by report APIs (diesel filters; checklist event time = merged-hours rule).
 *
 * Usage:
 *   npx tsx scripts/verify-asset-meter-view-parity.ts [assetUuid] [YYYY-MM-DD-from] [YYYY-MM-DD-to]
 *
 * If assetUuid is omitted, picks an asset with recent diesel consumption.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

import { checklistReadingEventTimeMs } from '../lib/reports/merged-operating-hours'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and a key in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

function toExclusiveEnd(dateTo: string): Date {
  const d = new Date(`${dateTo}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d
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

  if (error) {
    console.error('pickAsset:', error)
    return null
  }
  return data?.asset_id ?? null
}

async function main() {
  const argv = process.argv.slice(2)
  let assetId = argv[0]
  const dateFrom = argv[1] ?? new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dateTo = argv[2] ?? new Date().toISOString().slice(0, 10)

  if (!assetId || !/^[0-9a-f-]{36}$/i.test(assetId)) {
    assetId = (await pickAssetWithDiesel()) || ''
    if (!assetId) {
      console.error('No asset id provided and could not pick one from diesel_transactions.')
      process.exit(1)
    }
    console.log(`Using asset_id=${assetId} (auto-picked)\n`)
  }

  const fromIso = `${dateFrom}T00:00:00.000Z`
  const toExclusive = toExclusiveEnd(dateTo)
  const toExclusiveIso = toExclusive.toISOString()
  const dateToExclusiveStr = toExclusive.toISOString().slice(0, 10)

  console.log('=== asset_meter_reading_events vs source tables ===')
  console.log(`asset_id=${assetId}`)
  console.log(`window: event_at / transaction_date in [${fromIso}, ${toExclusiveIso}) (end exclusive)\n`)

  // --- View: diesel slice
  const { data: viewDiesel, error: ve1 } = await supabase
    .from('asset_meter_reading_events')
    .select('hours_consumed')
    .eq('asset_id', assetId)
    .eq('source_kind', 'diesel_consumption')
    .gte('event_at', fromIso)
    .lt('event_at', toExclusiveIso)

  if (ve1) {
    console.error('view diesel:', ve1)
    process.exit(1)
  }

  const viewDieselCount = viewDiesel?.length ?? 0
  const viewDieselSumHours = (viewDiesel ?? []).reduce(
    (s, r) => s + Number(r.hours_consumed ?? 0),
    0
  )

  // --- Direct: diesel (same joins/filters as view)
  const { data: directDieselB, error: de2 } = await supabase
    .from('diesel_transactions')
    .select(
      `
      id,
      hours_consumed,
      transaction_date,
      diesel_warehouses!inner(product_type),
      diesel_products!inner(product_type)
    `
    )
    .eq('asset_id', assetId)
    .eq('transaction_type', 'consumption')
    .eq('is_transfer', false)
    .eq('diesel_warehouses.product_type', 'diesel')
    .eq('diesel_products.product_type', 'diesel')
    .gte('transaction_date', fromIso.slice(0, 10))
    .lt('transaction_date', dateToExclusiveStr)
    .not('horometer_reading', 'is', null)

  if (de2) {
    console.error('direct diesel:', de2)
    process.exit(1)
  }

  const rows = directDieselB ?? []
  const directCount = rows.length
  const directSumHours = rows.reduce((s, r: { hours_consumed?: number | null }) => {
    return s + Number(r.hours_consumed ?? 0)
  }, 0)

  console.log('Diesel consumption (horometer present, date window)')
  console.log(`  view rows:        ${viewDieselCount}`)
  console.log(`  direct rows:      ${directCount}`)
  console.log(`  view sum hours_consumed:  ${viewDieselSumHours.toFixed(2)}`)
  console.log(`  direct sum hours_consumed: ${directSumHours.toFixed(2)}`)
  console.log(
    `  MATCH rows: ${viewDieselCount === directCount ? 'YES' : 'NO'} | MATCH sum: ${Math.abs(viewDieselSumHours - directSumHours) < 0.01 ? 'YES' : 'NO'}\n`
  )

  // --- View: checklist slice (same window on event_at)
  const { data: viewChk, error: ve2 } = await supabase
    .from('asset_meter_reading_events')
    .select('source_id, event_at')
    .eq('asset_id', assetId)
    .eq('source_kind', 'checklist_completion')
    .gte('event_at', fromIso)
    .lt('event_at', toExclusiveIso)

  if (ve2) {
    console.error('view checklist:', ve2)
    process.exit(1)
  }

  const viewChkCount = viewChk?.length ?? 0

  // --- Direct: checklists with merged event time in window
  const { data: chkRows, error: ce } = await supabase
    .from('completed_checklists')
    .select('id, reading_timestamp, completion_date, equipment_hours_reading, equipment_kilometers_reading')
    .eq('asset_id', assetId)

  if (ce) {
    console.error('checklists:', ce)
    process.exit(1)
  }

  const fromMs = new Date(fromIso).getTime()
  const toMs = new Date(toExclusiveIso).getTime()
  let directChkInWindow = 0
  for (const r of chkRows ?? []) {
    const hasReading =
      r.equipment_hours_reading != null || r.equipment_kilometers_reading != null
    if (!hasReading) continue
    const ts = checklistReadingEventTimeMs({
      reading_timestamp: r.reading_timestamp,
      completion_date: r.completion_date as string,
    })
    if (ts >= fromMs && ts < toMs) directChkInWindow++
  }

  console.log('Checklist meter rows (event time in window; merged-hours timestamp rule)')
  console.log(`  view rows:   ${viewChkCount}`)
  console.log(`  direct rows: ${directChkInWindow}`)
  console.log(`  MATCH: ${viewChkCount === directChkInWindow ? 'YES' : 'NO'}\n`)

  // --- Audit rows in window (informational)
  const { data: viewAudit, error: ve3 } = await supabase
    .from('asset_meter_reading_events')
    .select('source_id, row_source')
    .eq('asset_id', assetId)
    .eq('source_kind', 'asset_field_audit')
    .gte('event_at', fromIso)
    .lt('event_at', toExclusiveIso)

  if (!ve3) {
    console.log(`Asset field audit rows in window: ${(viewAudit ?? []).length}`)
  }

  console.log(
    'Note: merged "hours worked" APIs still apply diesel jump filtering and checklist banding;',
    'this script only checks raw view parity with table filters + checklist event time.'
  )

  const bad =
    viewDieselCount !== directCount ||
    Math.abs(viewDieselSumHours - directSumHours) >= 0.01 ||
    viewChkCount !== directChkInWindow
  process.exit(bad ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
