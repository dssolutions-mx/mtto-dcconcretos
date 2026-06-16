import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAssetAvailability } from '@/lib/agenda/production-availability'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get('asset_id')
    const startsAt = searchParams.get('starts_at')
    const endsAt = searchParams.get('ends_at')
    const excludeWindowId = searchParams.get('exclude_window_id')

    if (!assetId || !startsAt || !endsAt) {
      return NextResponse.json(
        { error: 'asset_id, starts_at y ends_at son requeridos' },
        { status: 400 },
      )
    }

    const result = await checkAssetAvailability(supabase, {
      asset_id: assetId,
      starts_at: startsAt,
      ends_at: endsAt,
      exclude_window_id: excludeWindowId ?? undefined,
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error('[planning/availability]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
