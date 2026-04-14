import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { runCostAnalysis } from '@/lib/reports/cost-analysis-aggregate'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const months: string[] = Array.isArray(body.months) ? body.months : []
    const businessUnitId: string | null = body.businessUnitId || null
    const plantId: string | null = body.plantId || null

    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const payload = await runCostAnalysis({
      supabase,
      months,
      businessUnitId,
      plantId,
      requestHost: req.headers.get('host'),
      rollupReadUserKey: user?.id ?? 'anonymous',
    })

    return NextResponse.json(payload)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    console.error('analisis-costos API error:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
