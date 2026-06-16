import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import {
  createServiceWindow,
  fetchPlanningCalendar,
  queueOpsServiceWindowNotification,
} from '@/lib/planning/service-windows'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const plantId = searchParams.get('plant_id')

    if (!from || !to) {
      return NextResponse.json({ error: 'from y to requeridos' }, { status: 400 })
    }

    const events = await fetchPlanningCalendar(supabase, from, to, plantId)
    return NextResponse.json({ events })
  } catch (e) {
    console.error('[planning/service-windows GET]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const window = await createServiceWindow(supabase, {
      asset_id: body.asset_id,
      work_order_id: body.work_order_id,
      plant_id: body.plant_id,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      reason: body.reason,
      notes: body.notes,
      confirm: body.confirm ?? false,
      notify_operations: body.notify_operations ?? false,
      created_by: user.id,
    })

    return NextResponse.json({ service_window: window })
  } catch (e) {
    console.error('[planning/service-windows POST]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, planning_status, notify_operations } = body

    if (!id) {
      return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (planning_status) update.planning_status = planning_status

    const { data: updated, error } = await supabase
      .from('asset_service_windows')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (notify_operations && planning_status === 'confirmed') {
      await queueOpsServiceWindowNotification(supabase, id)
    }

    return NextResponse.json({ service_window: updated })
  } catch (e) {
    console.error('[planning/service-windows PATCH]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
