/**
 * Ensure every plant has one operational PLANTA model asset.
 *
 * Audit only:  npx tsx scripts/audit-planta-assets.ts
 * Create missing: npx tsx scripts/ensure-planta-assets.ts
 * Dry run:     npx tsx scripts/ensure-planta-assets.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { PLANTA_MODEL_ID } from '../lib/checklist/executor-roles'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const dryRun = process.argv.includes('--dry-run')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function plantaAssetIdForPlant(code: string | null, name: string): string {
  const base = (code ?? name).replace(/\s+/g, ' ').trim()
  return `PLANTA ${base}`.slice(0, 50)
}

async function defaultDepartmentIdForPlant(plantId: string): Promise<string | null> {
  const { data: sibling } = await supabase
    .from('assets')
    .select('department_id')
    .eq('plant_id', plantId)
    .not('department_id', 'is', null)
    .limit(1)
    .maybeSingle()

  return sibling?.department_id ?? null
}

async function ensure() {
  console.log('\n' + '='.repeat(72))
  console.log(dryRun ? 'Dry run: ensure PLANTA assets' : 'Ensure PLANTA assets per plant')
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

  if (missing.length === 0) {
    console.log('All plants already have an operational PLANTA asset.')
    return
  }

  console.log(`Plants missing PLANTA asset: ${missing.length}\n`)

  for (const plant of missing) {
    const assetId = plantaAssetIdForPlant(plant.code, plant.name)
    const name = `Operaciones ${plant.name}`.slice(0, 120)
    const department_id = await defaultDepartmentIdForPlant(plant.id)

    const row = {
      asset_id: assetId,
      name,
      plant_id: plant.id,
      model_id: PLANTA_MODEL_ID,
      status: 'operational' as const,
      department_id,
      current_hours: 0,
      current_kilometers: 0,
      notes: '[auto] PLANTA asset created by scripts/ensure-planta-assets.ts',
    }

    console.log(`  → ${plant.code ?? '—'} ${plant.name}`)
    console.log(`     asset_id=${assetId}, department_id=${department_id ?? 'null'}`)

    if (dryRun) continue

    const { data: created, error: insertError } = await supabase
      .from('assets')
      .insert(row)
      .select('id, asset_id')
      .single()

    if (insertError) {
      console.error(`     ✗ Insert failed: ${insertError.message}`)
      process.exitCode = 1
      continue
    }

    console.log(`     ✓ Created ${created?.asset_id} (${created?.id})`)
  }

  if (dryRun) {
    console.log('\nDry run complete — no rows inserted. Re-run without --dry-run to create.')
  }
}

ensure().catch((err) => {
  console.error(err)
  process.exit(1)
})
