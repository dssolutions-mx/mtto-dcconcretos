import { NextRequest, NextResponse } from 'next/server'
import { requireIncidentSlaAdminAccess } from '@/lib/incidents/incident-sla-admin-auth'
import { validateSlaTargetInput, type SlaTargetInput } from '@/lib/incidents/incident-sla-targets'

const TARGET_SELECT = `
  *,
  departments:match_department_id ( id, name, code ),
  plants:plant_id ( id, name, code )
`

export async function GET() {
  try {
    const auth = await requireIncidentSlaAdminAccess()
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase
      .from('incident_sla_targets')
      .select(TARGET_SELECT)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET sla-targets error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireIncidentSlaAdminAccess()
    if (!auth.ok) return auth.response

    const body = (await req.json()) as SlaTargetInput
    const validation = validateSlaTargetInput(body)
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from('incident_sla_targets')
      .insert({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .select(TARGET_SELECT)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('POST sla-targets error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
