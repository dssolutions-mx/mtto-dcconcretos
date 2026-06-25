/**
 * Audit: plants missing an operational PLANTA model asset.
 *
 * Run: npx tsx scripts/audit-planta-assets.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { PLANTA_MODEL_ID } from '../lib/checklist/executor-roles'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function audit() {
  console.log('\n' + '='.repeat(72))
  console.log('Audit: plants without operational PLANTA asset')
  console.log('='.repeat(72))
  console.log(`PLANTA model id: ${PLANTA_MODEL_ID}\n`)

  const { data: plants, error: plantsError } = await supabase
    .from('plants')
    .select('id, name, code, business_unit_id')
    .order('code')

  if (plantsError) {
    console.error('Failed to load plants:', plantsError.message)
    process.exit(1)
  }

  const { data: plantaAssets, error: assetsError } = await supabase
    .from('assets')
    .select('id, asset_id, name, plant_id, status, model_id')
    .eq('model_id', PLANTA_MODEL_ID)
    .eq('status', 'operational')

  if (assetsError) {
    console.error('Failed to load PLANTA assets:', assetsError.message)
    process.exit(1)
  }

  const plantsWithPlanta = new Set(
    (plantaAssets ?? [])
      .map((a) => a.plant_id)
      .filter((id): id is string => Boolean(id))
  )

  const missing = (plants ?? []).filter((p) => !plantsWithPlanta.has(p.id))
  const covered = (plants ?? []).filter((p) => plantsWithPlanta.has(p.id))

  console.log(`Plants total: ${plants?.length ?? 0}`)
  console.log(`Operational PLANTA assets: ${plantaAssets?.length ?? 0}`)
  console.log(`Plants with PLANTA asset: ${covered.length}`)
  console.log(`Plants WITHOUT PLANTA asset: ${missing.length}\n`)

  if (covered.length > 0) {
    console.log('Covered plants:')
    for (const p of covered) {
      const assets = (plantaAssets ?? []).filter((a) => a.plant_id === p.id)
      const codes = assets.map((a) => a.asset_id ?? a.name).join(', ')
      console.log(`  ✓ ${p.code ?? '—'} ${p.name} (${codes})`)
    }
    console.log('')
  }

  if (missing.length === 0) {
    console.log('All plants have at least one operational PLANTA asset.')
    return
  }

  console.log('Plants missing operational PLANTA asset:')
  for (const p of missing) {
    console.log(`  ✗ ${p.code ?? '—'} ${p.name} (id: ${p.id})`)
  }
}

audit().catch((err) => {
  console.error(err)
  process.exit(1)
})
