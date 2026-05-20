import { NextRequest, NextResponse } from 'next/server'
import { runGerencialReport } from '@/lib/reports/run-gerencial-report'
import {
  aggregateDieselByPlant,
  buildManttoBreakdownFromGerencial,
  getMonthDateRange,
  type DieselOperationalDetails,
  type ManttoOperationalDetails,
} from '@/lib/reports/ingresos-gastos-operational-details'
import type { AnomalyFlags } from '@/components/reports/diesel-efficiency/types'
import { requireReportsApiAccess } from '@/lib/reports/report-api-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireReportsApiAccess()
    if (!auth.ok) return auth.response
    const supabase = auth.supabase

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const category = searchParams.get('category')
    const scopePlantIdsParam = searchParams.get('scopePlantIds')
    const businessUnitId = searchParams.get('businessUnitId') || null
    const plantId = searchParams.get('plantId') || null

    if (!month || !category) {
      return NextResponse.json(
        { error: 'Missing required parameters: month, category' },
        { status: 400 }
      )
    }

    if (!['diesel', 'mantto'].includes(category)) {
      return NextResponse.json(
        { error: 'Category must be diesel or mantto' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month must be YYYY-MM' },
        { status: 400 }
      )
    }

    const scopePlantIds = new Set(
      (scopePlantIdsParam || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    )

    if (scopePlantIds.size === 0) {
      return NextResponse.json(
        { error: 'scopePlantIds is required (comma-separated plant UUIDs)' },
        { status: 400 }
      )
    }

    const requestHost = req.headers.get('host')

    if (category === 'diesel') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const { data: rows, error } = await sb
        .from('asset_diesel_efficiency_monthly')
        .select(
          'plant_id, total_liters, liters_per_hour_trusted, liters_per_km, anomaly_flags'
        )
        .eq('year_month', month)
        .in('plant_id', Array.from(scopePlantIds))
        .limit(2000)

      if (error) {
        console.error('[operational-details diesel]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const byPlantId = aggregateDieselByPlant(
        (rows || []).map((r: Record<string, unknown>) => ({
          plant_id: r.plant_id as string | null,
          total_liters: r.total_liters as number | null,
          liters_per_hour_trusted: r.liters_per_hour_trusted as number | null,
          liters_per_km: r.liters_per_km as number | null,
          anomaly_flags: r.anomaly_flags as AnomalyFlags | null,
        })),
        scopePlantIds
      )

      const payload: DieselOperationalDetails = { category: 'diesel', byPlantId }
      return NextResponse.json(payload)
    }

    const { dateFromStr, dateToStr } = getMonthDateRange(month)
    const gerencialData = await runGerencialReport(
      {
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        businessUnitId,
        plantId,
        hideZeroActivity: false,
      },
      { requestHost, supabase }
    )

    const plants = (gerencialData.plants || []) as Array<{
      id: string
      maintenance_cost?: number
      preventive_cost?: number
      corrective_cost?: number
    }>
    const assets = (gerencialData.assets || []) as Array<{
      id: string
      asset_code?: string
      plant_id?: string
      preventive_cost?: number
      corrective_cost?: number
      maintenance_cost?: number
    }>

    const byPlantId = buildManttoBreakdownFromGerencial(plants, assets, scopePlantIds)
    const payload: ManttoOperationalDetails = { category: 'mantto', byPlantId }
    return NextResponse.json(payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('[operational-details]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
