/**
 * Backfill asset_diesel_efficiency_monthly for Jan–Apr 2026 (service role).
 * Usage: npx tsx scripts/backfill-asset-diesel-efficiency-jan-apr-2026.ts
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: NEXT_PUBLIC_BASE_URL for Cotizador L/m³ merge (defaults to http://127.0.0.1:3000)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import type { Database } from '../types/supabase-types'
import { computeAssetDieselEfficiencyMonths } from '../lib/reports/compute-asset-diesel-efficiency-monthly'

config({ path: resolve(__dirname, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const requestBaseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://127.0.0.1:3000'

async function main() {
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } })
  const yearMonths = ['2026-01', '2026-02', '2026-03', '2026-04']
  console.log('Computing', yearMonths.join(', '), '…')
  const { upserted, errors } = await computeAssetDieselEfficiencyMonths(supabase, {
    yearMonths,
    plantId: null,
    requestBaseUrl,
  })
  console.log('Upserted rows:', upserted)
  if (errors.length) {
    console.warn('Warnings/errors:', errors)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
