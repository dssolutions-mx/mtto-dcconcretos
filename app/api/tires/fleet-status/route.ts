import { createClient } from '@/lib/supabase-server'
import { buildFleetStatusSnapshot } from '@/lib/tires/fleet-status'
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

    let tiresQuery = supabase.from('tires').select('id, status', { count: 'exact', head: false })
    if (plantId) tiresQuery = tiresQuery.eq('plant_id', plantId)

    const [
      { data: tires, count: totalTires },
      { data: layouts },
      { data: assets },
      { data: activeInstallations },
    ] = await Promise.all([
      tiresQuery,
      supabase.from('equipment_model_tire_layouts').select('model_id, template_key, positions'),
      supabase.from('assets').select('id, model_id').not('model_id', 'is', null),
      supabase
        .from('asset_tire_installations')
        .select('id, asset_id')
        .is('removed_at', null),
    ])

    const layoutByModel = new Map(
      (layouts ?? []).map((l) => [l.model_id as string, l])
    )
    const modelsWithLayout = new Set(layoutByModel.keys())

    let positionsDefined = 0
    for (const layout of layouts ?? []) {
      positionsDefined += resolvePositionsFromLayout({
        template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
        positions: layout.positions,
        svg_variant: 'v1',
      }).length
    }

    const rollingAssets = assets ?? []
    const assetsWithLayout = rollingAssets.filter(
      (a) => a.model_id && modelsWithLayout.has(a.model_id)
    ).length

    let totalMountSlots = 0
    for (const asset of rollingAssets) {
      if (!asset.model_id) continue
      const layout = layoutByModel.get(asset.model_id)
      if (!layout) continue
      totalMountSlots += resolvePositionsFromLayout({
        template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
        positions: layout.positions,
        svg_variant: 'v1',
      }).length
    }

    const warehouseCount =
      tires?.filter((t) => t.status === 'en_almacen').length ?? 0
    const mountedCount = activeInstallations?.length ?? 0

    const status = buildFleetStatusSnapshot({
      totalTires: totalTires ?? tires?.length ?? 0,
      assetsWithLayout,
      totalRollingAssets: rollingAssets.length,
      positionsDefined,
      warehouseCount,
      mountedCount,
      totalMountSlots,
    })

    return NextResponse.json({ status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
