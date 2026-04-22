import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const assetId = request.nextUrl.searchParams.get('asset_id')
    const limit = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? '30'))
    )

    let q = supabase
      .from('assets_audit_log')
      .select('id, asset_id, user_id, field, before_value, after_value, source, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (assetId) {
      q = q.eq('asset_id', assetId)
    }

    const { data, error } = await q

    if (error) {
      console.error(error)
      return NextResponse.json({ rows: [], error: error.message })
    }

    return NextResponse.json({ rows: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
