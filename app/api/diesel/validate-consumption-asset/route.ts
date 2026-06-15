import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
  fetchConsumptionValidationContext,
  validateConsumptionAssetId,
} from '@/lib/assets/consumption-eligible-assets'

export async function GET(request: NextRequest) {
  try {
    const assetId = new URL(request.url).searchParams.get('asset_id')
    if (!assetId) {
      return NextResponse.json({ error: 'asset_id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { asset, parent } = await fetchConsumptionValidationContext(supabase, assetId)
    const result = validateConsumptionAssetId(assetId, asset, parent)

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
