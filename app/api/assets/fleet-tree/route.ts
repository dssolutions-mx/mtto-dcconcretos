import { createClient } from '@/lib/supabase-server'
import { fetchFleetTreePayload } from '@/lib/fleet/fetch-fleet-data'
import type { FleetOrganizeLens } from '@/types/fleet'
import { NextRequest, NextResponse } from 'next/server'

const LENSES: FleetOrganizeLens[] = [
  'bu-plant-model',
  'bu-plant-categoria',
  'fabricante-modelo-planta',
  'ano-modelo-planta',
  'categoria-modelo-planta',
  'estado-planta-modelo',
]

function parseLens(raw: string | null): FleetOrganizeLens {
  if (raw && LENSES.includes(raw as FleetOrganizeLens)) {
    return raw as FleetOrganizeLens
  }
  return 'bu-plant-model'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const lens = parseLens(request.nextUrl.searchParams.get('lens'))
    const payload = await fetchFleetTreePayload(supabase, lens)

    return NextResponse.json({
      lens,
      nodes: payload.nodes,
      trust_by_asset_id: payload.trustByAssetId,
      policies: payload.policies,
      conflict_asset_ids: payload.conflictAssetIds,
      asset_count: payload.assets.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('fleet-tree', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
