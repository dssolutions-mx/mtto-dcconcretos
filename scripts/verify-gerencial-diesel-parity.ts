/**
 * Compare L/h per asset: runGerencialReport vs asset_diesel_efficiency_monthly for one calendar month.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-gerencial-diesel-parity.ts 2026-05
 *
 * Requires Supabase env vars. Flags pairs where |Δ| > 0.05 L/h (rounding / scope).
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { runGerencialReport } from '@/lib/reports/run-gerencial-report'

const EPS_LPH = 0.05

async function main() {
  const month = process.argv[2] || new Date().toISOString().slice(0, 7)
  const [yr, m] = month.split('-').map(Number)
  const dateFrom = `${month}-01`
  const lastDay = new Date(yr, m, 0).getDate()
  const dateTo = `${month}-${String(lastDay).padStart(2, '0')}`

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient<Database>(url, key, { auth: { persistSession: false } })

  const gerencial = await runGerencialReport(
    { dateFrom, dateTo, hideZeroActivity: false },
    { supabase: admin }
  )

  const { data: effRows, error } = await admin
    .from('asset_diesel_efficiency_monthly')
    .select('asset_id, liters_per_hour_trusted, total_liters, hours_trusted')
    .eq('year_month', month)

  if (error) {
    console.error('Efficiency table error:', error.message)
    process.exit(1)
  }

  const effByAsset = new Map(
    (effRows || []).map((r) => [r.asset_id, r])
  )

  let compared = 0
  let mismatches = 0
  let missingEff = 0

  for (const asset of (gerencial.assets || []) as Array<{
    id: string
    asset_code?: string
    diesel_liters?: number
    liters_per_hour?: number
  }>) {
    const liters = Number(asset.diesel_liters || 0)
    const lphG = Number(asset.liters_per_hour || 0)
    if (liters <= 0 || lphG <= 0) continue

    const eff = effByAsset.get(asset.id)
    if (!eff?.liters_per_hour_trusted) {
      missingEff++
      continue
    }
    const lphE = Number(eff.liters_per_hour_trusted)
    compared++
    const delta = Math.abs(lphG - lphE)
    if (delta > EPS_LPH) {
      mismatches++
      console.warn('L/h mismatch', asset.asset_code || asset.id, {
        gerencial: lphG,
        efficiency: lphE,
        delta,
      })
    }
  }

  console.log(`Month ${month}: compared ${compared} assets, mismatches ${mismatches}, missing efficiency row ${missingEff}`)
  process.exit(mismatches > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
