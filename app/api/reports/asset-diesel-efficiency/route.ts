import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase-server'
import { computeAssetDieselEfficiencyMonths } from '@/lib/reports/compute-asset-diesel-efficiency-monthly'
import type { Database } from '@/types/supabase-types'

type PostBody = {
  yearMonths?: string[]
  plantId?: string | null
  /** When true, runs compute (requires SUPABASE_SERVICE_ROLE_KEY on server) */
  recompute?: boolean
}

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

    const sb = supabase as unknown as { from: (t: string) => any }
    let q = sb
      .from('asset_diesel_efficiency_monthly')
      .select(
        `
        id,
        year_month,
        total_liters,
        hours_merged,
        hours_sum_raw,
        hours_trusted,
        kilometers_sum_raw,
        liters_per_hour_trusted,
        liters_per_km,
        concrete_m3,
        liters_per_m3,
        equipment_category,
        quality_flags,
        anomaly_flags,
        thresholds_version,
        computed_at,
        plant_id,
        assets(id, asset_id, name)
      `
      )
      .order('year_month', { ascending: false })
      .order('liters_per_hour_trusted', { ascending: true, nullsFirst: false })

    if (yearMonth) q = q.eq('year_month', yearMonth)
    if (plantId) q = q.eq('plant_id', plantId)

    const { data, error } = await q.limit(2000)
    if (error) {
      console.error('[asset-diesel-efficiency GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rows: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await req.json()) as PostBody
    const yearMonths =
      body.yearMonths && body.yearMonths.length > 0
        ? body.yearMonths
        : ['2026-01', '2026-02', '2026-03', '2026-04']

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json(
        {
          error:
            'Recompute requiere SUPABASE_SERVICE_ROLE_KEY en el servidor. Ejecute scripts/backfill-asset-diesel-efficiency-jan-apr-2026.ts con .env.local.',
        },
        { status: 503 }
      )
    }

    const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false } })

    const host = req.headers.get('host') || ''
    let requestBaseUrl: string | null = null
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      const port = host.split(':')[1] || '3000'
      requestBaseUrl = `http://127.0.0.1:${port}`
    } else if (host) {
      requestBaseUrl = `https://${host}`
    }

    const { upserted, errors } = await computeAssetDieselEfficiencyMonths(admin, {
      yearMonths,
      plantId: body.plantId ?? null,
      requestBaseUrl: body.recompute === false ? null : requestBaseUrl ?? null,
    })

    return NextResponse.json({ upserted, errors, yearMonths })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[asset-diesel-efficiency POST]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
