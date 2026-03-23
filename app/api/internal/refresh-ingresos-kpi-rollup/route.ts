import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase-types'
import { runIngresosGastosPost } from '@/lib/reports/ingresos-gastos-compute'
import { upsertKpiRollupMonth, type KpiRollupPlant } from '@/lib/reports/ingresos-gastos-kpi-rollup'
import { revalidateIngresosGastosReportCache } from '@/lib/reports/ingresos-gastos-cache'

/** Scheduled HTTP callers (e.g. Supabase pg_cron → pg_net) may need several minutes. */
export const maxDuration = 300

function authorize(req: NextRequest): boolean {
  const secret =
    process.env.INGRESOS_GASTOS_KPI_ROLLUP_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const hx = req.headers.get('x-ingresos-kpi-secret')
  return auth === `Bearer ${secret}` || hx === secret
}

function defaultRollingMonths(count: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < count; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

const MONTH_RE = /^\d{4}-\d{2}$/

async function executeRefresh(req: NextRequest, months: string[]): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Missing Supabase admin config' }, { status: 500 })
  }

  const admin = createClient<Database>(url, key, { auth: { persistSession: false } })

  const { data: allPlants, error: plantsError } = await admin
    .from('plants')
    .select('id, name, code, business_unit_id')
    .order('name')

  if (plantsError || !allPlants?.length) {
    return NextResponse.json(
      { error: plantsError?.message || 'No plants' },
      { status: 500 }
    )
  }

  const plantRows = allPlants as KpiRollupPlant[]
  const host = req.headers.get('host')
  const results: { month: string; upserted: number; error?: string }[] = []

  for (const month of months) {
    try {
      const payload = await runIngresosGastosPost({
        body: {
          month,
          businessUnitId: null,
          plantId: null,
          skipPreviousMonth: true,
        },
        supabase: admin,
        requestHost: host,
        bypassKpiRollupRead: true,
      })

      if ((payload as { error?: string }).error) {
        results.push({
          month,
          upserted: 0,
          error: (payload as { error: string }).error,
        })
        continue
      }

      const computedPlants = (payload.plants || []) as Record<string, unknown>[]
      const { upserted } = await upsertKpiRollupMonth({
        supabaseAdmin: admin,
        month,
        allPlants: plantRows,
        computedPlants,
      })
      results.push({ month, upserted })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      results.push({ month, upserted: 0, error: msg })
    }
  }

  revalidateIngresosGastosReportCache()

  return NextResponse.json({ ok: true, results })
}

/**
 * GET — Same default refresh as POST (current + previous month). Use for ad-hoc checks if needed.
 *
 * POST — optional JSON `{ "months": ["2026-01","2026-02"] }`; otherwise default rolling window.
 * Supabase pg_cron calls `call_refresh_ingresos_kpi_rollup()` which POSTs here (see migration).
 *
 * Auth: Bearer / `x-ingresos-kpi-secret` using INGRESOS_GASTOS_KPI_ROLLUP_CRON_SECRET or CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return executeRefresh(req, defaultRollingMonths(2))
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let months: string[] = []
  try {
    const body = (await req.json()) as { months?: unknown }
    if (Array.isArray(body?.months)) {
      months = body.months.filter((m): m is string => typeof m === 'string' && MONTH_RE.test(m))
    }
  } catch {
    /* empty body */
  }
  if (months.length === 0) months = defaultRollingMonths(2)

  return executeRefresh(req, months)
}
