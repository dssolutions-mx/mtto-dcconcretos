import { createClient } from '@/lib/supabase-server'
import { expandAssetIdsForOperatorChecklists } from '@/lib/composite-operator-scope'
import { categorizeSchedulesByDate, getUTCToday } from '@/lib/utils/date-utils'
import { NextResponse } from 'next/server'

type ReadingUnit = 'hours' | 'kilometers' | 'both' | 'none'

function normalizeMaintenanceUnit(raw: string | null | undefined): ReadingUnit {
  const u = (raw ?? 'hours').toLowerCase()
  if (u === 'kilometers' || u === 'kilometres') return 'kilometers'
  if (u === 'both') return 'both'
  if (u === 'none') return 'none'
  return 'hours'
}

function isOpenIncidentStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase().trim()
  if (!s) return true
  return ![
    'resuelto',
    'resolved',
    'closed',
    'cerrado',
    'cancelado',
    'cancelled',
  ].includes(s)
}

function rankImpact(impact: string | null | undefined): number {
  const i = (impact ?? '').toLowerCase()
  if (i.includes('alto') || i.includes('high') || i.includes('crít')) return 3
  if (i.includes('medio') || i.includes('medium')) return 2
  if (i.includes('bajo') || i.includes('low')) return 1
  return 0
}

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

    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select(
        `
        id,
        current_hours,
        current_kilometers,
        equipment_models ( maintenance_unit )
      `
      )
      .eq('id', assetId)
      .single()

    if (assetErr || !asset) {
      return NextResponse.json({ error: assetErr?.message ?? 'Activo no encontrado' }, { status: 404 })
    }

    const rawMu = Array.isArray(asset.equipment_models)
      ? asset.equipment_models[0]?.maintenance_unit
      : (asset.equipment_models as { maintenance_unit?: string } | null)?.maintenance_unit
    const unit = normalizeMaintenanceUnit(rawMu)

    const scheduleAssetIds = await expandAssetIdsForOperatorChecklists(supabase, [assetId])
    const filterIds = scheduleAssetIds.length > 0 ? scheduleAssetIds : [assetId]

    const [schedRes, incRes, planRes] = await Promise.all([
      supabase
        .from('checklist_schedules')
        .select('scheduled_day, scheduled_date, status')
        .in('asset_id', filterIds)
        .eq('status', 'pendiente'),
      supabase
        .from('incident_history')
        .select('id, status, impact')
        .eq('asset_id', assetId),
      supabase
        .from('maintenance_plans')
        .select('id, name, next_due, interval_value, status')
        .eq('asset_id', assetId)
        .order('next_due', { ascending: true, nullsFirst: false })
        .limit(8),
    ])

    const pendingSchedules = schedRes.data ?? []
    const categorized = categorizeSchedulesByDate(pendingSchedules as { scheduled_day?: string; scheduled_date?: string }[])

    const openIncidents = (incRes.data ?? []).filter((i) => isOpenIncidentStatus(i.status))
    let worst: string | null = null
    let worstRank = -1
    for (const i of openIncidents) {
      const r = rankImpact(i.impact)
      if (r > worstRank) {
        worstRank = r
        worst = i.impact ?? null
      }
    }

    let preventiveStatus: 'ok' | 'upcoming' | 'overdue' | 'no_plan' = 'no_plan'
    let nextName: string | null = null
    let nextDueDate: string | null = null
    let daysUntil: number | null = null

    const plans = planRes.data ?? []
    const nextPlan = plans.find((p) => p.next_due) ?? plans[0] ?? null

    if (nextPlan?.next_due) {
      nextName = nextPlan.name ?? null
      nextDueDate = nextPlan.next_due
      try {
        const due = new Date(nextPlan.next_due)
        const today = getUTCToday()
        const dueDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()))
        daysUntil = Math.round((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
        if (daysUntil < 0) preventiveStatus = 'overdue'
        else if (daysUntil <= 14) preventiveStatus = 'upcoming'
        else preventiveStatus = 'ok'
      } catch {
        preventiveStatus = 'no_plan'
      }
    } else if (plans.length > 0) {
      nextName = plans[0].name ?? null
      preventiveStatus = 'ok'
    }

    const payload = {
      reading: {
        unit,
        hours: asset.current_hours,
        kilometers: asset.current_kilometers,
      },
      preventive: {
        next_name: nextName,
        next_due_date: nextDueDate,
        days_until: daysUntil,
        next_due_unit: 'days' as const,
        interval_value: nextPlan?.interval_value ?? null,
        status: preventiveStatus,
      },
      incidents: {
        open_count: openIncidents.length,
        worst_impact: worst,
      },
      schedules: {
        overdue: categorized.overdue.length,
        today: categorized.today.length,
        upcoming: categorized.upcoming.length,
      },
    }

    return NextResponse.json(payload)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    console.error('fleet-quickview', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
