import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'

type Grain = 'daily' | 'weekly' | 'monthly'

function monthBounds(yearMonth: string): { monthStart: string; monthEnd: string } {
  const [ys, ms] = yearMonth.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error('yearMonth inválido (use YYYY-MM)')
  }
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { monthStart, monthEnd }
}

/**
 * SQL rollup views diesel_efficiency_bucket_*_mex (sum of hours_consumed denominators).
 * RLS: security_invoker views — same visibility as underlying diesel_transactions.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const yearMonth = searchParams.get('yearMonth')
    const plantId = searchParams.get('plantId')
    const assetId = searchParams.get('assetId')
    const grain = (searchParams.get('grain') || 'monthly') as Grain

    if (!yearMonth) {
      return NextResponse.json({ error: 'yearMonth es requerido (YYYY-MM)' }, { status: 400 })
    }

    const { monthStart, monthEnd } = monthBounds(yearMonth)

    const viewName =
      grain === 'daily'
        ? 'diesel_efficiency_bucket_daily_mex'
        : grain === 'weekly'
          ? 'diesel_efficiency_bucket_weekly_mex'
          : 'diesel_efficiency_bucket_monthly_mex'

    const bucketField =
      grain === 'daily' ? 'bucket_day' : grain === 'weekly' ? 'bucket_week' : 'bucket_month'

    const sb = supabase as unknown as { from: (t: string) => any }

    let q = sb.from(viewName).select('*').order(bucketField, { ascending: true })

    if (grain === 'monthly') {
      q = q.eq(bucketField, monthStart)
    } else {
      q = q.gte(bucketField, monthStart).lte(bucketField, monthEnd)
    }

    if (plantId) q = q.eq('plant_id', plantId)
    if (assetId) q = q.eq('asset_id', assetId)

    const { data: rows, error } = await q.limit(5000)
    if (error) {
      console.error('[diesel-efficiency-buckets]', viewName, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = rows ?? []
    const ids = [...new Set(list.map((r: { asset_id: string }) => r.asset_id).filter(Boolean))]
    let assetMap: Record<string, { asset_id: string | null; name: string | null }> = {}
    if (ids.length > 0) {
      const { data: assets } = await supabase
        .from('assets')
        .select('id, asset_id, name')
        .in('id', ids)
      for (const a of assets || []) {
        assetMap[a.id] = { asset_id: a.asset_id, name: a.name }
      }
    }

    const enriched = list.map((r: Record<string, unknown>) => ({
      ...r,
      asset_code: assetMap[r.asset_id as string]?.asset_id ?? null,
      asset_name: assetMap[r.asset_id as string]?.name ?? null,
    }))

    return NextResponse.json({
      grain,
      yearMonth,
      bucketField,
      rows: enriched,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
