import { NextRequest, NextResponse } from 'next/server'
import { requireIncidentSlaAdminAccess } from '@/lib/incidents/incident-sla-admin-auth'
import { validateSlaTargetInput, type SlaTargetInput } from '@/lib/incidents/incident-sla-targets'

const TARGET_SELECT = `
  *,
  departments:match_department_id ( id, name, code ),
  plants:plant_id ( id, name, code )
`

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireIncidentSlaAdminAccess()
    if (!auth.ok) return auth.response

    const { id } = await params
    const body = (await req.json()) as Partial<SlaTargetInput> & { is_active?: boolean }

    const validation = validateSlaTargetInput(body, { requireName: body.name !== undefined })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = validation.data.name
    if (body.priority !== undefined) updates.priority = validation.data.priority
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.plant_id !== undefined) updates.plant_id = validation.data.plant_id
    if (body.match_incident_type !== undefined) {
      updates.match_incident_type = validation.data.match_incident_type
    }
    if (body.match_impact !== undefined) updates.match_impact = validation.data.match_impact
    if (body.match_department_id !== undefined) {
      updates.match_department_id = validation.data.match_department_id
    }
    if (body.target_ack_hours !== undefined) {
      updates.target_ack_hours = validation.data.target_ack_hours
    }
    if (body.target_schedule_hours !== undefined) {
      updates.target_schedule_hours = validation.data.target_schedule_hours
    }
    if (body.target_resolve_hours !== undefined) {
      updates.target_resolve_hours = validation.data.target_resolve_hours
    }

    const { data, error } = await auth.supabase
      .from('incident_sla_targets')
      .update(updates)
      .eq('id', id)
      .select(TARGET_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PATCH sla-target error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireIncidentSlaAdminAccess()
    if (!auth.ok) return auth.response

    const { id } = await params
    const { error } = await auth.supabase.from('incident_sla_targets').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE sla-target error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
