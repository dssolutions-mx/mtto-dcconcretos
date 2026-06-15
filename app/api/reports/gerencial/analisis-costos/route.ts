import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runCostAnalysis } from '@/lib/reports/cost-analysis-aggregate'
import { requireReportsApiAccess } from '@/lib/reports/report-api-auth'
import type { Database } from '@/types/supabase-types'

export const maxDuration = 120

const COST_ANALYSIS_CACHE_TAG = 'cost-analysis-report'

type CostAnalysisSupabase = SupabaseClient<Database>

async function runCostAnalysisCached(
  params: {
    months: string[]
    businessUnitId: string | null
    plantId: string | null
    requestHost: string | null
    rollupReadUserKey: string
  },
  /** Session client created outside `unstable_cache` (must not call `cookies()` inside cache). */
  supabase: CostAnalysisSupabase
) {
  const sortedMonths = [...new Set(params.months.map(m => m.slice(0, 7)))].sort().join(',')
  const run = () =>
    runCostAnalysis({
      supabase,
      months: params.months,
      businessUnitId: params.businessUnitId,
      plantId: params.plantId,
      requestHost: params.requestHost,
      rollupReadUserKey: params.rollupReadUserKey,
    })

  const cached = unstable_cache(run, [
    'cost-analysis',
    sortedMonths,
    params.businessUnitId ?? 'all-bu',
    params.plantId ?? 'all-plant',
    params.rollupReadUserKey,
  ], { revalidate: 60, tags: [COST_ANALYSIS_CACHE_TAG] })

  try {
    return await cached()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('incrementalCache missing')) throw error
    return run()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireReportsApiAccess()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const months: string[] = Array.isArray(body.months) ? body.months : []
    const businessUnitId: string | null = body.businessUnitId || null
    const plantId: string | null = body.plantId || null

    const payload = await runCostAnalysisCached(
      {
        months,
        businessUnitId,
        plantId,
        requestHost: req.headers.get('host'),
        rollupReadUserKey: auth.actor.userId,
      },
      auth.supabase
    )

    return NextResponse.json(payload)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    console.error('analisis-costos API error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
