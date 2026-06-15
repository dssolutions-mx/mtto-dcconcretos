/**
 * Backfill primary_component_id on composite assets missing it.
 * Default: first component in component_assets (stable order from array).
 *
 * Audit mode (no --apply): lists composites without primary and diesel txs on wrong targets.
 *
 * Run:
 *   npx tsx scripts/backfill-composite-primary-component.ts
 *   npx tsx scripts/backfill-composite-primary-component.ts --apply
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const apply = process.argv.includes('--apply')

async function main() {
  const { data: composites, error } = await supabase
    .from('assets')
    .select('id, name, asset_id, composite_type, component_assets, primary_component_id')
    .eq('is_composite', true)

  if (error) {
    console.error(error)
    process.exit(1)
  }

  const missingPrimary = (composites ?? []).filter((c) => !c.primary_component_id)
  console.log(`Composites: ${composites?.length ?? 0}, missing primary_component_id: ${missingPrimary.length}`)

  for (const comp of missingPrimary) {
    const ids = Array.isArray(comp.component_assets) ? comp.component_assets : []
    // Prefer chassis row (asset_id without "BOMBEO"/"Compuesto") for fuel primary
    const { data: compRows } = await supabase
      .from('assets')
      .select('id, asset_id, name')
      .in('id', ids)
    const chassis =
      (compRows ?? []).find(
        (a) =>
          a.asset_id &&
          !/compuesto|bomb|bomba|pump/i.test(a.asset_id) &&
          !/compuesto|bomb|bomba|pump/i.test(a.name ?? '')
      ) ?? null
    const primary = chassis?.id ?? ids[0]
    if (!primary) {
      console.warn(`  SKIP ${comp.asset_id || comp.name}: no components`)
      continue
    }
    console.log(
      `  ${comp.asset_id || comp.name} → primary ${primary}${apply ? ' (updating)' : ' (dry-run)'}`
    )
    if (apply) {
      const { error: upErr } = await supabase
        .from('assets')
        .update({ primary_component_id: primary })
        .eq('id', comp.id)
      if (upErr) console.error('    update failed:', upErr.message)
    }
  }

  const compositeIds = new Set((composites ?? []).map((c) => c.id))
  const componentToPrimary = new Map<string, string>()
  for (const c of composites ?? []) {
    if (c.primary_component_id) {
      const ids = Array.isArray(c.component_assets) ? c.component_assets : []
      for (const cid of ids) {
        if (cid !== c.primary_component_id) {
          componentToPrimary.set(cid, c.primary_component_id)
        }
      }
    }
  }

  const { data: misTargeted, error: txErr } = await supabase
    .from('diesel_transactions')
    .select('id, asset_id, transaction_type, quantity_liters, transaction_date')
    .eq('transaction_type', 'consumption')
    .not('asset_id', 'is', null)
    .limit(5000)

  if (txErr) {
    console.error(txErr)
    process.exit(1)
  }

  const audit: { id: string; asset_id: string; reason: string }[] = []
  for (const tx of misTargeted ?? []) {
    if (!tx.asset_id) continue
    if (compositeIds.has(tx.asset_id)) {
      audit.push({ id: tx.id, asset_id: tx.asset_id, reason: 'composite_parent' })
      continue
    }
    const expectedPrimary = componentToPrimary.get(tx.asset_id)
    if (expectedPrimary) {
      audit.push({ id: tx.id, asset_id: tx.asset_id, reason: 'non_primary_component' })
    }
  }

  console.log(`\nAudit: ${audit.length} consumption tx on composite parent or non-primary component`)
  if (audit.length > 0) {
    console.log('Sample (up to 15):')
    audit.slice(0, 15).forEach((a) => console.log(`  ${a.id} asset=${a.asset_id} (${a.reason})`))
  }

  if (!apply && missingPrimary.length > 0) {
    console.log('\nRe-run with --apply to set primary_component_id on composites listed above.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
