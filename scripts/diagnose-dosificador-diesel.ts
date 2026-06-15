/**
 * Read-only diagnostic: DOSIFICADOR profiles vs diesel_warehouses per plant.
 * Run: npx tsx scripts/diagnose-dosificador-diesel.ts
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const { data: dosificadores, error: profErr } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, plant_id, business_unit_id, status')
    .eq('role', 'DOSIFICADOR')
    .eq('status', 'active')

  if (profErr) {
    console.error('profiles error:', profErr.message)
    process.exit(1)
  }

  console.log(`Active DOSIFICADOR profiles: ${dosificadores?.length ?? 0}\n`)

  for (const p of dosificadores ?? []) {
    const name = `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim()
    let warehouseCount = 0
    let issue = ''

    if (!p.plant_id) {
      issue = 'MISSING plant_id'
    } else {
      const { count, error: whErr } = await supabase
        .from('diesel_warehouses')
        .select('id', { count: 'exact', head: true })
        .eq('plant_id', p.plant_id)
        .eq('product_type', 'diesel')

      if (whErr) {
        issue = `warehouse query error: ${whErr.message}`
      } else {
        warehouseCount = count ?? 0
        if (warehouseCount === 0) issue = 'NO diesel warehouse for plant'
        else if (!p.business_unit_id) issue = 'OK warehouses but missing business_unit_id (forms fixed in app)'
      }
    }

    console.log(
      `- ${name || p.id} | plant=${p.plant_id ?? 'NULL'} | bu=${p.business_unit_id ?? 'NULL'} | diesel_wh=${warehouseCount} | ${issue || 'OK'}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
