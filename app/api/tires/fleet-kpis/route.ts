import { createClient } from '@/lib/supabase-server'
import { computeFleetAvgCostPerKm, computeReadingCoverage7d } from '@/lib/tires/fleet-kpis'
import { NextRequest, NextResponse } from 'next/server'

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

    let tiresQuery = supabase.from('tires').select('*')
    if (plantId) tiresQuery = tiresQuery.eq('plant_id', plantId)

    const [
      { data: tires },
      { data: events },
      { data: allInstallations },
      { data: readings },
    ] = await Promise.all([
      tiresQuery,
      supabase.from('tire_events').select('*'),
      supabase
        .from('asset_tire_installations')
        .select('id, tire_id, km_at_install, km_at_remove, removed_at, assets(current_kilometers)'),
      supabase.from('tire_readings').select('installation_id, read_at').order('read_at', {
        ascending: false,
      }),
    ])

    const warehouseCount = (tires ?? []).filter((t) => t.status === 'en_almacen').length
    const activeInstallations = (allInstallations ?? []).filter((i) => !i.removed_at)
    const mountedIds = activeInstallations.map((i) => i.id as string)

    const latestReadingByInstallation = new Map<string, { read_at: string }>()
    for (const r of readings ?? []) {
      const instId = r.installation_id as string
      if (!latestReadingByInstallation.has(instId)) {
        latestReadingByInstallation.set(instId, { read_at: r.read_at as string })
      }
    }

    const coverage = computeReadingCoverage7d({
      mountedInstallationIds: mountedIds,
      readingsByInstallation: latestReadingByInstallation,
    })

    const kmByTireId = new Map<string, number>()
    for (const inst of allInstallations ?? []) {
      if (inst.km_at_install == null) continue
      const assetRow = inst.assets as { current_kilometers?: number | null } | null
      const end =
        inst.km_at_remove ??
        (!inst.removed_at ? assetRow?.current_kilometers : null) ??
        inst.km_at_install
      const delta = Math.max(0, end - inst.km_at_install)
      kmByTireId.set(
        inst.tire_id as string,
        (kmByTireId.get(inst.tire_id as string) ?? 0) + delta
      )
    }

    const costStats = computeFleetAvgCostPerKm({
      tires: tires ?? [],
      events: events ?? [],
      kmByTireId,
    })

    return NextResponse.json({
      kpis: {
        avgCostPerKm: costStats.avg,
        tiresWithCostData: costStats.count,
        readingCoverage7dPct: coverage.pct,
        mountedWithRecentReading: coverage.withReading,
        totalMounted: coverage.total,
        warehouseCount,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
