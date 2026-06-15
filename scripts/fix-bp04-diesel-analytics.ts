/**
 * Fix BP-04 diesel transactions for correct analytics:
 * - Set composite primary_component_id to truck (chassis)
 * - Re-link consumption from composite, pump, and exception "BP-04" to truck
 * - Parse meter readings from notes where plausible
 * - Re-chain previous_horometer / previous_kilometer on truck chronologically
 * - Refresh truck asset current readings from latest diesel tx
 *
 * Run: npx tsx scripts/fix-bp04-diesel-analytics.ts
 *      npx tsx scripts/fix-bp04-diesel-analytics.ts --apply
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const TRUCK_ID = 'ce82ced6-7a45-47f0-94cb-3ef7a89a2800'
const COMPOSITE_ID = 'e0812759-0190-4de9-8072-b1c8aebe6415'
const PUMP_ID = '0683539d-8adf-4ff6-86dc-95ba6d28446c'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const apply = process.argv.includes('--apply')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function parseNotesMeters(notes: string | null): { hr: number | null; km: number | null } {
  if (!notes) return { hr: null, km: null }
  const m = notes.match(/HR\s*([\d.,]+)\s*[-–]\s*KM\s*([\d.,]+)/i)
  if (!m) return { hr: null, km: null }
  const hr = parseFloat(m[1].replace(',', '.'))
  const km = parseFloat(m[2].replace(',', '.'))
  return {
    hr: Number.isFinite(hr) ? hr : null,
    km: Number.isFinite(km) ? km : null,
  }
}

/** Truck-scale horometer (not pump ~1.4k) */
function isTruckScaleHorometer(hr: number | null): boolean {
  return hr != null && hr > 3000
}

