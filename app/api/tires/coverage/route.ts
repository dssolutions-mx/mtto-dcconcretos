import { createClient } from '@/lib/supabase-server'
import { buildAssetCoverageRow, findOrphanedPositionCodes } from '@/lib/tires/coverage'
import { resolvePositionsFromLayout } from '@/lib/tires/layout-resolver'
import { NextRequest, NextResponse } from 'next/server'
import type { TireLayoutTemplateKey } from '@/types/tires'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const plantId = request.nextUrl.searchParams.get('plant_id')
    const statusFilter = request.nextUrl.searchParams.get('status')

    let assetsQuery = supabase
      .from('assets')
      .select('id, name, asset_id, model_id, plant_id, equipment_models(id, name)')
      .order('name')

    if (plantId) assetsQuery = assetsQuery.eq('plant_id', plantId)

    const [{ data: assets, error: assetsErr }, { data: layouts }, { data: installations }] =
      await Promise.all([
        assetsQuery,
        supabase
          .from('equipment_model_tire_layouts')
          .select('model_id, template_key, positions, svg_variant'),
        supabase
          .from('asset_tire_installations')
          .select('asset_id, position_code')
          .is('removed_at', null),
      ])

    if (assetsErr) {
      console.error('[tires/coverage] GET assets', assetsErr)
      return NextResponse.json({ error: assetsErr.message }, { status: 500 })
    }

    const layoutByModel = new Map((layouts ?? []).map((l) => [l.model_id as string, l]))

    const mountedByAsset = new Map<string, string[]>()
    for (const inst of installations ?? []) {
      const assetId = inst.asset_id as string
      const codes = mountedByAsset.get(assetId) ?? []
      codes.push(inst.position_code as string)
      mountedByAsset.set(assetId, codes)
    }

    let rows = (assets ?? []).map((asset) => {
      const modelId = asset.model_id as string | null
      const layout = modelId ? layoutByModel.get(modelId) : undefined
      const hasLayout = !!layout
      const positions = layout
        ? resolvePositionsFromLayout({
            template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
            positions: layout.positions,
            svg_variant: layout.svg_variant ?? 'v1',
          })
        : []
      const activeCodes = mountedByAsset.get(asset.id) ?? []
      const orphaned = findOrphanedPositionCodes(activeCodes, positions)

      const equipmentModel = Array.isArray(asset.equipment_models)
        ? asset.equipment_models[0]
        : asset.equipment_models

      return buildAssetCoverageRow({
        asset_id: asset.id,
        asset_name: asset.name ?? 'Sin nombre',
        asset_code: asset.asset_id,
        model_id: modelId,
        model_name: equipmentModel?.name ?? null,
        has_layout: hasLayout && !!modelId,
        total_positions: positions.length,
        mounted_count: activeCodes.length,
        orphaned_positions: orphaned,
      })
    })

    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter)
    }

    return NextResponse.json({ coverage: rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
