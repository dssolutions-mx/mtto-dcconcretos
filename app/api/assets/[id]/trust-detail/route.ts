import { createClient } from '@/lib/supabase-server'
import { getTrustDetailForAsset } from '@/lib/fleet/trust-single-asset'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: assetId } = await context.params
    const { error, data } = await getTrustDetailForAsset(supabase, assetId)
    if (error) {
      return NextResponse.json({ error }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