async function main() {
  console.log(apply ? '=== APPLY MODE ===' : '=== DRY RUN ===\n')

  // 1. Primary component = truck (chassis receives fuel)
  console.log('1. Set primary_component_id → truck (BP-04 chassis)')
  if (apply) {
    const { error } = await supabase
      .from('assets')
      .update({ primary_component_id: TRUCK_ID })
      .eq('id', COMPOSITE_ID)
    if (error) throw error
  }

  // 2. Load all BP-04-related consumption txs
  const { data: txs, error: txErr } = await supabase
    .from('diesel_transactions')
    .select(
      `
      id,
      transaction_id,
      transaction_date,
      created_at,
      asset_id,
      asset_category,
      exception_asset_name,
      horometer_reading,
      kilometer_reading,
      previous_horometer,
      previous_kilometer,
      notes,
      quantity_liters,
      diesel_products!inner(product_type)
    `
    )
    .eq('transaction_type', 'consumption')
    .eq('diesel_products.product_type', 'diesel')
    .neq('is_transfer', true)
    .or(
      `asset_id.in.(${COMPOSITE_ID},${TRUCK_ID},${PUMP_ID}),exception_asset_name.ilike.%BP-04%`
    )
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (txErr) throw txErr
  const list = txs ?? []
  console.log(`2. Found ${list.length} diesel consumption rows to review\n`)

  const updates: Array<{
    id: string
    transaction_id: string
    patch: Record<string, unknown>
    reason: string
  }> = []

  for (const tx of list) {
    const id = tx.id as string
    const tid = tx.transaction_id as string
    const assetId = tx.asset_id as string | null
    const notes = (tx.notes as string | null) ?? null
    const isException =
      tx.asset_category === 'exception' ||
      (tx.exception_asset_name as string | null)?.toUpperCase().includes('BP-04')

    let patch: Record<string, unknown> = {}
    let reason = ''

    if (assetId === TRUCK_ID && !isException) {
      continue // already correct
    }

    if (assetId === COMPOSITE_ID) {
      reason = 'composite_parent → truck'
      patch = {
        asset_id: TRUCK_ID,
        asset_category: 'formal',
        exception_asset_name: null,
      }
      // Keep horometer/kilometer (already truck-scale on composite rows)
    } else if (assetId === PUMP_ID) {
      reason = 'pump → truck (fuel on chassis)'
      const hr = tx.horometer_reading != null ? Number(tx.horometer_reading) : null
      const km = tx.kilometer_reading != null ? Number(tx.kilometer_reading) : null
      patch = {
        asset_id: TRUCK_ID,
        asset_category: 'formal',
        exception_asset_name: null,
        horometer_reading: isTruckScaleHorometer(hr) ? hr : null,
        kilometer_reading: km,
      }
    } else if (isException && !assetId) {
      const isAjusteOnly =
        notes?.toLowerCase().includes('ajuste') && !notes.match(/HR\s*[\d]/i)
      reason = isAjusteOnly
        ? 'exception → truck (liters only, ajuste)'
        : 'exception → truck'

      const parsed = parseNotesMeters(notes)
      patch = {
        asset_id: TRUCK_ID,
        asset_category: 'formal',
        exception_asset_name: null,
      }
      if (parsed.hr != null && isTruckScaleHorometer(parsed.hr)) {
        patch.horometer_reading = parsed.hr
        patch.kilometer_reading = parsed.km
      } else if (!isAjusteOnly && tx.horometer_reading == null) {
        // Keep meters null; liters still count for analytics
        patch.horometer_reading = null
        patch.kilometer_reading = null
      }
      if (isAjusteOnly) {
        patch.requires_validation = true
        patch.validation_notes =
          (notes ? `${notes} | ` : '') + 'Migrado desde equipo externo BP-04 (ajuste)'
      }
    } else {
      continue
    }

    updates.push({ id, transaction_id: tid, patch, reason })
    console.log(`  ${tid}: ${reason}`)
  }

  console.log(`\n3. Applying ${updates.length} transaction patches...`)
  if (apply) {
    for (const u of updates) {
      const { error } = await supabase.from('diesel_transactions').update(u.patch).eq('id', u.id)
      if (error) {
        console.error(`  FAIL ${u.transaction_id}:`, error.message)
      }
    }
  }

  // 4. Re-chain previous meters on truck (all diesel consumption on truck)
  console.log('\n4. Re-chain previous_horometer / previous_kilometer on truck')
  const { data: truckTxs, error: truckErr } = await supabase
    .from('diesel_transactions')
    .select(
      `
      id,
      transaction_id,
      transaction_date,
      created_at,
      horometer_reading,
      kilometer_reading,
      diesel_products!inner(product_type)
    `
    )
    .eq('asset_id', TRUCK_ID)
    .eq('transaction_type', 'consumption')
    .eq('diesel_products.product_type', 'diesel')
    .neq('is_transfer', true)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (truckErr) throw truckErr

  let lastHr: number | null = null
  let lastKm: number | null = null
  let chainUpdates = 0

  for (const tx of truckTxs ?? []) {
    const hr =
      tx.horometer_reading != null ? Number(tx.horometer_reading) : null
    const km =
      tx.kilometer_reading != null ? Number(tx.kilometer_reading) : null

    const chainPatch: Record<string, number | null> = {
      previous_horometer: hr != null ? lastHr : null,
      previous_kilometer: km != null ? lastKm : null,
    }

    if (apply) {
      await supabase.from('diesel_transactions').update(chainPatch).eq('id', tx.id)
    }
    chainUpdates++

    if (hr != null) lastHr = hr
    if (km != null) lastKm = km
  }
  console.log(`   ${chainUpdates} truck rows re-chained`)

  // 5. Update truck asset current readings from latest tx with meters
  const withMeters = (truckTxs ?? []).filter((t) => t.horometer_reading != null)
  const latest = withMeters[withMeters.length - 1]
  if (latest) {
    const curH = Number(latest.horometer_reading)
    const curK =
      latest.kilometer_reading != null ? Number(latest.kilometer_reading) : null
    console.log(
      `\n5. Truck asset readings → ${curH} h` +
        (curK != null ? `, ${curK} km` : '')
    )
    if (apply) {
      await supabase
        .from('assets')
        .update({
          current_hours: curH,
          ...(curK != null ? { current_kilometers: curK } : {}),
        })
        .eq('id', TRUCK_ID)
    }
  }

  // 6. Restore pump meters from latest checklist (diesel txs polluted pump row)
  const { data: chk } = await supabase
    .from('completed_checklists')
    .select('equipment_hours_reading, equipment_kilometers_reading, completion_date')
    .eq('asset_id', PUMP_ID)
    .not('equipment_hours_reading', 'is', null)
    .order('completion_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (chk?.equipment_hours_reading != null) {
    console.log(
      `\n6. Pump asset readings from checklist → ${chk.equipment_hours_reading} h, ${chk.equipment_kilometers_reading ?? '—'} km`
    )
    if (apply) {
      await supabase
        .from('assets')
        .update({
          current_hours: Number(chk.equipment_hours_reading),
          current_kilometers:
            chk.equipment_kilometers_reading != null
              ? Number(chk.equipment_kilometers_reading)
              : null,
        })
        .eq('id', PUMP_ID)
    }
  }

  // 7. Strip pump-scale horometers wrongly stored on truck (< 10k h)
  console.log('\n7. Clear truck rows with pump-scale horometer (< 10000 h)')
  if (apply) {
    const { data: cleared } = await supabase
      .from('diesel_transactions')
      .update({
        horometer_reading: null,
        previous_horometer: null,
        kilometer_reading: null,
        previous_kilometer: null,
      })
      .eq('asset_id', TRUCK_ID)
      .eq('transaction_type', 'consumption')
      .not('horometer_reading', 'is', null)
      .lt('horometer_reading', 10000)
      .select('id')
    console.log(`   cleared ${cleared?.length ?? 0} rows`)
  }

  console.log(
    apply
      ? '\nDone. POST /api/reports/asset-diesel-efficiency with yearMonths 2026-01..2026-05 to refresh rollups.'
      : '\nDry run complete. Re-run with --apply to persist.'
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
