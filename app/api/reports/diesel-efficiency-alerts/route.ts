import { NextRequest, NextResponse } from 'next/server'
import { requireEficienciaDieselApiAccess } from '@/lib/reports/report-api-auth'

export type DieselAlertKind =
  | 'efficiency_severe'
  | 'efficiency_watch'
  | 'breakpoint_mom'
  | 'consumption_pattern'
  | 'data_quality'

export type DieselAlertFollowupStatus = 'open' | 'acknowledged' | 'resolved'

const VALID_KINDS = new Set<DieselAlertKind>([
  'efficiency_severe',
  'efficiency_watch',
  'breakpoint_mom',
  'consumption_pattern',
  'data_quality',
])

const VALID_STATUS = new Set<DieselAlertFollowupStatus>([
  'open',
  'acknowledged',
  'resolved',
])

export async function GET(req: NextRequest) {
  const auth = await requireEficienciaDieselApiAccess()
  if (!auth.ok) return auth.response

  const yearMonth = new URL(req.url).searchParams.get('yearMonth')
  if (!yearMonth) {
    return NextResponse.json({ error: 'yearMonth requerido' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('diesel_efficiency_alert_followups')
    .select('id, asset_id, year_month, alert_kind, status, assigned_to, notes, updated_at')
    .eq('year_month', yearMonth)

  if (error) {
    console.error('[diesel-efficiency-alerts GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ followups: data ?? [] })
}

type PostBody = {
  assetId: string
  yearMonth: string
  alertKind: DieselAlertKind
  status: DieselAlertFollowupStatus
  notes?: string | null
}

export async function POST(req: NextRequest) {
  const auth = await requireEficienciaDieselApiAccess()
  if (!auth.ok) return auth.response

  let body: PostBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { assetId, yearMonth, alertKind, status, notes } = body
  if (!assetId || !yearMonth || !alertKind || !status) {
    return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 })
  }
  if (!VALID_KINDS.has(alertKind)) {
    return NextResponse.json({ error: 'alertKind inválido' }, { status: 400 })
  }
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: 'status inválido' }, { status: 400 })
  }

  const userId = auth.actor.profile.id

  const { data, error } = await auth.supabase
    .from('diesel_efficiency_alert_followups')
    .upsert(
      {
        asset_id: assetId,
        year_month: yearMonth,
        alert_kind: alertKind,
        status,
        notes: notes ?? null,
        assigned_to: status === 'open' ? null : userId,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'asset_id,year_month,alert_kind' }
    )
    .select('id, asset_id, year_month, alert_kind, status, assigned_to, notes, updated_at')
    .single()

  if (error) {
    console.error('[diesel-efficiency-alerts POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ followup: data })
}
