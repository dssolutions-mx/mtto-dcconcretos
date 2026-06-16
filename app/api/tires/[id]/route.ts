import { createClient } from '@/lib/supabase-server'
import { computeCostPerKm, computeTireTotalCost } from '@/lib/tires/cost-report'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
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

    const { id: tireId } = await context.params

    const { data: tire, error: tireErr } = await supabase
      .from('tires')
      .select('*')
      .eq('id', tireId)
      .maybeSingle()

    if (tireErr) return NextResponse.json({ error: tireErr.message }, { status: 500 })
    if (!tire) return NextResponse.json({ error: 'Llanta no encontrada' }, { status: 404 })

    const [
      { data: installations },
      { data: readings },
      { data: events },
    ] = await Promise.all([
      supabase
        .from('asset_tire_installations')
        .select('*, assets(id, name, asset_id, current_kilometers)')
        .eq('tire_id', tireId)
        .order('installed_at', { ascending: false }),
      supabase
        .from('tire_readings')
        .select('*')
        .eq('tire_id', tireId)
        .order('read_at', { ascending: false }),
      supabase
        .from('tire_events')
        .select('*')
        .eq('tire_id', tireId)
        .order('event_at', { ascending: false }),
    ])

    const tireEvents = events ?? []
    const totalCost = computeTireTotalCost(tire, tireEvents)

    let kmTraveled: number | null = null
    for (const inst of installations ?? []) {
      if (inst.km_at_install != null) {
        const assetRow = inst.assets as { current_kilometers?: number | null } | null
        const end =
          inst.km_at_remove ??
          (!inst.removed_at ? assetRow?.current_kilometers : null) ??
          inst.km_at_install
        kmTraveled = (kmTraveled ?? 0) + Math.max(0, end - inst.km_at_install)
      }
    }

    const activeInstallation =
      (installations ?? []).find((i) => !i.removed_at) ?? null

    const activeAsset = activeInstallation?.assets as
      | { id?: string; name?: string; asset_id?: string | null }
      | null

    return NextResponse.json({
      tire,
      active_installation: activeInstallation,
      active_asset: activeAsset,
      installations: installations ?? [],
      readings: readings ?? [],
      events: tireEvents,
      cost_summary: {
        purchase_cost: tire.purchase_cost ?? 0,
        event_costs: totalCost - (tire.purchase_cost ?? 0),
        total_cost: totalCost,
        km_traveled: kmTraveled,
        cost_per_km: computeCostPerKm(totalCost, kmTraveled),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
