import { createClient } from '@/lib/supabase-server'
import { fetchFleetTreePayload } from '@/lib/fleet/fetch-fleet-data'
import type { FleetOrganizeLens } from '@/types/fleet'
import { computeAssetTrustFields, buildVerificationMap } from '@/lib/fleet/trust-server'
import type { FleetAssetRow } from '@/lib/fleet/organize'
import { NextResponse } from 'next/server'

const DEFAULT_LENS: FleetOrganizeLens = 'bu-plant-model'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await fetchFleetTreePayload(supabase, DEFAULT_LENS)
    const vmap = buildVerificationMap(payload.verificationRows)

    const byAsset: Record<
      string,
      ReturnType<typeof computeAssetTrustFields>
    > = {}
    const conflictSet = new Set(payload.conflictAssetIds)
    for (const a of payload.assets as FleetAssetRow[]) {
      byAsset[a.id] = computeAssetTrustFields(
        a,
        vmap,
        payload.policies,
        conflictSet
      )
    }

    return NextResponse.json({
      trust_by_asset_id: payload.trustByAssetId,
      fields_by_asset_id: byAsset,
      policies: payload.policies,
      global_trust_pct:
        payload.assets.length === 0
          ? 100
          : Math.round(
              payload.assets.reduce(
                (s, x) => s + (payload.trustByAssetId[x.id] ?? 0),
                0
              ) / payload.assets.length
            ),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('trust', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
