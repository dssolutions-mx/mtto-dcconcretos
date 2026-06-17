import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { isDepartmentMember } from '@/lib/departments/department-membership'
import { notifyDepartmentSupervisor } from '@/lib/incidents/incident-notifications'
import { isOpenIncidentStatus } from '@/lib/incidents/incident-routing'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { note?: string }
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: current, error: fetchError } = await supabase
      .from('incident_history')
      .select(
        'id, routing_department_id, pipeline_stage, status, asset_id, acknowledged_at, acknowledged_by_id',
      )
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Incidente no encontrado' }, { status: 404 })
    }

    if (!isOpenIncidentStatus(current.status)) {
      return NextResponse.json({ error: 'El incidente ya está cerrado' }, { status: 400 })
    }

    if (!current.routing_department_id) {
      return NextResponse.json(
        { error: 'Clasifique el incidente en un departamento antes de acusar recibo' },
        { status: 400 },
      )
    }

    if (current.acknowledged_at) {
      return NextResponse.json({
        id: current.id,
        acknowledged_at: current.acknowledged_at,
        acknowledged_by_id: current.acknowledged_by_id,
        pipeline_stage: current.pipeline_stage,
        already_acknowledged: true,
      })
    }

    const { data: asset } = await supabase
      .from('assets')
      .select('plant_id')
      .eq('id', current.asset_id)
      .maybeSingle()

    if (!asset?.plant_id) {
      return NextResponse.json({ error: 'Activo sin planta' }, { status: 400 })
    }

    const isMember = await isDepartmentMember(supabase, {
      userId: user.id,
      plantId: asset.plant_id,
      departmentId: current.routing_department_id,
    })

    if (!isMember) {
      return NextResponse.json(
        { error: 'No perteneces al departamento asignado en esta planta' },
        { status: 403 },
      )
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('incident_history')
      .update({
        acknowledged_at: now,
        acknowledged_by_id: user.id,
        updated_at: now,
      })
      .eq('id', id)
      .select('id, acknowledged_at, acknowledged_by_id, pipeline_stage')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('incident_assignment_log').insert({
      incident_id: id,
      from_department_id: current.routing_department_id,
      to_department_id: current.routing_department_id,
      from_assignee_id: null,
      to_assignee_id: null,
      from_pipeline_stage: current.pipeline_stage,
      to_pipeline_stage: current.pipeline_stage,
      reason: body.note?.trim() || 'Departamento tomó conocimiento',
      changed_by: user.id,
    })

    await notifyDepartmentSupervisor(supabase, {
      departmentId: current.routing_department_id,
      incidentId: id,
      type: 'incident_acknowledged',
      title: 'Acuse de recibo',
      message: 'El departamento acusó recibo del incidente.',
      excludeUserId: user.id,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('POST incident acknowledge error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
