/**
 * One-off / CI: populate ingresos_gastos_kpi_plant_month (same logic as
 * POST /api/internal/refresh-ingresos-kpi-rollup, no HTTP auth).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/refresh-ingresos-kpi-rollup-once.ts
 *   npx tsx --env-file=.env.local scripts/refresh-ingresos-kpi-rollup-once.ts --from 2025-09
 *
 * For correct gerencial maintenance + sales integration during refresh, run Next on :3000 and set:
 *   INTERNAL_REQUEST_HOST=localhost:3000
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'
import { upsertKpiRollupMonth, type KpiRollupPlant } from '@/lib/reports/ingresos-gastos-kpi-rollup'

function rollingMonths(count: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < count; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** Every calendar month from `fromYm` (YYYY-MM) through the current month, inclusive. */
function monthsFromThroughNow(fromYm: string): string[] {
  const [y0, m0] = fromYm.split('-').map(Number)
  if (!y0 || !m0) return rollingMonths(2)
  const end = new Date()
  const endY = end.getFullYear()
  const endM = end.getMonth() + 1
  const out: string[] = []
  let y = y0
  let m = m0
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient<Database>(url, key, { auth: { persistSession: false } })
  const argv = process.argv.slice(2)
  const fromIdx = argv.indexOf('--from')
  const fromYm =
    fromIdx >= 0 && argv[fromIdx + 1] && /^\d{4}-\d{2}$/.test(argv[fromIdx + 1])
      ? argv[fromIdx + 1]
      : null
  const months = fromYm ? monthsFromThroughNow(fromYm) : rollingMonths(2)
  if (fromYm) {
    console.log('Refreshing months from', fromYm, 'through current:', months.length, 'months')
  }

  const { data: allPlants, error: plantsError } = await admin
    .from('plants')
    .select('id, name, code, business_unit_id')
    .order('name')

  if (plantsError || !allPlants?.length) {
    console.error('Plants:', plantsError?.message ?? 'empty')
    process.exit(1)
  }

  const plantRows = allPlants as KpiRollupPlant[]

  const requestHost =
    process.env.INTERNAL_REQUEST_HOST?.trim() ||
    process.env.INGRESOS_KPI_INTERNAL_HOST?.trim() ||
    null

  if (requestHost) {
    console.log('Using requestHost for gerencial internal fetches:', requestHost)
  }

  for (const month of months) {
    const payload = await runIngresosGastosPost({
      body: {
        month,
        businessUnitId: null,
        plantId: null,
        skipPreviousMonth: true,
      },
      supabase: admin,
      requestHost,
      bypassKpiRollupRead: true,
    })

    if ((payload as { error?: string }).error) {
      console.error(month, 'compute error:', (payload as { error: string }).error)
      continue
    }

    const computedPlants = (payload.plants || []) as Record<string, unknown>[]
    const { upserted } = await upsertKpiRollupMonth({
      supabaseAdmin: admin,
      month,
      allPlants: plantRows,
      computedPlants,
    })
    console.log(month, 'upserted', upserted, 'plants')
  }

  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
