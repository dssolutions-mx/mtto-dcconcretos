import { createClient } from '@/lib/supabase-server'
import { computeCostPerKm, computeTireTotalCost } from '@/lib/tires/cost-report'
import {
  aggregateTireExceptions,
  countExceptionsByPriority,
  detectAnomalousCostExceptions,
  detectCoverageExceptions,
  detectInstallationExceptions,
  resolveThresholds,
} from '@/lib/tires/exceptions'
import { resolvePositionsFromLayout } from '@/lib/tires/layout-resolver'
import { NextRequest, NextResponse } from 'next/server'
import type { AssetTireInstallation, TireLayoutTemplateKey, TireReading, TireThresholds } from '@/types/tires'

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
    const priorityFilter = request.nextUrl.searchParams.get('priority')

    const settingsQuery = plantId
      ? supabase.from('tire_fleet_settings').select('thresholds').eq('plant_id', plantId).maybeSingle()
      : supabase.from('tire_fleet_settings').select('thresholds').is('plant_id', null).maybeSingle()

    let assetsQuery = supabase
      .from('assets')
      .select('id, name, asset_id, model_id, plant_id')
      .order('name')
    if (plantId) assetsQuery = assetsQuery.eq('plant_id', plantId)

    const [
      { data: settingsRow },
      { data: layouts },
      { data: assets, error: assetsErr },
      { data: activeInstallations },
      { data: tires },
      { data: events },
      { data: readings },
    ] = await Promise.all([
      settingsQuery,
      supabase.from('equipment_model_tire_layouts').select('model_id, template_key, positions, svg_variant'),
      assetsQuery,
      supabase
        .from('asset_tire_installations')
        .select('*, tire:tires(*), assets(name, asset_id, current_kilometers)')
        .is('removed_at', null),
      supabase.from('tires').select('*'),
      supabase.from('tire_events').select('*'),
      supabase.from('tire_readings').select('*').order('read_at', { ascending: false }),
    ])

    if (assetsErr) {
      console.error('[tires/exceptions] GET assets', assetsErr)
      return NextResponse.json({ error: assetsErr.message }, { status: 500 })
    }

    const thresholds = (settingsRow?.thresholds ?? {}) as TireThresholds
    const layoutByModel = new Map((layouts ?? []).map((l) => [l.model_id as string, l]))

    const latestReadingByInstallation = new Map<string, TireReading>()
    for (const reading of readings ?? []) {
      const instId = reading.installation_id as string
      if (!latestReadingByInstallation.has(instId)) {
        latestReadingByInstallation.set(instId, reading as TireReading)
      }
    }

    const mountedByAsset = new Map<string, number>()
    for (const inst of activeInstallations ?? []) {
      const assetId = inst.asset_id as string
      mountedByAsset.set(assetId, (mountedByAsset.get(assetId) ?? 0) + 1)
    }

    const fleetCostPerKmValues: number[] = []
    for (const tire of tires ?? []) {
      const tireEvents = (events ?? []).filter((e) => e.tire_id === tire.id)
      const totalCost = computeTireTotalCost(tire, tireEvents)
      const insts = (activeInstallations ?? []).filter((i) => i.tire_id === tire.id)
      let kmTraveled: number | null = null
      for (const inst of insts) {
        if (inst.km_at_install != null) {
          const assetRow = inst.assets as { current_kilometers?: number | null } | null
          const end = assetRow?.current_kilometers ?? inst.km_at_install
          kmTraveled = (kmTraveled ?? 0) + Math.max(0, end - inst.km_at_install)
        }
      }
      const cpk = computeCostPerKm(totalCost, kmTraveled)
      if (cpk != null) fleetCostPerKmValues.push(cpk)
    }

    const installationExceptions = (activeInstallations ?? []).flatMap((inst) => {
      const assetRow = inst.assets as { name?: string; asset_id?: string | null } | null
      return detectInstallationExceptions({
        installation: {
          ...(inst as AssetTireInstallation),
          tire: inst.tire as AssetTireInstallation['tire'],
          latest_reading: latestReadingByInstallation.get(inst.id as string) ?? null,
        },
        asset_name: assetRow?.name ?? 'Activo',
        asset_code: assetRow?.asset_id ?? null,
        thresholds,
      })
    })

    const coverageExceptions = (assets ?? []).flatMap((asset) => {
      const modelId = asset.model_id as string | null
      const layout = modelId ? layoutByModel.get(modelId) : undefined
      const positions = layout
        ? resolvePositionsFromLayout({
            template_key: (layout.template_key ?? 'truck_6x4') as TireLayoutTemplateKey,
            positions: layout.positions,
            svg_variant: layout.svg_variant ?? 'v1',
          })
        : []

      return detectCoverageExceptions({
        asset_id: asset.id,
        asset_name: asset.name ?? 'Sin nombre',
        asset_code: asset.asset_id,
        has_model: !!modelId,
        has_layout: !!layout,
        mounted_count: mountedByAsset.get(asset.id) ?? 0,
        total_positions: positions.length,
      })
    })

    const costExceptions = (tires ?? []).flatMap((tire) => {
      const tireEvents = (events ?? []).filter((e) => e.tire_id === tire.id)
      const activeInst = (activeInstallations ?? []).find((i) => i.tire_id === tire.id)
      let kmTraveled: number | null = null
      if (activeInst?.km_at_install != null) {
        const assetRow = activeInst.assets as { current_kilometers?: number | null } | null
        const end = assetRow?.current_kilometers ?? activeInst.km_at_install
        kmTraveled = Math.max(0, end - activeInst.km_at_install)
      }
      const assetRow = activeInst?.assets as { name?: string } | null
      return detectAnomalousCostExceptions({
        tire,
        events: tireEvents,
        km_traveled: kmTraveled,
        asset_name: assetRow?.name ?? null,
        fleetCostPerKmValues,
      })
    })

    const allExceptions = aggregateTireExceptions([
      installationExceptions,
      coverageExceptions,
      costExceptions,
    ])

    let exceptions = allExceptions
    if (priorityFilter && ['P1', 'P2', 'P3'].includes(priorityFilter)) {
      exceptions = exceptions.filter((e) => e.priority === priorityFilter)
    }

    return NextResponse.json({
      exceptions,
      counts: countExceptionsByPriority(allExceptions),
      thresholds: resolveThresholds(thresholds),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
