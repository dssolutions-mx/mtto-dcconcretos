import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { computeCostPerKm, computeTireTotalCost } from '@/lib/tires/cost-report'
import type { TireCostReportRow } from '@/types/tires'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: tires, error: tiresErr } = await supabase.from('tires').select('*')
    if (tiresErr) {
      return NextResponse.json({ error: tiresErr.message }, { status: 500 })
    }

    const { data: events, error: eventsErr } = await supabase.from('tire_events').select('*')
    if (eventsErr) {
      return NextResponse.json({ error: eventsErr.message }, { status: 500 })
    }

    const { data: installations, error: instErr } = await supabase
      .from('asset_tire_installations')
      .select('*, assets(name, current_kilometers)')
    if (instErr) {
      return NextResponse.json({ error: instErr.message }, { status: 500 })
    }

    const { data: readings, error: readErr } = await supabase
      .from('tire_readings')
      .select('*')
      .order('read_at', { ascending: false })
    if (readErr) {
      return NextResponse.json({ error: readErr.message }, { status: 500 })
    }

    const latestReadingByTire = new Map<string, number>()
    for (const r of readings ?? []) {
      if (!latestReadingByTire.has(r.tire_id) && r.tread_depth_mm != null) {
        latestReadingByTire.set(r.tire_id, r.tread_depth_mm)
      }
    }

    const activeInstallByTire = new Map<string, { asset_name: string | null }>()
    for (const inst of installations ?? []) {
      if (!inst.removed_at) {
        const assetRow = inst.assets as { name?: string } | null
        activeInstallByTire.set(inst.tire_id, {
          asset_name: assetRow?.name ?? null,
        })
      }
    }

    const rows: TireCostReportRow[] = (tires ?? []).map((tire) => {
      const tireEvents = (events ?? []).filter((e) => e.tire_id === tire.id)
      const totalCost = computeTireTotalCost(tire, tireEvents)
      const insts = (installations ?? []).filter((i) => i.tire_id === tire.id)
      let kmTraveled: number | null = null
      for (const inst of insts) {
        if (inst.km_at_install != null) {
          const assetRow = inst.assets as { current_kilometers?: number | null } | null
          const end =
            inst.km_at_remove ??
            (!inst.removed_at ? assetRow?.current_kilometers : null) ??
            inst.km_at_install
          const delta = end - inst.km_at_install
          kmTraveled = (kmTraveled ?? 0) + Math.max(0, delta)
        }
      }
      const active = activeInstallByTire.get(tire.id)
      return {
        tire_id: tire.id,
        brand: tire.brand,
        size: tire.size,
        serial_number: tire.serial_number,
        total_cost: totalCost,
        km_traveled: kmTraveled,
        cost_per_km: computeCostPerKm(totalCost, kmTraveled),
        current_tread_mm: latestReadingByTire.get(tire.id) ?? null,
        status: tire.status,
        asset_name: active?.asset_name ?? null,
      }
    })

    return NextResponse.json({ report: rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
