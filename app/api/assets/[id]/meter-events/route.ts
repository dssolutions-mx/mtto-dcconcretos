import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: assetId } = await context.params
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const order = searchParams.get('order') === 'recorded_at' ? 'recorded_at' : 'event_at'
    const ascending = searchParams.get('desc') !== '1'

    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('id')
      .eq('id', assetId)
      .maybeSingle()

    if (assetErr) {
      console.error('[meter-events] asset lookup', assetErr)
      return NextResponse.json({ error: assetErr.message }, { status: 500 })
    }
    if (!asset) {
      return NextResponse.json({ error: 'Activo no encontrado' }, { status: 404 })
    }

    let q = supabase
      .from('asset_meter_reading_events')
      .select('*')
      .eq('asset_id', assetId)

    if (from) q = q.gte('event_at', from)
    if (to) q = q.lt('event_at', to)

    if (order === 'recorded_at') {
      q = q.order('recorded_at', { ascending, nullsFirst: false })
    } else {
      q = q.order('event_at', { ascending, nullsFirst: false })
    }

    const { data, error } = await q
    if (error) {
      console.error('[meter-events] query', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
